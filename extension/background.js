chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  // Only act on main frame navigations (not iframes)
  if (details.frameId === 0) {
    const githubPrRegex = /^https:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)\/?.*$/;
    const match = details.url.match(githubPrRegex);

    if (details.url.includes('nodub=true')) {
      console.log('nodub=true, skipping redirect')
      return false;
    }

    if (match) {
      const owner = match[1];
      const repo = match[2];
      const pullRequestNumber = match[3];

      const newUrl = `http://localhost:3000/${owner}/${repo}/pull/${pullRequestNumber}`;

      console.log(`Intercepted GitHub PR. Redirecting to: ${newUrl}`);

      // Perform the redirection. This will stop the original navigation.
      chrome.tabs.update(details.tabId, { url: newUrl });
    }
  }
}, {
  // Filters to ensure we only listen for GitHub URLs
  url: [{ hostContains: "github.com" }]
});

console.log("GitHub PR Redirector background script loaded.");
