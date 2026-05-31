console.log("[Neosrc BG] service worker started");

const RULE_ID = 1;

async function updateRules(enabled) {
	await chrome.declarativeNetRequest.updateDynamicRules({
		removeRuleIds: [RULE_ID],
	});

	if (!enabled) {
		console.log("[Neosrc BG] DNR rule removed (disabled)");
		return;
	}

	await chrome.declarativeNetRequest.updateDynamicRules({
		addRules: [
			{
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
				},
			},
		],
	});
	console.log("[Neosrc BG] DNR rule added (enabled) — redirecting github.com PRs to localhost:3000");
}

async function init() {
	const result = await chrome.storage.sync.get("enabled");
	const enabled = result.enabled !== false;
	console.log("[Neosrc BG] init: enabled =", enabled);
	await updateRules(enabled);
}

chrome.runtime.onStartup.addListener(init);
chrome.runtime.onInstalled.addListener(init);

chrome.storage.onChanged.addListener(async (changes, area) => {
	if (area === "sync" && changes.enabled) {
		const enabled = changes.enabled.newValue;
		console.log("[Neosrc BG] storage.enabled changed to", enabled);
		await updateRules(enabled);
	}
});

init();
