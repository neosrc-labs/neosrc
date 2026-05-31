console.log("[Neosrc BG] service worker started");

const RULE_ID = 1;
const DEFAULT_NEOSRC_URL = "http://localhost:3000";

function buildDnrRule(neosrcUrl) {
    const url = new URL(neosrcUrl);
    const scheme = url.protocol.replace(":", "");
    const host = url.hostname;
    const port = url.port || "";

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
                excludedRegexFilter: "[?&]neosrc_exit",
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
            excludedRegexFilter: "[?&]neosrc_exit",
        },
    };
}

function setBadge(enabled) {
    if (enabled) {
        chrome.action.setBadgeText({ text: "ON" });
        chrome.action.setBadgeBackgroundColor({ color: "#0969da" });
    } else {
        chrome.action.setBadgeText({ text: "" });
    }
}

async function updateRules(enabled, neosrcUrl) {
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [RULE_ID],
        });

        if (!enabled) {
            console.log("[Neosrc BG] DNR rule removed (disabled)");
            setBadge(false);
            return;
        }

        const rule = buildDnrRule(neosrcUrl);
        await chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [rule],
        });
        console.log(
            "[Neosrc BG] DNR rule added (enabled) — redirecting github.com PRs to",
            neosrcUrl,
        );
        setBadge(true);
    } catch (err) {
        console.error("[Neosrc BG] failed to update DNR rules:", err);
    }
}

async function init() {
    const result = await chrome.storage.sync.get(["enabled", "neosrcUrl"]);
    const enabled = result.enabled === true;
    const neosrcUrl = result.neosrcUrl || DEFAULT_NEOSRC_URL;
    console.log(
        "[Neosrc BG] init: enabled =",
        enabled,
        "neosrcUrl =",
        neosrcUrl,
    );
    await updateRules(enabled, neosrcUrl);
}

chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);

chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "sync") return;

    const result = await chrome.storage.sync.get(["enabled", "neosrcUrl"]);
    const enabled = result.enabled === true;
    const neosrcUrl = result.neosrcUrl || DEFAULT_NEOSRC_URL;

    if (changes.enabled || changes.neosrcUrl) {
        console.log(
            "[Neosrc BG] storage changed — re-applying DNR rule:",
            "enabled =",
            enabled,
            "neosrcUrl =",
            neosrcUrl,
        );
        await updateRules(enabled, neosrcUrl);
    }
});

init();
