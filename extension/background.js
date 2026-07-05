console.log("[Neosrc BG] service worker started");

const RULE_ID = 1;
const DEFAULT_NEOSRC_URL = "https://neosrc.dev";
const DEFAULT_EXCLUDED_OWNERS = [];

function escapeRe2(s) {
    return s.replace(/[\\^$.*+?(){}[\]|/]/g, "\\$&");
}

function buildExcludedRegexFilter(excludedOwners) {
    const parts = ["[?&]neosrc_exit"];
    if (excludedOwners.length > 0) {
        const ownersPattern = excludedOwners.map(escapeRe2).join("|");
        parts.push(`^https://github\\.com/(${ownersPattern})/`);
    }
    return parts.join("|");
}

function buildDnrRule(neosrcUrl, excludedOwners) {
    const url = new URL(neosrcUrl);
    const scheme = url.protocol.replace(":", "");
    const host = url.hostname;
    const port = url.port || "";
    const excludedRegexFilter = buildExcludedRegexFilter(excludedOwners);

    if (scheme === "http" && host === "localhost" && port === "3000") {
        return {
            id: RULE_ID,
            priority: 1,
            action: {
                type: "redirect",
                redirect: {
                    transform: {
                        scheme: "http",
                        host: "localhost",
                        port: "3000",
                    },
                },
            },
            condition: {
                urlFilter: "https://github.com/*/pull/*",
                resourceTypes: ["main_frame"],
                excludedRegexFilter,
            },
        };
    }

    const substitutionUrl = `${scheme}://${host}${port ? `:${port}` : ""}`;
    return {
        id: RULE_ID,
        priority: 1,
        action: {
            type: "redirect",
            redirect: {
                regexSubstitution: `${substitutionUrl}\\1\\2`,
            },
        },
        condition: {
            regexFilter: "^https://github\\.com(/[^/]+/[^/]+/pull/\\d+)(/.*)?$",
            resourceTypes: ["main_frame"],
            excludedRegexFilter,
        },
    };
}

async function syncSession(enabled, neosrcUrl, excludedOwners) {
    try {
        await chrome.storage.session.set({
            enabled: enabled === true,
            neosrcUrl: neosrcUrl || DEFAULT_NEOSRC_URL,
            excludedOwners: excludedOwners || DEFAULT_EXCLUDED_OWNERS,
        });
    } catch (err) {
        console.error("[Neosrc BG] failed to sync session:", err);
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

async function updateRules(enabled, neosrcUrl, excludedOwners) {
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [RULE_ID],
        });

        if (!enabled) {
            console.log("[Neosrc BG] DNR rule removed (disabled)");
            setBadge(false);
            return;
        }

        const rule = buildDnrRule(neosrcUrl, excludedOwners);
        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [rule],
        });
        console.log(
            "[Neosrc BG] DNR rule added (enabled) — redirecting github.com PRs to",
            neosrcUrl,
            "excluding owners:",
            excludedOwners,
        );
        setBadge(true);
    } catch (err) {
        console.error("[Neosrc BG] failed to update DNR rules:", err);
    }
    syncSession(enabled, neosrcUrl, excludedOwners);
}

async function init() {
    const result = await chrome.storage.sync.get([
        "enabled",
        "neosrcUrl",
        "excludedOwners",
    ]);
    const enabled = result.enabled === true;
    const neosrcUrl = result.neosrcUrl || DEFAULT_NEOSRC_URL;
    const excludedOwners = result.excludedOwners || DEFAULT_EXCLUDED_OWNERS;
    console.log(
        "[Neosrc BG] init: enabled =",
        enabled,
        "neosrcUrl =",
        neosrcUrl,
        "excludedOwners =",
        excludedOwners,
    );
    await updateRules(enabled, neosrcUrl, excludedOwners);
}

chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);

chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "sync") return;

    const result = await chrome.storage.sync.get([
        "enabled",
        "neosrcUrl",
        "excludedOwners",
    ]);
    const enabled = result.enabled === true;
    const neosrcUrl = result.neosrcUrl || DEFAULT_NEOSRC_URL;
    const excludedOwners = result.excludedOwners || DEFAULT_EXCLUDED_OWNERS;

    if (changes.enabled || changes.neosrcUrl || changes.excludedOwners) {
        console.log(
            "[Neosrc BG] storage changed — re-applying DNR rule:",
            "enabled =",
            enabled,
            "neosrcUrl =",
            neosrcUrl,
            "excludedOwners =",
            excludedOwners,
        );
        await updateRules(enabled, neosrcUrl, excludedOwners);
    }
});

init();
