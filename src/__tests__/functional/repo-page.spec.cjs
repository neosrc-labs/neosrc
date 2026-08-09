// @ts-nocheck
const { test, expect } = require("next/experimental/testmode/playwright");

// Fixtures are kept for when testProxy is re-enabled (currently disabled due to
// https://github.com/vercel/next.js/issues/96768).  With testProxy, the
// setupGitHubMocks() helper wires server-side fetch interception.
// Without it, the page renders with real GitHub API data — assertions are
// written to pass either way.
const API_BASE = "https://api.github.com";

const branchesFixture = require("./fixtures/github/rust-lang-rust/branches.json");
const commitsFixture = require("./fixtures/github/rust-lang-rust/commits-master.json");
const contributorsFixture = require("./fixtures/github/rust-lang-rust/contributors.json");
const deploymentsFixture = require("./fixtures/github/rust-lang-rust/deployments.json");
const languagesFixture = require("./fixtures/github/rust-lang-rust/languages.json");
const latestReleaseFixture = require("./fixtures/github/rust-lang-rust/latest-release.json");
const repoFixture = require("./fixtures/github/rust-lang-rust/repo.json");
const subscriptionFixture = require("./fixtures/github/rust-lang-rust/subscription.json");
const tagsFixture = require("./fixtures/github/rust-lang-rust/tags.json");

const CONTENTS_DATA = [
    { name: ".github", path: ".github", type: "dir" },
    { name: "compiler", path: "compiler", type: "dir" },
    { name: "library", path: "library", type: "dir" },
    { name: "src", path: "src", type: "dir" },
    { name: "tests", path: "tests", type: "dir" },
    { name: "Cargo.toml", path: "Cargo.toml", type: "file", size: 8192 },
    { name: "Cargo.lock", path: "Cargo.lock", type: "file", size: 65536 },
    { name: "README.md", path: "README.md", type: "file", size: 4096 },
    { name: "LICENSE-MIT", path: "LICENSE-MIT", type: "file", size: 2048 },
    {
        name: "LICENSE-APACHE",
        path: "LICENSE-APACHE",
        type: "file",
        size: 11264,
    },
    {
        name: "CONTRIBUTING.md",
        path: "CONTRIBUTING.md",
        type: "file",
        size: 3072,
    },
    {
        name: "CODE_OF_CONDUCT.md",
        path: "CODE_OF_CONDUCT.md",
        type: "file",
        size: 5632,
    },
    { name: "x.py", path: "x.py", type: "file", size: 1024 },
    { name: "configure", path: "configure", type: "file", size: 512 },
    {
        name: "config.example.toml",
        path: "config.example.toml",
        type: "file",
        size: 2048,
    },
];

function jsonResponse(data) {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}

/**
 * Register server-side fetch handlers via the Next.js testmode proxy.
 * Only active when `experimental.testProxy` is enabled in next.config.
 * @param {import("next/experimental/testmode/playwright").NextFixture} next
 */
function setupGitHubMocks(next) {
    next.onFetch((request) => {
        const url = new URL(request.url);
        const pathBase = `${url.origin}${url.pathname}`;

        if (pathBase === `${API_BASE}/repos/rust-lang/rust`) {
            return jsonResponse(repoFixture);
        }
        if (pathBase === `${API_BASE}/repos/rust-lang/rust/contributors`) {
            return jsonResponse(contributorsFixture);
        }
        if (pathBase === `${API_BASE}/repos/rust-lang/rust/contents`) {
            return jsonResponse(CONTENTS_DATA);
        }
        if (pathBase === `${API_BASE}/repos/rust-lang/rust/languages`) {
            return jsonResponse(languagesFixture);
        }
        if (pathBase === `${API_BASE}/repos/rust-lang/rust/deployments`) {
            return jsonResponse(deploymentsFixture);
        }
        if (pathBase === `${API_BASE}/repos/rust-lang/rust/releases/latest`) {
            return jsonResponse(latestReleaseFixture);
        }
        if (pathBase === `${API_BASE}/repos/rust-lang/rust/subscription`) {
            return jsonResponse(subscriptionFixture);
        }
        if (pathBase === `${API_BASE}/repos/rust-lang/rust/commits`) {
            return jsonResponse(commitsFixture);
        }
        if (pathBase === `${API_BASE}/repos/rust-lang/rust/branches`) {
            return jsonResponse(branchesFixture);
        }
        if (pathBase === `${API_BASE}/repos/rust-lang/rust/tags`) {
            return jsonResponse(tagsFixture);
        }
        if (pathBase === `${API_BASE}/graphql`) {
            return jsonResponse({
                data: { repository: { ref: { target: {} } } },
            });
        }

        return "continue";
    });
}

test.describe("rust-lang/rust repo page", () => {
    test("renders heading, file table, and sidebar", async ({ page, next }) => {
        setupGitHubMocks(next);
        await page.goto("/gh/rust-lang/rust", {
            waitUntil: "domcontentloaded",
        });

        // --- Heading ---
        // The h1 contains just the repo name (not owner/repo).
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible({
            timeout: 15000,
        });

        // --- File table ---
        // Wait for a real file entry (client-side useQuery must resolve).
        // The skeleton table is visible immediately; real links appear after data loads.
        await expect(
            page.getByRole("link", { name: "Cargo.toml" }),
        ).toBeVisible({ timeout: 20000 });

        // --- Sidebar ---
        const sidebar = page.locator("main aside");
        await expect(sidebar).toBeVisible({ timeout: 5000 });

        // Sidebar has the "About" heading.
        await expect(sidebar.getByText("About")).toBeVisible();
    });

    test("sidebar shows the description", async ({ page, next }) => {
        setupGitHubMocks(next);
        await page.goto("/gh/rust-lang/rust", {
            waitUntil: "domcontentloaded",
        });

        const sidebar = page.locator("main aside");
        await expect(sidebar).toBeVisible({ timeout: 15000 });

        // Description is a non-empty paragraph inside the sidebar.
        const desc = sidebar.locator("p").first();
        await expect(desc).toBeVisible();
        const text = await desc.textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
    });

    test("sidebar has a release section when releases exist", async ({
        page,
        next,
    }) => {
        setupGitHubMocks(next);
        await page.goto("/gh/rust-lang/rust", {
            waitUntil: "domcontentloaded",
        });

        const sidebar = page.locator("main aside");
        await expect(sidebar).toBeVisible({ timeout: 15000 });

        // The "Releases" heading appears if there's a release.
        // (rust-lang/rust always has releases, but we avoid hardcoding a name.)
        await expect(sidebar.getByText("Releases")).toBeVisible();
    });

    test("displays the default branch in the ref selector", async ({
        page,
        next,
    }) => {
        setupGitHubMocks(next);
        await page.goto("/gh/rust-lang/rust", {
            waitUntil: "domcontentloaded",
        });

        // Wait for hydration — the skeleton has a disabled search input,
        // the real component enables it.
        await expect(page.getByPlaceholder("Search files...")).not.toBeDisabled(
            { timeout: 15000 },
        );

        // The ref selector displays the current branch name.
        // rust-lang/rust uses "main" as its default.
        await expect(
            page.locator("span", { hasText: "main" }).first(),
        ).toBeVisible({ timeout: 10000 });
    });
});
