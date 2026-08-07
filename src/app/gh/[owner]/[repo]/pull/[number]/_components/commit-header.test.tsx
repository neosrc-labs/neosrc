// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CommitData, PullsListCommitsResponseData } from "~/server/github";

import { CommitHeader } from "./commit-header";

function makeCommit(sha: string, message: string): CommitData {
    return {
        sha,
        commit: {
            message,
            author: {
                name: "Alice",
                email: "alice@example.com",
                date: "2026-01-01T00:00:00Z",
            },
            committer: {
                name: "Alice",
                email: "alice@example.com",
                date: "2026-01-01T00:00:00Z",
            },
        },
        author: {
            login: "alice",
            html_url: "https://github.com/alice",
            avatar_url: "https://example.com/avatar.png",
        },
    } as unknown as CommitData;
}

const COMMITS = [
    makeCommit("1111111aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "first commit"),
    makeCommit("2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", "second commit"),
    makeCommit("3333333cccccccccccccccccccccccccccccccccccc", "third commit"),
] as unknown as PullsListCommitsResponseData;

async function renderCommitHeader(commitSha: string, commit?: CommitData) {
    const element = await CommitHeader({
        commitPromise: Promise.resolve(
            commit ??
                COMMITS.find((c) => c.sha === commitSha) ??
                COMMITS[0]!,
        ),
        commitsPromise: Promise.resolve(COMMITS),
        owner: "acme",
        repo: "widget",
        number: 42,
        commitSha,
    });
    render(element);
    return element;
}

describe("CommitHeader", () => {
    it("shows the current position out of the total commit count", async () => {
        await renderCommitHeader(COMMITS[1]!.sha);
        expect(screen.getByText("2 / 3")).toBeInTheDocument();
    });

    it("shows 1 / Y on the first commit and disables Previous", async () => {
        await renderCommitHeader(COMMITS[0]!.sha);
        expect(screen.getByText("1 / 3")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "← Previous" }),
        ).toBeDisabled();
        expect(
            screen.getByRole("link", { name: "Next →" }),
        ).toHaveAttribute(
            "href",
            "/gh/acme/widget/pull/42/changes/2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        );
    });

    it("shows Y / Y on the last commit and disables Next", async () => {
        await renderCommitHeader(COMMITS[2]!.sha);
        expect(screen.getByText("3 / 3")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Next →" })).toBeDisabled();
        expect(
            screen.getByRole("link", { name: "← Previous" }),
        ).toHaveAttribute(
            "href",
            "/gh/acme/widget/pull/42/changes/2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        );
    });

    it("omits the count when the sha is not in the PR's commit list", async () => {
        const staleSha = "9999999dddddddddddddddddddddddddddddddddddddd";
        await renderCommitHeader(staleSha, makeCommit(staleSha, "old commit"));
        expect(
            screen.queryByText(/\d+ \/ \d+/),
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole("link", { name: "← Previous" }),
        ).not.toBeInTheDocument();
    });
});
