import { Octokit } from "@octokit/rest";
import { expect, test } from "@playwright/test";
import { GITHUB_TOKEN, OWNER, REPO, TEST_REPO } from "./shared/helpers";

test.describe
    .serial("Repo page", { tag: ["@github"] }, () => {
        let description: string;
        let topics: string[];
        let isPrivate: boolean;
        let language: string | null;
        let contributorLogins: string[];
        let languages: Record<string, number>;
        let hasRelease = false;
        let releaseName = "";

        test.beforeAll(async () => {
            test.skip(
                !GITHUB_TOKEN,
                "GITHUB_TOKEN not set -- skipping API-based test",
            );

            const octokit = new Octokit({ auth: GITHUB_TOKEN });

            const { data: repo } = await octokit.rest.repos.get({
                owner: OWNER,
                repo: REPO,
            });

            description = repo.description ?? "";
            topics = repo.topics ?? [];
            isPrivate = repo.private;
            language = repo.language ?? null;

            const { data: contributors } =
                await octokit.rest.repos.listContributors({
                    owner: OWNER,
                    repo: REPO,
                    per_page: 5,
                });
            contributorLogins = (contributors ?? [])
                .filter((c) => c?.login)
                .map((c) => (c as { login: string }).login);

            const { data: langData } = await octokit.rest.repos.listLanguages({
                owner: OWNER,
                repo: REPO,
            });
            languages = langData as Record<string, number>;

            try {
                const { data: release } =
                    await octokit.rest.repos.getLatestRelease({
                        owner: OWNER,
                        repo: REPO,
                    });
                hasRelease = true;
                releaseName = release.name ?? release.tag_name;
            } catch {
                hasRelease = false;
            }
        });

        test("should render repo data from the GitHub API", async ({
            page,
        }) => {
            await test.step("Navigate to the repo page", async () => {
                await page.goto(`/${TEST_REPO}`);
                await page.waitForLoadState("networkidle");
            });

            await test.step("Verify the page title", async () => {
                await expect(page).toHaveTitle(new RegExp(`${OWNER}/${REPO}`));
            });

            await test.step("Verify the repo header shows repo name", async () => {
                const h1 = page
                    .getByRole("heading", {
                        name: new RegExp(REPO),
                    })
                    .first();
                await expect(h1).toBeVisible();
            });

            await test.step("Verify the visibility badge", async () => {
                await expect(
                    page.getByText(isPrivate ? "Private" : "Public", {
                        exact: true,
                    }),
                ).toBeVisible();
            });

            await test.step("Verify the star button", async () => {
                const starBtn = page.getByRole("button", {
                    name: /Star/,
                });
                await expect(starBtn).toBeVisible();
            });

            await test.step("Verify the fork button", async () => {
                await expect(page.getByText("Fork")).toBeVisible();
            });

            await test.step("Verify the watch button", async () => {
                await expect(
                    page.getByRole("button", {
                        name: /Watch|Watching|Stop ignoring/,
                    }),
                ).toBeVisible();
            });

            await test.step("Verify the search input is visible", async () => {
                await expect(
                    page.getByPlaceholder("Search files..."),
                ).toBeVisible();
            });

            await test.step("Verify the clone button is visible", async () => {
                await expect(
                    page.getByRole("button", { name: "Code" }),
                ).toBeVisible();
            });

            await test.step("Verify the file table has rows", async () => {
                await expect(page.locator("table tbody tr")).not.toHaveCount(0);
            });

            await test.step("Verify the sidebar About heading", async () => {
                await expect(
                    page.getByRole("heading", { name: "About" }),
                ).toBeVisible();
            });

            if (description) {
                await test.step("Verify the description in the sidebar", async () => {
                    await expect(page.getByText(description)).toBeVisible();
                });
            }

            if (topics.length > 0) {
                await test.step("Verify topics are shown in the sidebar", async () => {
                    for (const topic of topics) {
                        await expect(
                            page.getByText(topic, {
                                exact: true,
                            }),
                        ).toBeVisible();
                    }
                });
            }

            if (contributorLogins.length > 0) {
                const firstLogin = contributorLogins[0];
                if (!firstLogin) return;
                await test.step("Verify contributors section is shown", async () => {
                    await expect(
                        page.getByRole("link", {
                            name: "Contributors",
                        }),
                    ).toBeVisible();
                    await expect(
                        page.getByAltText(firstLogin).first(),
                    ).toBeVisible();
                });
            }

            if (Object.keys(languages).length > 0) {
                await test.step("Verify languages section is shown", async () => {
                    await expect(
                        page.getByRole("heading", {
                            name: "Languages",
                        }),
                    ).toBeVisible();
                });

                const firstLang = Object.keys(languages)[0];
                if (!firstLang) return;
                await test.step("Verify first language is shown", async () => {
                    await expect(
                        page.getByText(firstLang, { exact: true }),
                    ).toBeVisible();
                });
            }

            if (language) {
                const lang = language;
                await test.step("Verify the primary language appears in the header area or sidebar", async () => {
                    await expect(
                        page.getByText(lang, { exact: true }),
                    ).toBeVisible();
                });
            }

            if (hasRelease) {
                const name = releaseName;
                await test.step("Verify the Releases section is shown", async () => {
                    await expect(
                        page.getByRole("link", {
                            name: "Releases",
                        }),
                    ).toBeVisible();
                    await expect(page.getByText("Latest")).toBeVisible();
                    await expect(page.getByText(name)).toBeVisible();
                });
            }

            await test.step("Verify the README is rendered", async () => {
                await expect(page.locator("#doc-files")).toBeVisible();
            });
        });
    });
