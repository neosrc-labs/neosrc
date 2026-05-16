import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

type RecorderMode = "record" | "replay" | "passthrough";

const RECORDINGS_DIR = path.join(process.cwd(), "recordings/github");

function getMode(): RecorderMode {
    return (process.env.GITHUB_RECORDER_MODE as RecorderMode) || "passthrough";
}

function recordingKey(method: string, url: string, body: string): string {
    const u = new URL(url);
    const pathAndQuery = u.pathname + u.search;
    const hash = crypto
        .createHash("sha256")
        .update(`${method}:${pathAndQuery}:${body}`)
        .digest("hex")
        .slice(0, 16);
    const filename = `${method}_${u.pathname.replace(/[/?&=]/g, "_")}_${hash}`;
    return filename.replace(/[^a-zA-Z0-9_-]/g, "_");
}

type Recording = {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
};

async function loadRecording(key: string): Promise<Recording | null> {
    try {
        const content = await fs.readFile(
            path.join(RECORDINGS_DIR, `${key}.json`),
            "utf-8",
        );
        return JSON.parse(content) as Recording;
    } catch {
        return null;
    }
}

async function saveRecording(key: string, recording: Recording) {
    await fs.mkdir(RECORDINGS_DIR, { recursive: true });
    await fs.writeFile(
        path.join(RECORDINGS_DIR, `${key}.json`),
        JSON.stringify(recording),
        "utf-8",
    );
}

let patched = false;

export function initGitHubRecorder() {
    if (patched) return;
    patched = true;

    const originalFetch = globalThis.fetch;

    globalThis.fetch = async function fetch(
        input: RequestInfo | URL,
        init?: RequestInit,
    ) {
        const req = new Request(input, init);
        const url = new URL(req.url);

        const isGitHubAPI =
            url.hostname === "api.github.com" ||
            url.hostname.endsWith(".api.github.com");

        if (!isGitHubAPI) {
            return originalFetch.call(globalThis, input, init);
        }

        const mode = getMode();
        if (mode === "passthrough") {
            return originalFetch.call(globalThis, input, init);
        }

        const method = req.method;
        const requestBody = await req.clone().text();
        const key = recordingKey(method, url.href, requestBody);

        if (mode === "replay") {
            const recording = await loadRecording(key);
            if (recording) {
                return new Response(recording.body, {
                    status: recording.status,
                    statusText: recording.statusText,
                    headers: recording.headers,
                });
            }
            console.warn(`[github-recorder] MISS: ${method} ${url.pathname}`);
            return originalFetch.call(globalThis, input, init);
        }

        const response = await originalFetch.call(globalThis, input, init);
        const cloned = response.clone();

        const recording: Recording = {
            status: cloned.status,
            statusText: cloned.statusText,
            headers: Object.fromEntries(cloned.headers.entries()),
            body: await cloned.text(),
        };

        await saveRecording(key, recording);
        console.log(`[github-recorder] SAVED: ${method} ${url.pathname}`);

        return response;
    };
}
