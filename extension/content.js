const DEFAULT_NEOSRC_URL = "http://localhost:3000";
const DEFAULT_EXCLUDED_OWNERS = [];

let neosrcUrl = DEFAULT_NEOSRC_URL;
let enabled = false;
let excludedOwners = DEFAULT_EXCLUDED_OWNERS;

console.log("[Neosrc] content script loaded on:", window.location.href);
console.log(
    "[Neosrc] note: primary redirect handled by DNR at network level; content script is fallback for toggle-while-on-page",
);

async function loadSettings() {
    const result = await chrome.storage.sync.get([
        "enabled",
        "neosrcUrl",
        "excludedOwners",
    ]);
    neosrcUrl = result.neosrcUrl || DEFAULT_NEOSRC_URL;
    enabled = result.enabled === true;
    excludedOwners = result.excludedOwners || DEFAULT_EXCLUDED_OWNERS;
}

async function autoRedirect({ isManualToggle = false } = {}) {
    console.log("[Neosrc] autoRedirect check");

    if (!enabled) {
        console.log("[Neosrc] autoRedirect: disabled, skipping");
        return;
    }

    const path = window.location.pathname;
    console.log("[Neosrc] autoRedirect: path =", path);

    const match = path.match(/^\/[^/]+\/[^/]+\/pull\/\d+/);
    if (!match) {
        console.log(
            "[Neosrc] autoRedirect: path does not match PR pattern, skipping",
        );
        return;
    }

    const owner = path.split("/")[1];
    if (excludedOwners.includes(owner)) {
        console.log(
            "[Neosrc] autoRedirect: owner",
            owner,
            "is excluded, skipping redirect",
        );
        return;
    }

    const url = new URL(window.location.href);
    if (url.searchParams.has("neosrc_exit")) {
        url.searchParams.delete("neosrc_exit");
        window.history.replaceState({}, "", url);
        sessionStorage.setItem("neosrc_exit_session", "true");
        console.log("[Neosrc] autoRedirect: neosrc_exit param found, skipping");
        return;
    }

    if (!isManualToggle && sessionStorage.getItem("neosrc_exit_session")) {
        console.log(
            "[Neosrc] autoRedirect: active neosrc_exit session, skipping",
        );
        return;
    }

    const key = `neosrc_redirected:${path}`;
    try {
        if (sessionStorage.getItem(key)) {
            console.log(
                "[Neosrc] autoRedirect: already redirected this PR (sessionStorage), skipping",
            );
            return;
        }
        sessionStorage.setItem(key, "true");
    } catch {
        console.log(
            "[Neosrc] autoRedirect: sessionStorage unavailable, proceeding",
        );
    }

    const target = `${neosrcUrl}${path}`;
    console.log("[Neosrc] autoRedirect: redirecting to", target);
    window.location.href = target;
}

function findTitleEl() {
    console.log("[Neosrc] findTitleEl: looking for PR title heading");
    const main =
        document.querySelector('[role="main"]') ||
        document.querySelector("main");
    if (!main) {
        console.log("[Neosrc] findTitleEl: no <main> element found");
        return null;
    }

    for (const h of main.querySelectorAll("h1")) {
        if (h.offsetParent !== null) {
            console.log("[Neosrc] findTitleEl: found visible h1");
            return h;
        }
    }

    for (const h of main.querySelectorAll("h2")) {
        if (h.offsetParent !== null) {
            console.log("[Neosrc] findTitleEl: found visible h2");
            return h;
        }
    }

    console.log("[Neosrc] findTitleEl: no visible h1/h2 found");
    return null;
}

function injectButton() {
    if (document.querySelector("[data-neosrc-btn]")) {
        console.log("[Neosrc] injectButton: button already exists, skipping");
        return;
    }

    const title = findTitleEl();
    if (!title) {
        console.log("[Neosrc] injectButton: no title element, cannot inject");
        return;
    }

    const path = window.location.pathname;
    const match = path.match(/^\/[^/]+\/[^/]+\/pull\/\d+/);
    if (!match) {
        console.log(
            "[Neosrc] injectButton: path does not match PR pattern, skipping",
        );
        return;
    }

    console.log("[Neosrc] injectButton: injecting button for", path);
    const btn = document.createElement("a");
    btn.setAttribute("data-neosrc-btn", "");
    btn.href = `${neosrcUrl}${path}`;
    btn.textContent = "Neosrc";

    Object.assign(btn.style, {
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 8px",
        fontSize: "inherit",
        lineHeight: "inherit",
        fontWeight: "500",
        color: "#0969da",
        background: "transparent",
        border: "1px solid #d0d7de",
        borderRadius: "6px",
        textDecoration: "none",
        cursor: "pointer",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        marginLeft: "8px",
    });

    btn.addEventListener("mouseenter", () => {
        btn.style.background = "#f3f4f6";
    });
    btn.addEventListener("mouseleave", () => {
        btn.style.background = "transparent";
    });
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        console.log("[Neosrc] button clicked, navigating to", btn.href);
        window.location.href = btn.href;
    });

    title.appendChild(btn);
    console.log("[Neosrc] injectButton: button appended to title");
}

async function onPageChange(source) {
    console.log("[Neosrc] onPageChange triggered by:", source);
    await loadSettings();
    autoRedirect();
    injectButton();
}

loadSettings().then(() => {
    setupObserver();
    onPageChange("initial load");
});

let observer = null;

function setupObserver() {
    if (observer) observer.disconnect();
    const target =
        document.querySelector('[role="main"]') ||
        document.querySelector("main") ||
        document.body;
    observer = new MutationObserver(() => onPageChange("MutationObserver"));
    observer.observe(target, { childList: true, subtree: true });
    console.log(
        "[Neosrc] MutationObserver registered on",
        target.tagName.toLowerCase() +
            (target !== document.body ? `[role="main"]` : ""),
    );
}

window.addEventListener("popstate", () => {
    console.log("[Neosrc] popstate event — URL is now:", location.href);
    onPageChange("popstate");
});
console.log("[Neosrc] popstate listener registered");

document.addEventListener("turbo:load", () => {
    console.log("[Neosrc] turbo:load event — URL is now:", location.href);
    setupObserver();
    onPageChange("turbo:load");
});
console.log("[Neosrc] turbo:load listener registered");

chrome.storage.onChanged.addListener((changes, area) => {
    console.log("[Neosrc] storage changed: area =", area, "changes =", changes);
    if (area !== "sync") return;
    if (changes.neosrcUrl) {
        neosrcUrl = changes.neosrcUrl.newValue || DEFAULT_NEOSRC_URL;
        console.log("[Neosrc] storage: neosrcUrl updated to", neosrcUrl);
    }
    if (changes.excludedOwners) {
        excludedOwners =
            changes.excludedOwners.newValue || DEFAULT_EXCLUDED_OWNERS;
        console.log(
            "[Neosrc] storage: excludedOwners updated to",
            excludedOwners,
        );
    }
    if (changes.enabled) {
        enabled = changes.enabled.newValue === true;
        console.log("[Neosrc] storage: enabled changed to", enabled);
        if (enabled) {
            sessionStorage.removeItem("neosrc_exit_session");
            autoRedirect({ isManualToggle: true });
        }
    }
});
console.log("[Neosrc] storage.onChanged listener registered");
