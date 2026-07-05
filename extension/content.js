const DEFAULT_NEOSRC_URL = "https://neosrc.dev";

let neosrcUrl = DEFAULT_NEOSRC_URL;
let enabled = false;
let excludedOwners = [];

function isPRPath(pathname) {
    return /^\/[^/]+\/[^/]+\/pull\/\d+/.test(pathname);
}

function shouldSkipRedirect(pathname) {
    if (!enabled) return true;
    if (!isPRPath(pathname)) return true;
    const owner = pathname.split("/")[1];
    if (excludedOwners.includes(owner)) return true;
    if (sessionStorage.getItem("neosrc_exit_session")) return true;
    const key = `neosrc_redirected:${pathname}`;
    if (sessionStorage.getItem(key)) return true;
    return false;
}

function doRedirect() {
    const path = window.location.pathname;
    if (shouldSkipRedirect(path)) return false;
    const key = `neosrc_redirected:${path}`;
    try {
        sessionStorage.setItem(key, "true");
    } catch {}
    window.location.replace(`${neosrcUrl}${path}`);
    return true;
}

async function initSettings() {
    const result = await chrome.storage.sync.get([
        "enabled",
        "neosrcUrl",
        "excludedOwners",
    ]);
    enabled = result.enabled === true;
    neosrcUrl = result.neosrcUrl || DEFAULT_NEOSRC_URL;
    excludedOwners = result.excludedOwners || [];
}

function handleNeosrcExit() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("neosrc_exit")) return false;
    url.searchParams.delete("neosrc_exit");
    window.history.replaceState({}, "", url);
    sessionStorage.setItem("neosrc_exit_session", "true");
    return true;
}

// Phase 1: On page load, check for redirect (at document_start)
initSettings().then(() => {
    if (handleNeosrcExit()) return;
    if (doRedirect()) return;
});

// Phase 2: Handle Turbo/SPA navigations (settings already cached in memory)
function onNavigation() {
    if (doRedirect()) return;
    if (isPRPath(window.location.pathname)) {
        waitForDomAndInjectButton();
    }
}

document.addEventListener("turbo:load", () => onNavigation());
window.addEventListener("popstate", () => onNavigation());

// Phase 3: Inject "Open in Neosrc" button
function findTitleEl() {
    const main =
        document.querySelector('[role="main"]') ||
        document.querySelector("main");
    if (!main) return null;
    for (const h of main.querySelectorAll("h1, h2")) {
        if (h.offsetParent !== null) return h;
    }
    return null;
}

function doInjectButton(title) {
    const path = window.location.pathname;
    if (!isPRPath(path)) return;
    if (document.querySelector("[data-neosrc-btn]")) return;

    const btn = document.createElement("a");
    btn.setAttribute("data-neosrc-btn", "");
    btn.href = `${neosrcUrl}${path}`;
    btn.title = "Open in NeoSrc";

    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>.bg{fill:#f3f4f6}.letter{fill:#374151}@media(prefers-color-scheme:dark){.bg{fill:#27272a}.letter{fill:#d1d5db}}</style><rect class="bg" width="32" height="32" rx="6"/><text class="letter" x="16" y="16" text-anchor="middle" dominant-baseline="central" font-family="system-ui,-apple-system,sans-serif" font-size="16" font-weight="700">N</text></svg>`;
    const logo = document.createElement("img");
    logo.src = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
    logo.alt = "Neosrc";
    logo.style.width = "35px";
    logo.style.height = "35px";
    logo.style.display = "block";
    btn.appendChild(logo);

    Object.assign(btn.style, {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px",
        borderRadius: "6px",
        textDecoration: "none",
        cursor: "pointer",
        verticalAlign: "middle",
        marginLeft: "8px",
        transition: "box-shadow 0.15s",
    });

    btn.addEventListener("mouseenter", () => {
        btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
        logo.style.filter = "brightness(0.85)";
    });
    btn.addEventListener("mouseleave", () => {
        btn.style.boxShadow = "none";
        logo.style.filter = "none";
    });
    btn.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = btn.href;
    });

    title.appendChild(btn);
}

let buttonObserver = null;

function waitForDomAndInjectButton() {
    if (document.querySelector("[data-neosrc-btn]")) return;
    const title = findTitleEl();
    if (title) {
        doInjectButton(title);
        return;
    }
    if (buttonObserver) return;
    const target =
        document.querySelector('[role="main"]') ||
        document.querySelector("main") ||
        document.body;
    if (!target) {
        document.addEventListener(
            "DOMContentLoaded",
            waitForDomAndInjectButton,
            { once: true },
        );
        return;
    }
    buttonObserver = new MutationObserver(() => {
        if (document.querySelector("[data-neosrc-btn]")) {
            buttonObserver.disconnect();
            buttonObserver = null;
            return;
        }
        const t = findTitleEl();
        if (t) {
            doInjectButton(t);
            buttonObserver.disconnect();
            buttonObserver = null;
        }
    });
    buttonObserver.observe(target, { childList: true, subtree: true });
    setTimeout(() => {
        if (buttonObserver) {
            buttonObserver.disconnect();
            buttonObserver = null;
        }
    }, 10000);
}

// Phase 4: Update cached settings when changed
chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    let needsRedirect = false;
    if (changes.enabled) {
        enabled = changes.enabled.newValue === true;
        if (enabled) {
            sessionStorage.removeItem("neosrc_exit_session");
            needsRedirect = true;
        }
    }
    if (changes.neosrcUrl)
        neosrcUrl = changes.neosrcUrl.newValue || DEFAULT_NEOSRC_URL;
    if (changes.excludedOwners)
        excludedOwners = changes.excludedOwners.newValue || [];
    if (needsRedirect) doRedirect();
});
