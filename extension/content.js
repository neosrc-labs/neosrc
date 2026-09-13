// Runs on github.com at document_start.
//
// Full page loads are handled by the service worker's declarativeNetRequest
// rules, before GitHub is ever rendered. This script covers what the network
// layer cannot see: GitHub's Turbo navigations, links that would start one, and
// the "back to GitHub" marker the app sets when it cannot serve a page.
(() => {
    const ROUTES = globalThis.NeosrcRoutes;
    const DEFAULT_NEOSRC_URL = "https://neosrc.dev";
    const EXIT_KEY_PREFIX = "neosrc_exit:";

    let enabled = false;
    let neosrcUrl = DEFAULT_NEOSRC_URL;
    let excludedOwners = [];
    let table = null;

    const exitedPaths = new Set();

    function seedExitedPaths() {
        try {
            for (const key of Object.keys(sessionStorage)) {
                if (key.startsWith(EXIT_KEY_PREFIX)) {
                    exitedPaths.add(key.slice(EXIT_KEY_PREFIX.length));
                }
            }
        } catch {
            // Storage can be unavailable; the background still keeps the path
            // on GitHub for this tab through its session rules.
        }
    }

    function loadState() {
        return Promise.all([
            chrome.storage.sync.get(["enabled", "neosrcUrl", "excludedOwners"]),
            chrome.storage.local.get(["routeTable"]),
        ]).then(([sync, local]) => {
            enabled = sync.enabled === true;
            neosrcUrl = ROUTES.originOf(sync.neosrcUrl) ?? DEFAULT_NEOSRC_URL;
            excludedOwners = sync.excludedOwners || [];
            table =
                ROUTES.sanitizeTable(local.routeTable) ?? ROUTES.bakedTable();
        });
    }

    /** Neosrc URL for a GitHub URL, or null when GitHub should render it. */
    function redirectTarget(url) {
        if (!enabled || !table) return null;
        if (ROUTES.hasExitParam(url)) return null;

        const match = ROUTES.matchPath(table, url.hostname, url.pathname);
        if (!match) return null;

        const owner = (url.pathname.split("/")[1] ?? "").toLowerCase();
        if (excludedOwners.includes(owner)) return null;
        if (exitedPaths.has(url.pathname)) return null;

        return ROUTES.buildTargetUrl(neosrcUrl, match, url);
    }

    /**
     * Reads the marker the app appends when it hands a page back, and remembers
     * the path as a deliberate stop for this tab.
     */
    function consumeExitMarker() {
        const url = new URL(window.location.href);
        if (!ROUTES.hasExitParam(url)) return;

        url.searchParams.delete(ROUTES.EXIT_PARAM);
        try {
            window.history.replaceState(
                window.history.state,
                "",
                `${url.pathname}${url.search}${url.hash}`,
            );
        } catch {
            // A failed rewrite only leaves the marker in the address bar.
        }

        exitedPaths.add(url.pathname);
        try {
            sessionStorage.setItem(`${EXIT_KEY_PREFIX}${url.pathname}`, "1");
        } catch {
            // In-memory state still covers this document.
        }

        chrome.runtime
            .sendMessage({
                type: "neosrc-exit",
                host: url.hostname,
                pathname: url.pathname,
            })
            .catch(() => {
                // No service worker listening; nothing else to do.
            });
    }

    function redirectFromLocation() {
        const target = redirectTarget(new URL(window.location.href));
        if (!target) return false;
        window.location.replace(target);
        return true;
    }

    // --- Link interception -------------------------------------------------
    // Turbo would fetch the GitHub page before we could react to it. Leaving
    // for Neosrc from the click keeps the navigation to a single page load.

    function handleClick(event) {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
            return;
        }

        const target = event.target;
        const anchor =
            target instanceof Element ? target.closest("a[href]") : null;
        if (
            !anchor ||
            anchor.target === "_blank" ||
            anchor.hasAttribute("download")
        ) {
            return;
        }

        let url;
        try {
            url = new URL(anchor.href, window.location.href);
        } catch {
            return;
        }
        if (url.origin !== window.location.origin) return;

        const redirect = redirectTarget(url);
        if (!redirect) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        window.location.assign(redirect);
    }

    // --- In-page navigation -------------------------------------------------

    function onNavigation() {
        consumeExitMarker();
        if (redirectFromLocation()) return;
        injectButton();
    }

    // --- "Open in Neosrc" button -------------------------------------------

    function findTitleEl() {
        const main =
            document.querySelector('[role="main"]') ??
            document.querySelector("main");
        if (!main) return null;
        for (const heading of main.querySelectorAll("h1, h2")) {
            if (heading.offsetParent !== null) return heading;
        }
        return null;
    }

    function buildButton(href) {
        const button = document.createElement("a");
        button.setAttribute("data-neosrc-btn", "");
        button.href = href;
        button.title = "Open in Neosrc";

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>.bg{fill:#f3f4f6}.letter{fill:#374151}@media(prefers-color-scheme:dark){.bg{fill:#27272a}.letter{fill:#d1d5db}}</style><rect class="bg" width="32" height="32" rx="6"/><text class="letter" x="16" y="16" text-anchor="middle" dominant-baseline="central" font-family="system-ui,-apple-system,sans-serif" font-size="16" font-weight="700">N</text></svg>`;
        const logo = document.createElement("img");
        logo.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
        logo.alt = "Neosrc";
        logo.style.width = "35px";
        logo.style.height = "35px";
        logo.style.display = "block";
        button.appendChild(logo);

        Object.assign(button.style, {
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
        button.addEventListener("mouseenter", () => {
            button.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
            logo.style.filter = "brightness(0.85)";
        });
        button.addEventListener("mouseleave", () => {
            button.style.boxShadow = "none";
            logo.style.filter = "none";
        });
        button.addEventListener("click", (event) => {
            event.preventDefault();
            window.location.assign(button.href);
        });
        return button;
    }

    let buttonObserver = null;

    function injectButton() {
        if (document.querySelector("[data-neosrc-btn]")) return;

        const url = new URL(window.location.href);
        // The current page is already Neosrc's, so build the target without the
        // exit-marker rules that guard redirection.
        const match = table
            ? ROUTES.matchPath(table, url.hostname, url.pathname)
            : null;
        if (!match) return;
        const href = ROUTES.buildTargetUrl(neosrcUrl, match, url);

        const title = findTitleEl();
        if (title) {
            title.appendChild(buildButton(href));
            return;
        }
        if (buttonObserver) return;

        const root =
            document.querySelector('[role="main"]') ??
            document.querySelector("main") ??
            document.body;
        if (!root) {
            document.addEventListener("DOMContentLoaded", injectButton, {
                once: true,
            });
            return;
        }

        buttonObserver = new MutationObserver(() => {
            const found = findTitleEl();
            if (!found) return;
            found.appendChild(buildButton(href));
            buttonObserver?.disconnect();
            buttonObserver = null;
        });
        buttonObserver.observe(root, { childList: true, subtree: true });
        setTimeout(() => {
            buttonObserver?.disconnect();
            buttonObserver = null;
        }, 10000);
    }

    // --- Wiring -------------------------------------------------------------

    document.addEventListener("click", handleClick, true);
    document.addEventListener("turbo:load", onNavigation);
    window.addEventListener("popstate", onNavigation);
    window.addEventListener("pageshow", onNavigation);

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.enabled) {
            enabled = changes.enabled.newValue === true;
            if (enabled) {
                // Turning the extension on is a request to be on Neosrc.
                exitedPaths.clear();
                try {
                    for (const key of Object.keys(sessionStorage)) {
                        if (key.startsWith(EXIT_KEY_PREFIX)) {
                            sessionStorage.removeItem(key);
                        }
                    }
                } catch {
                    // Ignore; the redirect still works for this document.
                }
                redirectFromLocation();
            }
        }
        if (changes.neosrcUrl) {
            neosrcUrl = changes.neosrcUrl.newValue || DEFAULT_NEOSRC_URL;
        }
        if (changes.excludedOwners) {
            excludedOwners = changes.excludedOwners.newValue || [];
        }
        if (changes.routeTable) {
            table =
                ROUTES.sanitizeTable(changes.routeTable.newValue) ??
                ROUTES.bakedTable();
        }
    });

    seedExitedPaths();
    consumeExitMarker();
    loadState().then(() => {
        if (redirectFromLocation()) return;
        injectButton();
    });
})();
