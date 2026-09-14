// Route matching and declarativeNetRequest rule building, shared by the
// service worker, content script and popup. Mirrors the semantics of
// src/lib/extension-routes.ts, which generates routes.generated.js; that file
// is the data, this file is the behaviour.
(() => {
    const EXIT_PARAM =
        globalThis.NEOSRC_ROUTE_BUNDLE?.exitParam ?? "neosrc_exit";
    const EXTENSION_HEADER =
        globalThis.NEOSRC_ROUTE_BUNDLE?.header ?? "x-neosrc-extension";
    const SUPPORTED_TABLE_VERSION = 2;
    const MAX_RULES = 64;
    const MAX_PATTERN_LENGTH = 200;
    const MAX_SESSION_RULES = 200;

    const EXIT_ALLOW_RULE_ID = 1;
    const EXTENSION_HEADER_RULE_ID_BASE = 2;
    const MAX_HEADER_RULES = 8;
    const RESERVED_ALLOW_RULE_ID_BASE = 10;
    const OWNER_ALLOW_RULE_ID_BASE = 20;
    const MAX_OWNER_RULES = 60;
    const REDIRECT_RULE_ID_BASE = 100;
    // A rule's regex is rejected once its compiled form passes 2KB, which one
    // alternation of every reserved name does. Small chunks stay well inside it.
    const RESERVED_NAMES_PER_RULE = 8;
    const MAX_RESERVED_RULES = 8;
    const MAX_NAME_LENGTH = 100;

    const compiledPatterns = new Map();

    // The extension may only touch hosts it declared in the manifest, so the
    // permission list stays the one source of truth for what a fetched table
    // is allowed to redirect.
    function allowedHosts() {
        const permissions = chrome.runtime.getManifest().host_permissions ?? [];
        return permissions
            .map((pattern) => /^[a-z]+:\/\/([^/]+)\//.exec(pattern)?.[1])
            .filter((host) => typeof host === "string");
    }

    function escapeRegex(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function countGroups(pattern) {
        return [...pattern.matchAll(/\((?!\?)/g)].length;
    }

    function isSafePattern(pattern) {
        if (typeof pattern !== "string") return false;
        const tooLong = pattern.length > MAX_PATTERN_LENGTH;
        if (pattern.length === 0 || tooLong) return false;
        if (!pattern.startsWith("^") || !pattern.endsWith("$")) return false;
        // RE2 (declarativeNetRequest) has no lookarounds or backreferences, and
        // a quantifier on a group is how a fetched table could make a page hang.
        if (/\(\?[=!<]|\\\d/.test(pattern)) return false;
        if (/\)[*+?{]/.test(pattern)) return false;
        return true;
    }

    function isSafeTemplate(template, groups) {
        if (typeof template !== "string") return false;
        if (!template.startsWith("/") || template.length > MAX_PATTERN_LENGTH) {
            return false;
        }
        for (const [, index] of template.matchAll(/\$(\d)/g)) {
            const position = Number(index);
            if (position < 1 || position > groups) return false;
        }
        return true;
    }

    function isStringArray(value) {
        return (
            Array.isArray(value) && value.every((v) => typeof v === "string")
        );
    }

    /**
     * Accepts a table from storage or the network. Anything unexpected is
     * rejected as a whole: a partially applied table would redirect some pages
     * and not others, which is harder to explain than falling back.
     */
    function sanitizeTable(candidate) {
        if (!candidate || typeof candidate !== "object") return null;
        if (candidate.version !== SUPPORTED_TABLE_VERSION) return null;
        if (!Array.isArray(candidate.platforms)) return null;
        if (!Array.isArray(candidate.rules)) return null;
        const ruleCount = candidate.rules.length;
        if (ruleCount === 0 || ruleCount > MAX_RULES) return null;

        const hosts = allowedHosts();
        const platforms = [];
        for (const platform of candidate.platforms) {
            if (!platform || typeof platform !== "object") return null;
            const { host, provider, reserved } = platform;
            if (typeof host !== "string") return null;
            if (!hosts.includes(host)) return null;
            if (typeof provider !== "string") return null;
            if (!isStringArray(reserved)) return null;
            platforms.push({ host, provider, reserved });
        }
        if (platforms.length === 0) return null;

        const known = new Set(platforms.map((p) => p.host));
        const rules = [];
        for (const rule of candidate.rules) {
            const sanitized = sanitizeRule(rule, known);
            if (!sanitized) return null;
            rules.push(sanitized);
        }

        return { version: SUPPORTED_TABLE_VERSION, platforms, rules };
    }

    /**
     * Accepts one rule of a fetched table, or null when it is malformed.
     */
    function sanitizeRule(rule, known) {
        if (!rule || typeof rule !== "object") return null;
        if (typeof rule.id !== "string" || rule.id.length === 0) return null;
        if (typeof rule.host !== "string" || !known.has(rule.host)) return null;
        if (typeof rule.provider !== "string") return null;
        if (!isSafePattern(rule.pattern)) return null;
        const groups = countGroups(rule.pattern);
        if (groups === 0) return null;
        if (!isSafeTemplate(rule.to, groups)) return null;
        if (!isSafeTemplate(rule.external, groups)) return null;
        const tailGroup = rule.tailGroup;
        const tailInRange =
            tailGroup === undefined ||
            (Number.isInteger(tailGroup) &&
                tailGroup >= 1 &&
                tailGroup <= groups);
        if (!tailInRange) return null;
        return {
            id: rule.id,
            host: rule.host,
            provider: rule.provider,
            pattern: rule.pattern,
            to: rule.to,
            external: rule.external,
            query: rule.query === true,
            hash: rule.hash === true,
            tailGroup,
        };
    }

    function bakedTable() {
        return sanitizeTable(globalThis.NEOSRC_ROUTE_BUNDLE?.table);
    }

    function routeTablePath() {
        return globalThis.NEOSRC_ROUTE_BUNDLE?.path ?? "/api/extension/routes";
    }

    /**
     * Origin to use for a stored Neosrc URL, or null when it cannot be used.
     * Every script that builds a Neosrc URL or asks for host access goes
     * through this, so a typo in the popup cannot produce a broken target.
     */
    function originOf(value) {
        try {
            const url = new URL(value);
            if (url.protocol === "https:" || url.protocol === "http:") {
                return url.origin;
            }
        } catch {
            // Not a URL at all.
        }
        return null;
    }

    /**
     * Origins the app may answer from. Deployments commonly redirect one to the
     * other, and a redirect drops the request header the extension set on the
     * first hop, so both have to be matched for the app to know the visit came
     * from here.
     */
    function originVariants(origin) {
        const base = origin.replace(/\/$/, "");
        let url;
        try {
            url = new URL(base);
        } catch {
            return [base];
        }
        const host = url.hostname;
        const port = url.port ? `:${url.port}` : "";
        // localhost, IP addresses and the browser's own single-label hosts have
        // no www counterpart worth requesting access to.
        if (!host.includes(".") || /^[\d.]+$/.test(host)) return [base];
        if (host.startsWith("www.")) {
            return [base, `${url.protocol}//${host.slice(4)}${port}`];
        }
        return [base, `${url.protocol}//www.${host}${port}`];
    }

    function findPlatform(table, host) {
        const normalized = String(host)
            .replace(/^www\./, "")
            .toLowerCase();
        return (
            table.platforms.find((platform) => platform.host === normalized) ??
            null
        );
    }

    function isReserved(platform, pathname) {
        const owner = pathname.split("/")[1];
        return owner !== undefined && platform.reserved.includes(owner);
    }

    /** Matches a host path against the table, e.g. "/acme/widget/pull/12". */
    function matchPath(table, host, pathname) {
        const platform = findPlatform(table, host);
        if (!platform || isReserved(platform, pathname)) return null;

        for (const rule of table.rules) {
            if (rule.host !== platform.host) continue;
            let regex = compiledPatterns.get(rule.pattern);
            if (!regex) {
                regex = new RegExp(rule.pattern, "i");
                compiledPatterns.set(rule.pattern, regex);
            }
            const match = regex.exec(pathname);
            if (match) return { rule, groups: match.slice(1) };
        }
        return null;
    }

    /** Builds the Neosrc URL for a matched host URL. */
    function buildTargetUrl(origin, match, url) {
        const base = origin.replace(/\/$/, "");
        const path = match.rule.to.replace(
            /\$(\d)/g,
            (_, index) => match.groups[Number(index) - 1] ?? "",
        );
        const query = match.rule.query && url.search ? url.search : "";
        const hash = match.rule.hash && url.hash ? url.hash : "";
        return `${base}${path}${query}${hash}`;
    }

    function hasExitParam(url) {
        return url.searchParams.has(EXIT_PARAM);
    }

    function redirectRule(id, rule, origin) {
        const body = rule.pattern.replace(/^\^/, "").replace(/\$$/, "");
        const groups = countGroups(rule.pattern);
        let next = groups + 1;
        let queryIndex = 0;
        let hashIndex = 0;
        let suffix = "";
        if (rule.query) {
            queryIndex = next++;
            suffix += "(\\?[^#]*)?";
        } else {
            suffix += "(?:\\?[^#]*)?";
        }
        if (rule.hash) {
            hashIndex = next++;
            suffix += "(#.*)?";
        } else {
            suffix += "(?:#.*)?";
        }

        let substitution = `${origin.replace(/\/$/, "")}${rule.to.replace(
            /\$(\d)/g,
            (_, index) => `\\${index}`,
        )}`;
        if (queryIndex > 0) substitution += `\\${queryIndex}`;
        if (hashIndex > 0) substitution += `\\${hashIndex}`;

        return {
            id,
            priority: 1,
            action: {
                type: "redirect",
                redirect: { regexSubstitution: substitution },
            },
            condition: {
                regexFilter: `^https://(?:www\\.)?${escapeRegex(rule.host)}${body}${suffix}$`,
                resourceTypes: ["main_frame"],
            },
        };
    }

    function allowRule(id, priority, regexFilter, extraCondition) {
        return {
            id,
            priority,
            action: { type: "allow" },
            condition: {
                regexFilter,
                resourceTypes: ["main_frame"],
                ...extraCondition,
            },
        };
    }

    /**
     * Every dynamic rule the extension owns. `allow` rules win over `redirect`
     * at equal priority, which is how exited, reserved and excluded URLs stay
     * on GitHub.
     */
    function buildRules(table, origin, options) {
        const { extensionVersion, excludedOwners = [] } = options ?? {};
        const rules = [];
        for (const platform of table.platforms) {
            const host = `^https://(?:www\\.)?${escapeRegex(platform.host)}`;
            rules.push(
                allowRule(
                    EXIT_ALLOW_RULE_ID,
                    2,
                    `${host}/[^#]*[?&]${EXIT_PARAM}`,
                ),
            );
            const reserved = platform.reserved
                .filter(
                    (name) =>
                        typeof name === "string" &&
                        name.length > 0 &&
                        name.length <= MAX_NAME_LENGTH,
                )
                .slice(0, RESERVED_NAMES_PER_RULE * MAX_RESERVED_RULES);
            for (
                let index = 0;
                index < reserved.length;
                index += RESERVED_NAMES_PER_RULE
            ) {
                const names = reserved
                    .slice(index, index + RESERVED_NAMES_PER_RULE)
                    .map(escapeRegex)
                    .join("|");
                rules.push(
                    allowRule(
                        RESERVED_ALLOW_RULE_ID_BASE +
                            index / RESERVED_NAMES_PER_RULE,
                        1,
                        `${host}/(?:${names})(?:/|$)`,
                    ),
                );
            }

            excludedOwners
                .filter(
                    (owner) =>
                        typeof owner === "string" &&
                        owner.length > 0 &&
                        owner.length <= MAX_NAME_LENGTH,
                )
                .slice(0, MAX_OWNER_RULES)
                .forEach((owner, index) => {
                    rules.push(
                        allowRule(
                            OWNER_ALLOW_RULE_ID_BASE + index,
                            2,
                            `${host}/${escapeRegex(owner)}(?:/|$)`,
                            // Owners are stored lowercased; GitHub logins are
                            // case insensitive.
                            { isUrlFilterCaseSensitive: false },
                        ),
                    );
                });
        }

        const permittedOrigins =
            typeof extensionVersion === "string" && extensionVersion.length > 0
                ? (options?.permittedOrigins ?? [])
                : [];
        for (const [index, permitted] of permittedOrigins
            .slice(0, MAX_HEADER_RULES)
            .entries()) {
            rules.push({
                id: EXTENSION_HEADER_RULE_ID_BASE + index,
                priority: 1,
                action: {
                    type: "modifyHeaders",
                    requestHeaders: [
                        {
                            header: EXTENSION_HEADER,
                            operation: "set",
                            value: extensionVersion,
                        },
                    ],
                },
                condition: {
                    regexFilter: `^${escapeRegex(permitted.replace(/\/$/, ""))}/`,
                    resourceTypes: ["main_frame"],
                },
            });
        }

        let id = REDIRECT_RULE_ID_BASE;
        for (const rule of table.rules) {
            rules.push(redirectRule(id, rule, origin));
            id += 1;
        }
        return rules;
    }

    /**
     * Per-tab allow rules for pages the user already landed back on GitHub
     * from, so a reload keeps them on GitHub instead of bouncing through
     * Neosrc again. Session scoped: a browser restart clears them.
     */
    function buildSessionRules(entries) {
        return entries.slice(-MAX_SESSION_RULES).map((entry, index) => ({
            id: index + 1,
            priority: 2,
            action: { type: "allow" },
            condition: {
                regexFilter: `^https://(?:www\\.)?${escapeRegex(entry.host)}${escapeRegex(entry.pathname)}(?:[?#]|$)`,
                resourceTypes: ["main_frame"],
                tabIds: [entry.tabId],
            },
        }));
    }

    globalThis.NeosrcRoutes = {
        EXIT_PARAM,
        EXIT_ALLOW_RULE_ID,
        EXTENSION_HEADER_RULE_ID_BASE,
        RESERVED_ALLOW_RULE_ID_BASE,
        OWNER_ALLOW_RULE_ID_BASE,
        REDIRECT_RULE_ID_BASE,
        MAX_SESSION_RULES,
        sanitizeTable,
        bakedTable,
        routeTablePath,
        originOf,
        originVariants,
        matchPath,
        buildTargetUrl,
        hasExitParam,
        buildRules,
        buildSessionRules,
    };
})();
