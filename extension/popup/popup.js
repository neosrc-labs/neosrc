console.log("[Neosrc Popup] popup opened");

const DEFAULT_NEOSRC_URL = "https://neosrc.dev";
const DEFAULT_EXCLUDED_OWNERS = [];

const toggle = document.getElementById("toggle");
const status = document.getElementById("status");
const urlInput = document.getElementById("neosrcUrl");
const excludeInput = document.getElementById("excludeInput");
const addExcludeBtn = document.getElementById("addExcludeBtn");
const excludedTags = document.getElementById("excludedTags");

let previousUrl = DEFAULT_NEOSRC_URL;
let excludedOwners = DEFAULT_EXCLUDED_OWNERS;

function renderTags() {
    excludedTags.innerHTML = "";
    for (const owner of excludedOwners) {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = owner;

        const removeBtn = document.createElement("button");
        removeBtn.className = "tag-remove";
        removeBtn.textContent = "×";
        removeBtn.title = `Remove ${owner}`;
        removeBtn.addEventListener("click", () => removeOwner(owner));
        tag.appendChild(removeBtn);
        excludedTags.appendChild(tag);
    }
}

async function saveExcludedOwners() {
    await chrome.storage.sync.set({ excludedOwners });
}

function addOwner() {
    const value = excludeInput.value.trim().toLowerCase();
    if (!value) return;
    if (excludedOwners.includes(value)) {
        excludeInput.value = "";
        return;
    }
    excludedOwners.push(value);
    excludeInput.value = "";
    renderTags();
    saveExcludedOwners();
}

function removeOwner(owner) {
    excludedOwners = excludedOwners.filter((o) => o !== owner);
    renderTags();
    saveExcludedOwners();
}

addExcludeBtn.addEventListener("click", addOwner);
excludeInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addOwner();
});

async function updateUI() {
    console.log("[Neosrc Popup] updateUI: reading settings from storage");
    const result = await chrome.storage.sync.get([
        "enabled",
        "neosrcUrl",
        "excludedOwners",
    ]);
    const enabled = result.enabled === true;
    const neosrcUrl = result.neosrcUrl || DEFAULT_NEOSRC_URL;
    excludedOwners = result.excludedOwners || DEFAULT_EXCLUDED_OWNERS;
    previousUrl = neosrcUrl;
    console.log(
        "[Neosrc Popup] updateUI: enabled =",
        enabled,
        "neosrcUrl =",
        neosrcUrl,
        "excludedOwners =",
        excludedOwners,
    );
    toggle.checked = enabled;
    urlInput.value = neosrcUrl;
    status.textContent = enabled
        ? "Enabled — redirecting PRs to Neosrc"
        : "Disabled — showing Neosrc button only";
    renderTags();
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
    if (area === "sync" && (changes.enabled || changes.excludedOwners)) {
        console.log(
            "[Neosrc Popup] syncing UI from storage change:",
            changes.enabled.newValue,
        );
        updateUI();
    }
});

updateUI();
