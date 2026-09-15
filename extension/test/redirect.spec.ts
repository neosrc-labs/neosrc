import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    type BrowserContext,
    chromium,
    expect,
    type Page,
    test,
    type Worker,
} from "@playwright/test";
import { type HostStub, readBakedRouteTable, startHostStub } from "./host-stub";

/**
 * Loads the unpacked extension into a real Chromium and drives it against a
 * loopback stub of github.com and neosrc.dev. Redirects are made by
 * declarativeNetRequest, so this is the only level where they can be observed
 * end to end.
 */

interface DnrRule {
    id: number;
    priority: number;
    action: {
        type: string;
        redirect?: { regexSubstitution?: string };
        requestHeaders?: { header: string; value: string }[];
    };
    condition: { regexFilter?: string; tabIds?: number[] };
}

/** The slice of the extension API the tests touch inside the service worker. */
interface ChromeApi {
    storage: {
        sync: { set(values: Record<string, unknown>): Promise<void> };
    };
    declarativeNetRequest: {
        getDynamicRules(): Promise<DnrRule[]>;
        getSessionRules(): Promise<DnrRule[]>;
    };
}

const extensionPath = path.resolve(
    fileURLToPath(new URL("..", import.meta.url)),
);

let stub: HostStub;
let context: BrowserContext;
let userDataDir: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
    stub = await startHostStub();
    userDataDir = mkdtempSync(path.join(tmpdir(), "neosrc-extension-"));
    const resolved = `127.0.0.1:${stub.port}`;
    context = await chromium.launchPersistentContext(userDataDir, {
        channel: "chromium",
        headless: true,
        ignoreHTTPSErrors: true,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
            "--ignore-certificate-errors",
            `--host-resolver-rules=MAP github.com ${resolved},MAP www.github.com ${resolved},MAP neosrc.dev ${resolved},MAP www.neosrc.dev ${resolved}`,
        ],
    });
});

test.afterAll(async () => {
    await context?.close();
    await stub?.close();
    rmSync(userDataDir, { recursive: true, force: true });
});

function serviceWorker(): Promise<Worker> {
    const running = context.serviceWorkers()[0];
    return running
        ? Promise.resolve(running)
        : context.waitForEvent("serviceworker");
}

/**
 * Playwright serializes these callbacks into the service worker, so each one
 * reaches `chrome` itself: the extension platform injects it as a global there
 * and no closure is transmitted.
 */
async function dynamicRules(): Promise<DnrRule[]> {
    const worker = await serviceWorker();
    return worker.evaluate(() => {
        const scope = globalThis as unknown as { chrome: ChromeApi };
        return scope.chrome.declarativeNetRequest.getDynamicRules();
    });
}

async function sessionRules(): Promise<DnrRule[]> {
    const worker = await serviceWorker();
    return worker.evaluate(() => {
        const scope = globalThis as unknown as { chrome: ChromeApi };
        return scope.chrome.declarativeNetRequest.getSessionRules();
    });
}

/** Sets the extension's synced settings and waits for the rules to catch up. */
async function seed(settings: Record<string, unknown>, enabled: boolean) {
    const worker = await serviceWorker();
    await worker.evaluate((values) => {
        const scope = globalThis as unknown as { chrome: ChromeApi };
        return scope.chrome.storage.sync.set(values);
    }, settings);
    await expect
        .poll(async () => {
            const rules = await dynamicRules();
            if (!enabled) return rules.length;
            // A refresh still in flight leaves the redirects missing, so wait for
            // the whole set rather than just the header rule.
            return (
                rules.some((rule) => rule.action.type === "modifyHeaders") &&
                rules.some((rule) => rule.action.type === "redirect")
            );
        })
        .toBe(enabled ? true : 0);
}

async function open(url: string): Promise<Page> {
    const page = await context.newPage();
    await page.goto(url);
    return page;
}

test("redirects a supported page before GitHub is ever asked for it", async () => {
    await seed(
        {
            enabled: true,
            neosrcUrl: "https://neosrc.dev",
            excludedOwners: [],
        },
        true,
    );

    const page = await open("https://github.com/acme/widget/pull/12");

    expect(page.url()).toBe("https://neosrc.dev/gh/acme/widget/pull/12");
    expect(await page.content()).toContain("neosrc /gh/acme/widget/pull/12");
    expect(stub.docsFor("github.com", "/acme/widget/pull/12")).toHaveLength(0);

    // The app can only hand un-servable pages back because of this header.
    const neosrcRequest = stub.requests.find(
        (request) =>
            request.host === "neosrc.dev" &&
            request.pathname === "/gh/acme/widget/pull/12",
    );
    expect(neosrcRequest?.headers["x-neosrc-extension"]).toBeTruthy();

    await page.close();
});

test("covers the pages Neosrc serves and keeps the rest on GitHub", async () => {
    const covered: [string, string][] = [
        ["https://github.com/acme/widget", "https://neosrc.dev/gh/acme/widget"],
        [
            "https://github.com/acme/widget/pulls?q=is%3Aopen",
            "https://neosrc.dev/gh/acme/widget/pulls?q=is%3Aopen",
        ],
        [
            "https://github.com/acme/widget/issues",
            "https://neosrc.dev/gh/acme/widget/issues",
        ],
        [
            "https://github.com/acme/widget/issues/7",
            "https://neosrc.dev/gh/acme/widget/issues/7",
        ],
        [
            "https://github.com/acme/widget/pull/12/files",
            "https://neosrc.dev/gh/acme/widget/pull/12/changes",
        ],
        [
            "https://github.com/acme/widget/commits/main",
            "https://neosrc.dev/gh/acme/widget/commits/main",
        ],
        [
            "https://github.com/acme/widget/tree/main",
            "https://neosrc.dev/gh/acme/widget/tree/main",
        ],
        [
            "https://github.com/acme/widget/tree/main/src",
            "https://neosrc.dev/gh/acme/widget/tree/main/src",
        ],
        [
            "https://github.com/acme/widget/blob/main/README.md",
            "https://neosrc.dev/gh/acme/widget/blob/main/README.md",
        ],
        [
            "https://github.com/acme/widget/blame/main/README.md",
            "https://neosrc.dev/gh/acme/widget/blame/main/README.md",
        ],
    ];

    for (const [url, target] of covered) {
        const page = await open(url);
        expect(page.url(), url).toBe(target);
        await page.close();
    }

    const uncovered = [
        "https://github.com/acme/widget/pull/12/checks",
        "https://github.com/settings/profile",
    ];
    for (const url of uncovered) {
        const page = await open(url);
        expect(page.url(), url).toBe(url);
        const pathname = new URL(url).pathname;
        expect(
            stub.docsFor("github.com", pathname).length,
            url,
        ).toBeGreaterThan(0);
        await page.close();
    }
});

test("keeps an excluded owner on GitHub", async () => {
    await seed(
        {
            enabled: true,
            neosrcUrl: "https://neosrc.dev",
            excludedOwners: ["acme"],
        },
        true,
    );

    const excluded = await open("https://github.com/acme/widget/pull/12");
    expect(excluded.url()).toBe("https://github.com/acme/widget/pull/12");
    await excluded.close();

    const other = await open("https://github.com/other/widget/pull/12");
    expect(other.url()).toBe("https://neosrc.dev/gh/other/widget/pull/12");
    await other.close();

    await seed(
        {
            enabled: true,
            neosrcUrl: "https://neosrc.dev",
            excludedOwners: [],
        },
        true,
    );
});

test("honours the exit marker and remembers it for a reload", async () => {
    const page = await open(
        "https://github.com/acme/widget/pull/7?neosrc_exit=1",
    );

    expect(page.url()).toBe("https://github.com/acme/widget/pull/7");
    expect(
        stub.docsFor("github.com", "/acme/widget/pull/7").length,
    ).toBeGreaterThan(0);
    expect(stub.docsFor("neosrc.dev", "/gh/acme/widget/pull/7")).toHaveLength(
        0,
    );

    // The service worker remembers the path for this tab, so a reload (a fresh
    // document request) does not bounce through Neosrc again.
    await expect.poll(sessionRules).not.toHaveLength(0);

    await page.reload();
    expect(page.url()).toBe("https://github.com/acme/widget/pull/7");
    await page.close();
});

test("returns an un-servable page to GitHub", async () => {
    stub.setNeosrcMode("unavailable");

    const page = await open("https://github.com/acme/widget/issues/404");

    expect(page.url()).toBe("https://github.com/acme/widget/issues/404");
    expect(
        stub.docsFor("github.com", "/acme/widget/issues/404").length,
    ).toBeGreaterThan(0);
    expect(
        stub.requests.some(
            (request) =>
                request.host === "neosrc.dev" &&
                request.pathname === "/gh/acme/widget/issues/404",
        ),
    ).toBe(true);

    stub.setNeosrcMode("page");
    await page.close();
});

test("leaves for Neosrc on a link click rather than routing in GitHub", async () => {
    // Any path no rule claims keeps the page on GitHub; the stub serves it with
    // the same markup, including the pull link.
    const page = await open("https://github.com/acme/widget/releases");
    expect(page.url()).toBe("https://github.com/acme/widget/releases");

    await page.click("#pull-link");

    await expect(page).toHaveURL("https://neosrc.dev/gh/acme/widget/pull/99");
    await page.close();
});

test("follows an in-page Turbo navigation", async () => {
    const page = await open("https://github.com/acme/widget/releases");

    await page.evaluate(() => {
        window.history.pushState({}, "", "/acme/widget/pull/42");
        document.dispatchEvent(new CustomEvent("turbo:load"));
    });

    await expect(page).toHaveURL("https://neosrc.dev/gh/acme/widget/pull/42");
    await page.close();
});

test("keeps the extension header when the app redirects to its canonical host", async () => {
    stub.setNeosrcMode("www");

    const page = await open("https://github.com/acme/widget/pull/12");

    expect(page.url()).toBe("https://www.neosrc.dev/gh/acme/widget/pull/12");
    const request = stub.docsFor(
        "www.neosrc.dev",
        "/gh/acme/widget/pull/12",
    )[0];
    // The redirect drops the header the first hop carried, so the canonical
    // host needs its own rule or the app cannot tell where the visit came from.
    expect(request?.headers["x-neosrc-extension"]).toBeTruthy();

    stub.setNeosrcMode("page");
    await page.close();
});

test("offers the button instead of redirecting when disabled", async () => {
    await seed(
        {
            enabled: false,
            neosrcUrl: "https://neosrc.dev",
            excludedOwners: [],
        },
        false,
    );

    const page = await open("https://github.com/acme/widget/pull/12");

    expect(page.url()).toBe("https://github.com/acme/widget/pull/12");
    await expect(page.locator("[data-neosrc-btn]")).toHaveAttribute(
        "href",
        "https://neosrc.dev/gh/acme/widget/pull/12",
    );

    await page.close();
});

test("adopts the route coverage the app publishes", async () => {
    const baked = readBakedRouteTable() as {
        rules: { id: string }[];
        platforms: unknown[];
        version: number;
    };
    stub.setRouteTable({
        ...baked,
        rules: baked.rules.filter((rule) => rule.id !== "gh-repo"),
    });

    // Changing the origin is what makes the extension ask for coverage again.
    // The stub answers the bare host with a redirect to www, so this also
    // covers fetching the table from the canonical host.
    await seed(
        {
            enabled: true,
            neosrcUrl: "https://neosrc.dev/",
            excludedOwners: [],
        },
        true,
    );
    await expect
        .poll(
            async () =>
                (await dynamicRules()).filter(
                    (rule) => rule.action.type === "redirect",
                ).length,
        )
        .toBe(baked.rules.length - 1);
    expect(
        stub.requests.some(
            (request) =>
                request.host === "www.neosrc.dev" &&
                request.pathname === "/api/extension/routes",
        ),
    ).toBe(true);

    const dropped = await open("https://github.com/acme/widget");
    expect(dropped.url()).toBe("https://github.com/acme/widget");
    await dropped.close();

    const kept = await open("https://github.com/acme/widget/pull/12");
    expect(kept.url()).toBe("https://neosrc.dev/gh/acme/widget/pull/12");
    await kept.close();

    // Put the published table and the adopted coverage back, so later tests see
    // the shipped route set. The URL differs from the one set above so the
    // extension asks for coverage again.
    stub.setRouteTable(baked);
    await seed(
        {
            enabled: true,
            neosrcUrl: "https://neosrc.dev",
            excludedOwners: [],
        },
        true,
    );
    await expect
        .poll(
            async () =>
                (await dynamicRules()).filter(
                    (rule) => rule.action.type === "redirect",
                ).length,
        )
        .toBe(baked.rules.length);
});

test("keeps redirecting when the published table is unusable", async () => {
    stub.setRouteTable(undefined);

    await seed(
        {
            enabled: true,
            neosrcUrl: "https://neosrc.dev",
            excludedOwners: [],
        },
        true,
    );

    const page = await open("https://github.com/acme/widget/pull/12");
    expect(page.url()).toBe("https://neosrc.dev/gh/acme/widget/pull/12");
    await page.close();

    stub.setRouteTable(readBakedRouteTable());
});

test("renders the popup without errors", async () => {
    await seed(
        {
            enabled: false,
            neosrcUrl: "https://neosrc.dev",
            excludedOwners: [],
        },
        false,
    );

    const worker = await serviceWorker();
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));

    await page.goto(
        `chrome-extension://${new URL(worker.url()).host}/popup/popup.html`,
    );

    await expect(page.locator("#neosrcUrl")).toHaveValue("https://neosrc.dev");
    await expect(page.locator("#status")).toContainText("Disabled");
    expect(errors).toEqual([]);

    await page.close();
});

test("points a local dev server at plain http", async () => {
    await seed(
        {
            enabled: true,
            neosrcUrl: "https://neosrc.dev",
            excludedOwners: [],
        },
        true,
    );

    const worker = await serviceWorker();
    const page = await context.newPage();
    await page.goto(
        `chrome-extension://${new URL(worker.url()).host}/popup/popup.html`,
    );

    // What the popup accepts when someone types their dev server without a
    // scheme; https against a `next dev` server is what used to break this.
    // A port with nothing on it keeps the test off whatever the developer
    // happens to be running locally.
    await page.fill("#neosrcUrl", "localhost:3999");

    await expect
        .poll(async () =>
            worker.evaluate(async () => {
                const scope = globalThis as unknown as { chrome: ChromeApi };
                const stored = await scope.chrome.storage.sync.get([
                    "neosrcUrl",
                ]);
                return stored.neosrcUrl as string;
            }),
        )
        .toBe("http://localhost:3999");

    // Redirects and the header rule both follow the configured origin, so a
    // dev server is reachable and still gets told when a redirect came from here.
    await expect
        .poll(async () => {
            const rules = await dynamicRules();
            const redirects = rules.filter((rule) => rule.action.redirect);
            const allFollowOrigin =
                redirects.length > 0 &&
                redirects.every((rule) =>
                    rule.action.redirect?.regexSubstitution?.startsWith(
                        "http://localhost:3999/",
                    ),
                );
            const header = rules.some(
                (rule) =>
                    rule.action.type === "modifyHeaders" &&
                    rule.condition.regexFilter === "^http://localhost:3999/",
            );
            return allFollowOrigin && header;
        })
        .toBe(true);

    await seed(
        {
            enabled: true,
            neosrcUrl: "https://neosrc.dev",
            excludedOwners: [],
        },
        true,
    );
    await page.close();
});
