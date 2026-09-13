import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface StubRequest {
    host: string;
    pathname: string;
    search: string;
    headers: Record<string, string | string[] | undefined>;
}

export type NeosrcMode = "page" | "unavailable" | "www";

const ROUTE_TABLE_PATH = "/api/extension/routes";

export interface HostStub {
    port: number;
    requests: StubRequest[];
    setNeosrcMode(mode: NeosrcMode): void;
    /** What the app publishes at the route table path. */
    setRouteTable(table: unknown): void;
    docsFor(host: string, pathname: string): StubRequest[];
    close(): Promise<void>;
}

/** The table the extension ships with, read from the generated bundle. */
export function readBakedRouteTable(): unknown {
    const source = readFileSync(
        fileURLToPath(new URL("../routes.generated.js", import.meta.url)),
        "utf8",
    );
    const bundle = JSON.parse(
        source.slice(source.indexOf("=") + 1, source.lastIndexOf(";")),
    );
    return bundle.table;
}

/**
 * A certificate the browser will accept for the stubbed hosts, generated per
 * run so no private key is ever committed. Chromium is launched with
 * --ignore-certificate-errors, so the certificate only has to exist.
 */
function createCertificate() {
    const dir = mkdtempSync(path.join(tmpdir(), "neosrc-tls-"));
    const configPath = path.join(dir, "openssl.cnf");
    writeFileSync(
        configPath,
        [
            "[req]",
            "distinguished_name = dn",
            "x509_extensions = v3_req",
            "prompt = no",
            "[dn]",
            "CN = neosrc extension test",
            "[v3_req]",
            "subjectAltName = DNS:github.com, DNS:www.github.com, DNS:neosrc.dev, DNS:www.neosrc.dev, DNS:localhost, IP:127.0.0.1",
            "",
        ].join("\n"),
    );
    execFileSync(
        "openssl",
        [
            "req",
            "-x509",
            "-newkey",
            "rsa:2048",
            "-sha256",
            "-days",
            "1",
            "-nodes",
            "-config",
            configPath,
            "-keyout",
            "key.pem",
            "-out",
            "cert.pem",
        ],
        { cwd: dir, stdio: "pipe" },
    );
    return {
        cert: readFileSync(path.join(dir, "cert.pem")),
        key: readFileSync(path.join(dir, "key.pem")),
    };
}

function githubPage(pathname: string): string {
    return `<!doctype html>
<title>github ${pathname}</title>
<body>
<main>
<h1>acme/widget</h1>
<a id="pull-link" href="/acme/widget/pull/99">pull</a>
</main>
<script>
// Stands in for GitHub's Turbo router: same-origin clicks never reach the
// network, they push a new history entry and swap the body.
document.addEventListener("click", (event) => {
    const anchor = event.target.closest("a[href]");
    if (!anchor) return;
    event.preventDefault();
    history.pushState({}, "", anchor.getAttribute("href"));
    document.body.textContent = "github " + location.pathname;
});
</script>
</body>`;
}

/**
 * Serves github.com and neosrc.dev on one loopback port. The browser reaches it
 * through --host-resolver-rules, so redirects can be tested without touching
 * the real hosts.
 */
export async function startHostStub(): Promise<HostStub> {
    const requests: StubRequest[] = [];
    let neosrcMode: NeosrcMode = "page";
    // Serving the shipped table by default keeps a refresh a no-op; tests
    // replace it to check what the extension does with published changes.
    let routeTable: unknown = readBakedRouteTable();
    const { cert, key } = createCertificate();

    const server = createServer({ cert, key }, (request, response) => {
        const host = (request.headers.host ?? "").split(":")[0] ?? "";
        const url = new URL(request.url ?? "/", `https://${host}`);
        requests.push({
            host,
            pathname: url.pathname,
            search: url.search,
            headers: request.headers,
        });

        if (host !== "github.com" && host !== "www.github.com") {
            // The deployment redirects its bare host to www, and that includes
            // the route table: a redirect drops request headers, so the table
            // has to be fetched again from the canonical host.
            const canonical =
                host === "neosrc.dev" &&
                (neosrcMode === "www" || url.pathname === ROUTE_TABLE_PATH);
            if (canonical) {
                response.writeHead(308, {
                    location: `https://www.neosrc.dev${url.pathname}${url.search}`,
                });
                response.end();
                return;
            }

            if (url.pathname === ROUTE_TABLE_PATH) {
                response.writeHead(200, { "content-type": "application/json" });
                response.end(JSON.stringify(routeTable) ?? "");
                return;
            }

            if (neosrcMode === "unavailable") {
                // Stands in for the app's own fallback (see
                // src/server/extension-fallback.ts): it maps the Neosrc path
                // back to the host page and marks it as a deliberate stop.
                const hostPath = url.pathname
                    .replace(/^\/gh\//, "/")
                    .replace(/\/changes(\/|$)/, "/files$1");
                response.writeHead(307, {
                    location: `https://github.com${hostPath}?neosrc_exit=1`,
                });
                response.end();
                return;
            }
            response.writeHead(200, { "content-type": "text/html" });
            response.end(
                `<!doctype html><title>neosrc ${url.pathname}</title><body>neosrc ${url.pathname}</body>`,
            );
            return;
        }

        response.writeHead(200, { "content-type": "text/html" });
        response.end(githubPage(url.pathname));
    });

    await new Promise<void>((resolve) => {
        server.listen(0, "127.0.0.1", resolve);
    });
    const port = (server.address() as AddressInfo).port;

    return {
        port,
        requests,
        setNeosrcMode(mode: NeosrcMode) {
            neosrcMode = mode;
        },
        setRouteTable(table: unknown) {
            routeTable = table;
        },
        docsFor(host: string, pathname: string) {
            return requests.filter(
                (entry) =>
                    entry.host === host &&
                    entry.pathname === pathname &&
                    entry.headers["sec-fetch-dest"] === "document",
            );
        },
        async close() {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => (error ? reject(error) : resolve()));
            });
        },
    };
}
