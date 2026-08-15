// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetToken, mockCreateOctokit, mockGetContent } = vi.hoisted(() => ({
    mockGetToken: vi.fn(),
    mockCreateOctokit: vi.fn(),
    mockGetContent: vi.fn(),
}));

vi.mock("~/server/auth", () => ({
    githubAccessToken: mockGetToken,
}));

vi.mock("~/server/github", () => ({
    createOctokit: mockCreateOctokit,
}));

import { GET } from "./route";

/** Mirrors the boxed token RefreshableAuth getters actually return. */
function refreshableToken(value: string) {
    return Object.assign(new String(value), {
        refresh: vi.fn().mockResolvedValue("ghu_refreshed"),
    }) as unknown as string;
}

describe("GET /api/raw/content", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateOctokit.mockImplementation(() => ({
            repos: {
                getContent: mockGetContent,
            },
        }));
    });

    it("returns file content for a RefreshableAuth boxed token", async () => {
        mockGetToken.mockResolvedValue(refreshableToken("ghu_boxed"));
        mockGetContent.mockResolvedValue({
            data: {
                content: Buffer.from("line1\nline2\n").toString("base64"),
            },
        });

        const res = await GET(
            new Request(
                "http://localhost/api/raw/content?owner=o&repo=r&sha=s&path=p",
            ),
        );

        expect(res.status).toBe(200);
        expect(await res.text()).toBe("line1\nline2\n");
        expect(mockGetContent).toHaveBeenCalledWith({
            owner: "o",
            repo: "r",
            path: "p",
            ref: "s",
            request: { signal: expect.any(AbortSignal) },
        });
    });

    it("rejects missing parameters", async () => {
        const res = await GET(new Request("http://localhost/api/raw/content"));
        expect(res.status).toBe(400);
        expect(mockGetToken).not.toHaveBeenCalled();
    });

    it("401 when no token is available", async () => {
        mockGetToken.mockResolvedValue(null);
        const res = await GET(
            new Request(
                "http://localhost/api/raw/content?owner=o&repo=r&sha=s&path=p",
            ),
        );
        expect(res.status).toBe(401);
        expect(mockCreateOctokit).not.toHaveBeenCalled();
    });

    it("500 when GitHub content fetch fails", async () => {
        mockGetToken.mockResolvedValue(refreshableToken("ghu_boxed"));
        mockGetContent.mockRejectedValue(new Error("boom"));
        const res = await GET(
            new Request(
                "http://localhost/api/raw/content?owner=o&repo=r&sha=s&path=p",
            ),
        );
        expect(res.status).toBe(500);
    });
});
