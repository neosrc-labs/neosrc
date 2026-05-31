console.log("[Neosrc Popup] popup opened");

const DEFAULT_NEOSRC_URL = "http://localhost:3000";

const toggle = document.getElementById("toggle");
const status = document.getElementById("status");
const urlInput = document.getElementById("neosrcUrl");

let previousUrl = DEFAULT_NEOSRC_URL;

async function updateUI() {
    console.log("[Neosrc Popup] updateUI: reading settings from storage");
    const result = await chrome.storage.sync.get(["enabled", "neosrcUrl"]);
    const enabled = result.enabled === true;
    const neosrcUrl = result.neosrcUrl || DEFAULT_NEOSRC_URL;
    previousUrl = neosrcUrl;
    console.log(
        "[Neosrc Popup] updateUI: enabled =",
        enabled,
        "neosrcUrl =",
        neosrcUrl,
    );
    toggle.checked = enabled;
    urlInput.value = neosrcUrl;
    status.textContent = enabled
        ? "Enabled — redirecting PRs to Neosrc"
        : "Disabled — showing Neosrc button only";
}

toggle.addEventListener("change", async () => {
    const enabled = toggle.checked;
    console.log("[Neosrc Popup] toggle changed to:", enabled);
    await chrome.storage.sync.set({ enabled });
    status.textContent = enabled
        ? "Enabled — redirecting PRs to Neosrc"
        : "Disabled — showing Neosrc button only";
});

let urlSaveTimeout = null;
urlInput.addEventListener("input", () => {
    clearTimeout(urlSaveTimeout);
    urlSaveTimeout = setTimeout(async () => {
        const neosrcUrl = urlInput.value.trim() || DEFAULT_NEOSRC_URL;
        if (neosrcUrl === previousUrl) return;
        previousUrl = neosrcUrl;
        console.log("[Neosrc Popup] saving neosrcUrl:", neosrcUrl);
        await chrome.storage.sync.set({ neosrcUrl });
    }, 600);
});

chrome.storage.onChanged.addListener((changes, area) => {
    console.log(
        "[Neosrc Popup] storage.onChanged: area =",
        area,
        "changes =",
        changes,
    );
    if (area === "sync" && changes.enabled) {
        console.log(
            "[Neosrc Popup] syncing UI from storage change:",
            changes.enabled.newValue,
        );
        updateUI();
    }
});

updateUI();
