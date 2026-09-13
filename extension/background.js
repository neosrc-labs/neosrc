// Service worker: owns settings, the route table and the declarativeNetRequest
// rules. Redirect decisions happen here (or in content.js for in-page
// navigations), and the extension only redirects pages the app publishes.
importScripts("routes.generated.js", "lib/route-table.js");

const ROUTES = globalThis.NeosrcRoutes;

const DEFAULT_NEOSRC_URL = "https://neosrc.dev";
const TABLE_REFRESH_ALARM = "neosrc-refresh-routes";
const TABLE_REFRESH_MINUTES = 12 * 60;
const EXITED_PATHS_KEY = "exitedPaths";

async function readSettings() {
    const stored = await chrome.storage.sync.get([
        "enabled",
        "neosrcUrl",
        "excludedOwners",
    ]);
    return {
        enabled: stored.enabled === true,
        // Falls back to the default rather than handing an unusable origin to
        // the rule builder, which would leave the extension with no rules.
        neosrcUrl: ROUTES.originOf(stored.neosrcUrl) ?? DEFAULT_NEOSRC_URL,
        excludedOwners: stored.excludedOwners || [],
    };
}

function originPattern(neosrcUrl) {
    // Match patterns reject ports; the host permission covers every port.
    const url = new URL(neosrcUrl);
    return `${url.protocol}//${url.hostname}/*`;
}

/**
 * Variants of the configured origin the extension is allowed to touch. Without
 * host access the app cannot be told that a visit came from here, and its
 * canonical-host redirect would drop the header anyway.
 */
async function permittedOrigins(neosrcUrl) {
    const checks = await Promise.all(
        ROUTES.originVariants(neosrcUrl).map(async (origin) => ({
            origin,
            granted: await chrome.permissions.contains({
                origins: [originPattern(origin)],
            }),
        })),
    );
    return checks.filter((check) => check.granted).map((check) => check.origin);
}

/** Table previously fetched from the app, or null when there is none. */
async function readCachedTable() {
    const stored = await chrome.storage.local.get(["routeTable"]);
    return ROUTES.sanitizeTable(stored.routeTable);
}

async function refreshRouteTable(neosrcUrl) {
    try {
        const response = await fetch(
            `${neosrcUrl.replace(/\/$/, "")}${ROUTES.routeTablePath()}`,
            // A dev server or a deployment that never answers must not hold
            // up whatever is queued behind this.
            { cache: "no-store", signal: AbortSignal.timeout(5_000) },
        );
        if (!response.ok) return null;
        const table = ROUTES.sanitizeTable(await response.json());
        if (!table) {
            console.warn("[Neosrc] ignoring route table the app published");
            return null;
        }
        await chrome.storage.local.set({ routeTable: table });
        return table;
    } catch (error) {
        console.warn("[Neosrc] route table refresh failed:", error);
        return null;
    }
}

function setBadge(enabled) {
    if (enabled) {
        chrome.action.setBadgeText({ text: "ON" });
        chrome.action.setBadgeBackgroundColor({ color: "#0969da" });
    } else {
        chrome.action.setBadgeText({ text: "" });
    }
}

/**
 * Drops rules whose regex the browser cannot compile. One rejected rule rejects
 * the whole `updateDynamicRules` call, so an unsupported pattern from a fetched
 * table must not be able to turn every redirect off.
 */
async function installableRules(rules) {
    const checks = await Promise.all(
        rules.map(async (rule) => {
            const result = await chrome.declarativeNetRequest.isRegexSupported({
                regex: rule.condition.regexFilter,
                isCaseSensitive:
                    rule.condition.isUrlFilterCaseSensitive !== false,
                requireCapturing: rule.action.type === "redirect",
            });
            if (result.isSupported) return rule;
            console.warn(
                "[Neosrc] dropping unsupported rule",
                rule.id,
                result.reason,
            );
            return null;
        }),
    );
    return checks.filter((rule) => rule !== null);
}

async function installRules(settings, table) {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    const removeRuleIds = existing.map((rule) => rule.id);

    if (!settings.enabled) {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds,
        });
        setBadge(false);
        return;
    }

    const headerOrigins = await permittedOrigins(settings.neosrcUrl);
    if (headerOrigins.length === 0) {
        // Without the header the app cannot tell an extension-driven visit from
        // a direct one, so pages it cannot serve would show its 404 instead of
        // returning to GitHub.
        console.warn(
            "[Neosrc] no host permission for",
            settings.neosrcUrl,
            "- falling back without the extension header",
        );
    }

    const rules = ROUTES.buildRules(table, settings.neosrcUrl, {
        excludedOwners: settings.excludedOwners,
        extensionVersion: chrome.runtime.getManifest().version,
        permittedOrigins: headerOrigins,
    });
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds,
            addRules: await installableRules(rules),
        });
    } catch (error) {
        // Belt and braces: the redirects are the part worth keeping, so try
        // again without everything else.
        console.error(
            "[Neosrc] rule set rejected, installing redirects only:",
            error,
        );
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds,
            addRules: rules.filter((rule) => rule.action.type === "redirect"),
        });
    }
    setBadge(true);
}

/** Pages the user was handed back to GitHub for, per tab, until the tab closes. */
async function readExitedPaths() {
    const stored = await chrome.storage.session.get(EXITED_PATHS_KEY);
    return Array.isArray(stored[EXITED_PATHS_KEY])
        ? stored[EXITED_PATHS_KEY]
        : [];
}

async function installSessionRules() {
    const entries = await readExitedPaths();
    const existing = await chrome.declarativeNetRequest.getSessionRules();
    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: existing.map((rule) => rule.id),
        addRules: ROUTES.buildSessionRules(entries),
    });
}

async function rememberExitedPath(tabId, host, pathname) {
    const entries = await readExitedPaths();
    const kept = entries
        .filter((entry) => entry.tabId !== tabId || entry.pathname !== pathname)
        .slice(1 - ROUTES.MAX_SESSION_RULES);
    kept.push({ tabId, host, pathname });
    await chrome.storage.session.set({ [EXITED_PATHS_KEY]: kept });
    await installSessionRules();
}

async function forgetTab(tabId) {
    const entries = await readExitedPaths();
    const kept = entries.filter((entry) => entry.tabId !== tabId);
    if (kept.length === entries.length) return;
    await chrome.storage.session.set({ [EXITED_PATHS_KEY]: kept });
    await installSessionRules();
}

/**
 * Rule installs run one at a time, in the order they were requested. The worker
 * applies stored settings on startup while a settings change can arrive at the
 * same moment, and an older install landing last would leave the wrong rules on
 * (or none at all).
 */
let pendingApply = Promise.resolve();

function queueApply(run) {
    pendingApply = pendingApply.then(run, run);
    return pendingApply.catch((error) =>
        console.error("[Neosrc] apply failed:", error),
    );
}

/** Reads settings inside the queue so the newest ones win. */
function applyStoredSettings({ refresh }) {
    const applied = queueApply(async () => {
        const settings = await readSettings();
        const table = await readCachedTable();
        // Redirects go in immediately from what is already known; waiting on a
        // round trip to the app would leave the browser unredirected meanwhile.
        await installRules(settings, table ?? ROUTES.bakedTable());
    });

    if (refresh) {
        queueApply(async () => {
            const settings = await readSettings();
            const table = await refreshRouteTable(settings.neosrcUrl);
            if (table) await installRules(settings, table);
        });
    }

    return applied;
}

function initialize({ refresh = false } = {}) {
    const applied = applyStoredSettings({ refresh });
    queueApply(() => installSessionRules());
    chrome.alarms.create(TABLE_REFRESH_ALARM, {
        periodInMinutes: TABLE_REFRESH_MINUTES,
    });
    return applied;
}

chrome.runtime.onStartup.addListener(() => initialize({ refresh: true }));
chrome.runtime.onInstalled.addListener(() => initialize({ refresh: true }));

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === TABLE_REFRESH_ALARM) {
        applyStoredSettings({ refresh: true });
    }
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    if (!changes.enabled && !changes.neosrcUrl && !changes.excludedOwners) {
        return;
    }
    applyStoredSettings({ refresh: Boolean(changes.neosrcUrl) });
});

chrome.tabs.onRemoved.addListener((tabId) => {
    queueApply(() => forgetTab(tabId));
});

// Granting or revoking host access for the Neosrc origin adds or removes the
// header rule, which is what lets the app send un-servable pages back.
chrome.permissions.onAdded.addListener(() =>
    applyStoredSettings({ refresh: false }),
);
chrome.permissions.onRemoved.addListener(() =>
    applyStoredSettings({ refresh: false }),
);

chrome.runtime.onMessage.addListener((message, sender) => {
    if (message?.type !== "neosrc-exit") return;
    const tabId = sender.tab?.id;
    if (tabId === undefined) return;
    queueApply(() => rememberExitedPath(tabId, message.host, message.pathname));
});

initialize();
