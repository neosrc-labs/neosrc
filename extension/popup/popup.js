const ROUTES = globalThis.NeosrcRoutes;

const DEFAULT_NEOSRC_URL = "https://neosrc.dev";
const DEFAULT_EXCLUDED_OWNERS = [];

const toggle = document.getElementById("toggle");
const statusEl = document.getElementById("status");
const pageStatus = document.getElementById("pageStatus");
const grantAccess = document.getElementById("grantAccess");
const urlInput = document.getElementById("neosrcUrl");
const excludeInput = document.getElementById("excludeInput");
const addExcludeBtn = document.getElementById("addExcludeBtn");
const excludedTags = document.getElementById("excludedTags");

let previousUrl = DEFAULT_NEOSRC_URL;
let excludedOwners = DEFAULT_EXCLUDED_OWNERS;
let table = null;

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

function setStatusText(enabled) {
    statusEl.textContent = enabled
        ? "Enabled — supported GitHub pages open in Neosrc"
        : "Disabled — GitHub pages get an Open in Neosrc button";
}

function saveExcludedOwners() {
    return chrome.storage.sync.set({ excludedOwners });
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
excludeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") addOwner();
});

function permissionPattern(neosrcUrl) {
    const url = new URL(neosrcUrl);
    return `${url.protocol}//${url.hostname}/*`;
}

function permissionPatterns(neosrcUrl) {
    return ROUTES.originVariants(neosrcUrl).map(permissionPattern);
}

/**
 * Accepts what people type ("neosrc.dev", "localhost:3000") and returns the
 * origin to store, or null when there is nothing usable to save. Bare hostnames
 * default to https, except for a local dev server, which is plain http.
 */
function normalizeNeosrcUrl(value) {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;

    let candidate = trimmed;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
        const host = (trimmed.split("/")[0] ?? "").split(":")[0] ?? "";
        const local = ["localhost", "127.0.0.1", "[::1]"].includes(
            host.toLowerCase(),
        );
        candidate = `${local ? "http" : "https"}://${trimmed}`;
    }

    return ROUTES.originOf(candidate);
}

/** Shows whether the tab the popup was opened over is a page Neosrc serves. */
async function renderPageStatus() {
    pageStatus.textContent = "";
    pageStatus.className = "";
    if (!table) return;

    const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
    });
    if (!tab?.url) return;

    let url;
    try {
        url = new URL(tab.url);
    } catch {
        return;
    }
    const match = ROUTES.matchPath(table, url.hostname, url.pathname);
    pageStatus.textContent = match
        ? "This page: Neosrc"
        : "This page: GitHub (not covered by Neosrc)";
    pageStatus.className = match ? "page-status covered" : "page-status";
}

/** Neosrc needs host access to tell it when a redirect came from here. */
async function renderAccessStatus(neosrcUrl) {
    const patterns = permissionPatterns(neosrcUrl);
    const granted = await chrome.permissions.contains({ origins: patterns });
    grantAccess.hidden = granted;
    grantAccess.textContent = `Allow access to ${new URL(neosrcUrl).host}`;
    grantAccess.dataset.patterns = JSON.stringify(patterns);
}

grantAccess.addEventListener("click", async () => {
    const patterns = JSON.parse(grantAccess.dataset.patterns ?? "[]");
    const granted = await chrome.permissions.request({ origins: patterns });
    if (!granted) return;
    const neosrcUrl = normalizeNeosrcUrl(urlInput.value);
    if (neosrcUrl) await renderAccessStatus(neosrcUrl);
});

async function updateUI() {
    const [stored, local] = await Promise.all([
        chrome.storage.sync.get(["enabled", "neosrcUrl", "excludedOwners"]),
        chrome.storage.local.get(["routeTable"]),
    ]);
    const enabled = stored.enabled === true;
    const neosrcUrl =
        normalizeNeosrcUrl(String(stored.neosrcUrl ?? "")) ??
        DEFAULT_NEOSRC_URL;
    excludedOwners = stored.excludedOwners || DEFAULT_EXCLUDED_OWNERS;
    table = ROUTES.sanitizeTable(local.routeTable) ?? ROUTES.bakedTable();
    previousUrl = neosrcUrl;

    toggle.checked = enabled;
    urlInput.value = neosrcUrl;
    setStatusText(enabled);
    renderTags();
    await Promise.all([renderPageStatus(), renderAccessStatus(neosrcUrl)]);
}

toggle.addEventListener("change", async () => {
    const enabled = toggle.checked;
    await chrome.storage.sync.set({ enabled });
    setStatusText(enabled);
});

let urlSaveTimeout = null;
urlInput.addEventListener("input", () => {
    clearTimeout(urlSaveTimeout);
    urlSaveTimeout = setTimeout(async () => {
        const neosrcUrl = normalizeNeosrcUrl(urlInput.value);
        if (!neosrcUrl) {
            statusEl.textContent = "Enter a URL like https://neosrc.dev";
            return;
        }
        setStatusText(toggle.checked);
        if (neosrcUrl === previousUrl) return;
        previousUrl = neosrcUrl;
        await chrome.storage.sync.set({ neosrcUrl });
        await renderAccessStatus(neosrcUrl);
    }, 600);
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && (changes.enabled || changes.excludedOwners)) {
        updateUI();
    }
});

updateUI();
