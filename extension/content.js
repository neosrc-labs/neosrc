// content.js
console.log("GitHub PR Redirector content script loaded.");

function redirectToLocalhost(url) {
  const githubPrRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)\/?.*$/;
  const match = url.match(githubPrRegex);

  if (url.includes('nodub=true')) {
    console.log('nodub=true, skipping redirect')
    return false;
  }

  if (match) {
    const owner = match[1];
    const repo = match[2];
    const pullRequestNumber = match[3];

    const newUrl = `http://localhost:3000/${owner}/${repo}/pull/${pullRequestNumber}`;

    if (window.location.href !== newUrl) { // Prevent infinite loops if already redirected
      console.log(`Content script: Redirecting GitHub PR from: ${url} to: ${newUrl}`);
      window.location.replace(newUrl); // Use replace to prevent back button issues
      return true; // Indicate that a redirect happened
    }
  }
  return false; // Indicate no redirect happened
}

// Initial check on page load (for cases where the URL is already a PR)
redirectToLocalhost(window.location.href);

// Listen for URL changes that occur without a full page reload (SPA navigation)
// This is often done by monitoring pushState/replaceState
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log("Content script: URL changed to:", lastUrl);
    redirectToLocalhost(lastUrl);
  }
});

// Observe the document body for changes, which often indicates URL changes in SPAs
// config: observe children and subtree changes
observer.observe(document.body, { childList: true, subtree: true });

// Also, specifically listen for history API changes (pushState/replaceState)
// These methods are how SPAs change the URL without a full reload.
const pushState = history.pushState;
history.pushState = function() {
    pushState.apply(history, arguments);
    window.dispatchEvent(new Event('pushstate')); // Custom event for our listener
};

const replaceState = history.replaceState;
history.replaceState = function() {
    replaceState.apply(history, arguments);
    window.dispatchEvent(new Event('replacestate')); // Custom event
};

window.addEventListener('pushstate', () => {
    redirectToLocalhost(window.location.href);
});
window.addEventListener('replacestate', () => {
    redirectToLocalhost(window.location.href);
});

// Fallback: Check for hash changes (less common for GitHub PRs, but good practice)
window.addEventListener('hashchange', () => {
    redirectToLocalhost(window.location.href);
});
