console.log("Neosrc PR Redirect: loaded");

const NEOSRC_DOMAIN = "http://localhost:3000";

function findTitleEl() {
    const main =
        document.querySelector('[role="main"]') ||
        document.querySelector("main");
    if (!main) return null;

    for (const h of main.querySelectorAll("h1")) {
        if (h.offsetParent !== null) return h;
    }

    for (const h of main.querySelectorAll("h2")) {
        if (h.offsetParent !== null) return h;
    }

    return null;
}

function injectButton() {
    if (document.querySelector("[data-neosrc-btn]")) return;

    const title = findTitleEl();
    if (!title) return;

    const path = window.location.pathname;
    if (!path.match(/^\/[^/]+\/[^/]+\/pull\/\d+/)) return;

    const btn = document.createElement("a");
    btn.setAttribute("data-neosrc-btn", "");
    btn.href = `${NEOSRC_DOMAIN}${path}`;
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
        window.location.href = btn.href;
    });

    title.appendChild(btn);
}

injectButton();

const observer = new MutationObserver(() => injectButton());
observer.observe(document.body, { childList: true, subtree: true });

let tries = 0;
const interval = setInterval(() => {
    tries++;
    if (document.querySelector("[data-neosrc-btn]") || tries >= 20) {
        clearInterval(interval);
        return;
    }
    injectButton();
}, 500);
