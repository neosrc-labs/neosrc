const NEOSRC_DOMAIN = "http://localhost:3000";

console.log("[Neosrc] content script loaded on:", window.location.href);
console.log("[Neosrc] note: primary redirect handled by DNR at network level; content script is fallback for toggle-while-on-page");

async function isEnabled() {
	const result = await chrome.storage.sync.get("enabled");
	const enabled = result.enabled !== false;
	console.log("[Neosrc] isEnabled =>", enabled);
	return enabled;
}

window.alreadyMap = {};

async function autoRedirect() {
	console.log("[Neosrc] autoRedirect check");

	const enabled = await isEnabled();
	if (!enabled) {
		console.log("[Neosrc] autoRedirect: disabled, skipping");
		return;
	}

	const path = window.location.pathname;
	console.log("[Neosrc] autoRedirect: path =", path);

	const match = path.match(/^\/[^/]+\/[^/]+\/pull\/\d+/);
	if (!match) {
		console.log("[Neosrc] autoRedirect: path does not match PR pattern, skipping");
		return;
	}

	const key = `neosrc_redirected:${path}`;
	const already = alreadyMap[key];
	if (already) {
		console.log("[Neosrc] autoRedirect: already redirected this PR (sessionStorage), skipping");
		return;
	}

	alreadyMap[key] = true;

	const target = `${NEOSRC_DOMAIN}${path}`;
	console.log("[Neosrc] autoRedirect: redirecting to", target);
	window.location.href = target;
}

function findTitleEl() {
	console.log("[Neosrc] findTitleEl: looking for PR title heading");
	const main =
		document.querySelector('[role="main"]') || document.querySelector("main");
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
		console.log("[Neosrc] injectButton: path does not match PR pattern, skipping");
		return;
	}

	console.log("[Neosrc] injectButton: injecting button for", path);
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
		console.log("[Neosrc] button clicked, navigating to", btn.href);
		window.location.href = btn.href;
	});

	title.appendChild(btn);
	console.log("[Neosrc] injectButton: button appended to title");
}

function onPageChange(source) {
	console.log("[Neosrc] onPageChange triggered by:", source);
	autoRedirect();
	injectButton();
}

onPageChange("initial load");

const observer = new MutationObserver(() => onPageChange("MutationObserver"));
observer.observe(document.body, { childList: true, subtree: true });
console.log("[Neosrc] MutationObserver registered on document.body");

window.addEventListener("popstate", () => {
	console.log("[Neosrc] popstate event — URL is now:", location.href);
	onPageChange("popstate");
});
console.log("[Neosrc] popstate listener registered");

document.addEventListener("turbo:load", () => {
	console.log("[Neosrc] turbo:load event — URL is now:", location.href);
	onPageChange("turbo:load");
});
console.log("[Neosrc] turbo:load listener registered");

let lastUrl = location.href;
setInterval(() => {
	if (location.href !== lastUrl) {
		console.log("[Neosrc] URL poll detected change:", lastUrl, "=>", location.href);
		lastUrl = location.href;
		onPageChange("URL poll");
		return;
	}
	if (!document.querySelector("[data-neosrc-btn]")) {
		injectButton();
	}
}, 1000);
console.log("[Neosrc] URL poll interval registered (every 1s)");

chrome.storage.onChanged.addListener((changes, area) => {
	console.log("[Neosrc] storage changed: area =", area, "changes =", changes);
	if (area === "sync" && changes.enabled) {
		console.log("[Neosrc] storage: enabled changed to", changes.enabled.newValue);
		if (changes.enabled.newValue === true) {
			autoRedirect();
		}
	}
});
console.log("[Neosrc] storage.onChanged listener registered");
