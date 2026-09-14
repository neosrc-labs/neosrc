import type { Provider } from "~/utils/provider-url";

/**
 * URL contract between the git host (github.com) and Neosrc.
 *
 * The browser extension needs to know which host URLs Neosrc can serve, and the
 * app needs to map a Neosrc URL back to the host page when it cannot serve a
 * request (see `src/server/extension-fallback.ts`). Both read this module, and
 * `scripts/generate-extension-routes.ts` bakes it into the extension so the
 * redirect survives an offline service worker.
 */

export interface ExtensionRouteRule {
    /** Stable id, used for logging and test failures. */
    id: string;
    /** Host this rule applies to. */
    host: string;
    /** Provider prefix the host maps to. */
    provider: Provider;
    /**
     * Host-relative path pattern used to detect a supported URL. Anchored,
     * and restricted to RE2 syntax because it also becomes a declarativeNetRequest
     * `regexFilter` (no lookarounds, no backreferences).
     */
    pattern: string;
    /** Neosrc path template; `$1`..`$9` are `pattern` capture groups. */
    to: string;
    /** Host path template the Neosrc path maps back to; same `$n` capture order. */
    external: string;
    /** Forward the source query string (list filters, pagination). */
    query?: boolean;
    /** Forward the source fragment (comment and diff deep links). */
    hash?: boolean;
    /**
     * 1-based capture group whose value spans the remaining path segments, so
     * a multi-segment tail survives the round trip. Every other group is a
     * single segment.
     */
    tailGroup?: number;
}

export interface ExtensionPlatform {
    host: string;
    provider: Provider;
    /**
     * First path segments that are GitHub routes rather than account names.
     * `/settings/profile` looks like `/{owner}/{repo}` but is not one.
     */
    reserved: string[];
}

/**
 * Bumped when the shape or meaning of the table changes, so an extension
 * holding a cached copy can tell it is stale.
 */
export const EXTENSION_ROUTE_TABLE_VERSION = 2;

/**
 * Where Neosrc serves the route table to the extension. The extension falls
 * back to the copy baked into the bundle, so this only exists to let route
 * coverage grow between store releases.
 */
export const EXTENSION_ROUTE_TABLE_PATH = "/api/extension/routes";

/**
 * Query parameter that marks a host URL as "the user is here on purpose, do not
 * redirect". Set by the extension when it hands a page back to the host, and by
 * the app's own "open on GitHub" links. Mirrored in extension/lib/route-table.js.
 */
export const EXTENSION_EXIT_PARAM = "neosrc_exit";

/**
 * Request header the extension sets on navigations to Neosrc, so the app can
 * tell an extension-driven visit (redirect it back when it cannot serve the
 * page) from a direct one (show the 404 UI).
 */
export const EXTENSION_REQUEST_HEADER = "x-neosrc-extension";

/**
 * GitHub reserves these top-level names, so no account can collide with them.
 * Everything here that is a 2+ segment path is a shape the repo rule would
 * otherwise claim: `/settings/profile` matched as owner `settings`.
 */
const GITHUB_RESERVED = [
    "about",
    "account",
    "admin",
    "apps",
    "authentication",
    "codespaces",
    "collections",
    "contact",
    "customer-stories",
    "dashboard",
    "discussions",
    "enterprise",
    "events",
    "explore",
    "features",
    "issues",
    "login",
    "logout",
    "marketplace",
    "new",
    "notifications",
    "organizations",
    "orgs",
    "pricing",
    "pulls",
    "readme",
    "search",
    "security",
    "sessions",
    "settings",
    "signup",
    "site",
    "sponsors",
    "topics",
    "trending",
    "users",
];

export const EXTENSION_PLATFORMS: ExtensionPlatform[] = [
    {
        host: "github.com",
        provider: "gh",
        reserved: GITHUB_RESERVED,
    },
];

/**
 * Route coverage. A host URL is redirected only when it matches one of these;
 * everything else (settings, actions, releases, wiki) stays on the host, which
 * is what keeps the extension from stranding users on a Neosrc 404.
 */
export const EXTENSION_ROUTE_RULES: ExtensionRouteRule[] = [
    {
        id: "gh-repo",
        host: "github.com",
        provider: "gh",
        pattern: "^/([^/]+)/([^/]+)/?$",
        to: "/gh/$1/$2",
        external: "/$1/$2",
    },
    {
        id: "gh-issues",
        host: "github.com",
        provider: "gh",
        pattern: "^/([^/]+)/([^/]+)/issues/?$",
        to: "/gh/$1/$2/issues",
        external: "/$1/$2/issues",
        query: true,
    },
    {
        id: "gh-issue",
        host: "github.com",
        provider: "gh",
        pattern: "^/([^/]+)/([^/]+)/issues/(\\d+)/?$",
        to: "/gh/$1/$2/issues/$3",
        external: "/$1/$2/issues/$3",
        hash: true,
    },
    {
        id: "gh-pulls",
        host: "github.com",
        provider: "gh",
        pattern: "^/([^/]+)/([^/]+)/pulls/?$",
        to: "/gh/$1/$2/pulls",
        external: "/$1/$2/pulls",
        query: true,
    },
    {
        id: "gh-pull",
        host: "github.com",
        provider: "gh",
        pattern: "^/([^/]+)/([^/]+)/pull/(\\d+)/?$",
        to: "/gh/$1/$2/pull/$3",
        external: "/$1/$2/pull/$3",
        hash: true,
    },
    {
        id: "gh-pull-files",
        host: "github.com",
        provider: "gh",
        pattern: "^/([^/]+)/([^/]+)/pull/(\\d+)/files/?$",
        to: "/gh/$1/$2/pull/$3/changes",
        external: "/$1/$2/pull/$3/files",
        hash: true,
    },
    {
        id: "gh-pull-commit",
        host: "github.com",
        provider: "gh",
        // [0-9a-f]{7,40} would be friendlier, but a bounded repeat that wide
        // pushes the compiled declarativeNetRequest regex past its memory limit.
        pattern:
            "^/([^/]+)/([^/]+)/pull/(\\d+)/commits/([0-9a-f]{7}[0-9a-f]*)/?$",
        to: "/gh/$1/$2/pull/$3/changes/$4",
        external: "/$1/$2/pull/$3/commits/$4",
        hash: true,
    },
    {
        id: "gh-commits",
        host: "github.com",
        provider: "gh",
        pattern: "^/([^/]+)/([^/]+)/commits/([^/?#]+)/?$",
        to: "/gh/$1/$2/commits/$3",
        external: "/$1/$2/commits/$3",
        query: true,
    },
    {
        id: "gh-tree",
        host: "github.com",
        provider: "gh",
        pattern: "^/([^/]+)/([^/]+)/tree/([^/?#]+)/?$",
        to: "/gh/$1/$2/tree/$3",
        external: "/$1/$2/tree/$3",
    },
    // No optional groups: the extension rejects a quantified group, so the
    // root case needs its own rule.
    {
        id: "gh-tree-path",
        host: "github.com",
        provider: "gh",
        pattern: "^/([^/]+)/([^/]+)/tree/([^/?#]+)/(.+)$",
        to: "/gh/$1/$2/tree/$3/$4",
        external: "/$1/$2/tree/$3/$4",
        tailGroup: 4,
    },
    {
        id: "gh-blob",
        host: "github.com",
        provider: "gh",
        pattern: "^/([^/]+)/([^/]+)/blob/([^/?#]+)/(.+)$",
        to: "/gh/$1/$2/blob/$3/$4",
        external: "/$1/$2/blob/$3/$4",
        tailGroup: 4,
    },
];

export interface ExtensionRouteTable {
    version: number;
    platforms: ExtensionPlatform[];
    rules: ExtensionRouteRule[];
}

export const EXTENSION_ROUTE_TABLE: ExtensionRouteTable = {
    version: EXTENSION_ROUTE_TABLE_VERSION,
    platforms: EXTENSION_PLATFORMS,
    rules: EXTENSION_ROUTE_RULES,
};

/** Stable serialization shared by the generator and the route handler. */
export function serializeExtensionRouteTable(): string {
    return JSON.stringify(EXTENSION_ROUTE_TABLE);
}

/**
 * Turns a path template into a match regex, treating `$n` as a single path
 * segment. `tailGroup` picks the one group that spans the remaining path
 * instead. Used to map a Neosrc path back to its host page.
 */
export function templateToRegex(template: string, tailGroup?: number): RegExp {
    const source = template
        .split(/(\$\d)/)
        .map((part) => {
            if (!/^\$\d$/.test(part)) {
                return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            }
            return Number(part.slice(1)) === tailGroup ? "(.*)" : "([^/]+)";
        })
        .join("");
    return new RegExp(`^${source}/?$`);
}

/** Replaces `$1`..`$9` in a template with the given capture groups. */
export function fillTemplate(template: string, groups: string[]): string {
    return template.replace(/\$(\d)/g, (_, index: string) => {
        return groups[Number(index) - 1] ?? "";
    });
}

export interface ExternalMatch {
    rule: ExtensionRouteRule;
    groups: string[];
}

export function findPlatform(host: string): ExtensionPlatform | null {
    const normalized = host.replace(/^www\./, "").toLowerCase();
    return (
        EXTENSION_PLATFORMS.find((platform) => platform.host === normalized) ??
        null
    );
}

/** True when the path's first segment is a host route, not an account. */
export function isReservedPath(
    platform: ExtensionPlatform,
    pathname: string,
): boolean {
    const owner = pathname.split("/")[1];
    return owner !== undefined && platform.reserved.includes(owner);
}

/** Matches a host path against the route table. */
export function matchExternalPath(
    host: string,
    pathname: string,
): ExternalMatch | null {
    const platform = findPlatform(host);
    if (!platform || isReservedPath(platform, pathname)) return null;

    for (const rule of EXTENSION_ROUTE_RULES) {
        if (rule.host !== platform.host) continue;
        const match = new RegExp(rule.pattern, "i").exec(pathname);
        if (match) {
            return { rule, groups: match.slice(1) };
        }
    }
    return null;
}

/**
 * Maps a Neosrc path back to the host page it stands for, or null when the
 * path is not part of the route table.
 */
export function externalUrlForNeosrcPath(pathname: string): string | null {
    for (const rule of EXTENSION_ROUTE_RULES) {
        const match = templateToRegex(rule.to, rule.tailGroup).exec(pathname);
        if (!match) continue;
        const platform = EXTENSION_PLATFORMS.find(
            (candidate) => candidate.provider === rule.provider,
        );
        if (!platform) continue;
        return `https://${platform.host}${fillTemplate(rule.external, match.slice(1))}`;
    }
    return null;
}
