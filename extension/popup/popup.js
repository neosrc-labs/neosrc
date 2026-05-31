console.log("[Neosrc Popup] popup opened");

const toggle = document.getElementById("toggle");
const status = document.getElementById("status");

async function updateUI() {
	console.log("[Neosrc Popup] updateUI: reading enabled from storage");
	const result = await chrome.storage.sync.get("enabled");
	const enabled = result.enabled !== false;
	console.log("[Neosrc Popup] updateUI: enabled =", enabled);
	toggle.checked = enabled;
	status.textContent = enabled
		? "Enabled — redirecting PRs to Neosrc"
		: "Disabled — showing Neosrc button only";
}

toggle.addEventListener("change", async () => {
	const enabled = toggle.checked;
	console.log("[Neosrc Popup] toggle changed to:", enabled);
	await chrome.storage.sync.set({ enabled });
	console.log("[Neosrc Popup] storage.sync.set({ enabled:", enabled, "}) done");
	status.textContent = enabled
		? "Enabled — redirecting PRs to Neosrc"
		: "Disabled — showing Neosrc button only";
});

chrome.storage.onChanged.addListener((changes, area) => {
	console.log("[Neosrc Popup] storage.onChanged: area =", area, "changes =", changes);
	if (area === "sync" && changes.enabled) {
		console.log("[Neosrc Popup] syncing UI from storage change:", changes.enabled.newValue);
		updateUI();
	}
});

updateUI();
