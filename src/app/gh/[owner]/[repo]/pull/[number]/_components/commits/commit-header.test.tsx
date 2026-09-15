// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CommitData } from "~/server/github";
import type { GQLCommitWithAuthors } from "~/server/github-graphql";

import { CommitCountList, CommitHeader } from "./commit-header";

function makeCommit(oid: string, message: string): GQLCommitWithAuthors {
    return {
        oid,
        message,
        committedDate: "2026-01-01T00:00:00Z",
        authors: [
            {
                name: "Alice",
                email: "alice@example.com",
                avatarUrl: "https://example.com/avatar.png",
                user: {
                    __typename: "User",
                    login: "alice",
                    avatarUrl: "https://example.com/avatar.png",
                    url: "https://github.com/alice",
                },
            },
        ],
    };
}

function makeCommitData(sha: string, message: string): CommitData {
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
];

async function renderCommitHeader(commitSha: string, commit?: CommitData) {
    const element = await CommitHeader({
        commitPromise: Promise.resolve(
            commit ?? makeCommitData(commitSha, "commit subject"),
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
        await renderCommitHeader(COMMITS[1]!.oid);
        expect(screen.getByText("2 / 3")).toBeInTheDocument();
    });

    it("shows 1 / Y on the first commit and disables Previous", async () => {
        await renderCommitHeader(COMMITS[0]!.oid);
        expect(screen.getByText("1 / 3")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "← Previous" }),
        ).toBeDisabled();
        expect(screen.getByRole("link", { name: "Next →" })).toHaveAttribute(
            "href",
            "/gh/acme/widget/pull/42/changes/2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        );
    });

    it("shows Y / Y on the last commit and disables Next", async () => {
        await renderCommitHeader(COMMITS[2]!.oid);
        expect(screen.getByText("3 / 3")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Next →" })).toBeDisabled();
        expect(
            screen.getByRole("link", { name: "← Previous" }),
        ).toHaveAttribute(
            "href",
            "/gh/acme/widget/pull/42/changes/2222222bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        );
    });

    it("navigates between commits beyond the first page", async () => {
        const manyCommits = Array.from({ length: 35 }, (_, i) =>
            makeCommit(
                `${(i + 1).toString(16).padStart(40, "0")}`,
                `commit ${i + 1}`,
            ),
        );
        const current = manyCommits[33]!;
        const element = await CommitHeader({
            commitPromise: Promise.resolve(
                makeCommitData(current.oid, "commit 34"),
            ),
            commitsPromise: Promise.resolve(manyCommits),
            owner: "acme",
            repo: "widget",
            number: 42,
            commitSha: current.oid,
        });
        render(element);

        expect(screen.getByText("34 / 35")).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "← Previous" }),
        ).toHaveAttribute(
            "href",
            `/gh/acme/widget/pull/42/changes/${manyCommits[32]!.oid}`,
        );
        expect(screen.getByRole("link", { name: "Next →" })).toHaveAttribute(
            "href",
            `/gh/acme/widget/pull/42/changes/${manyCommits[34]!.oid}`,
        );
    });

    it("omits the count when the sha is not in the PR's commit list", async () => {
        const staleSha = "9999999dddddddddddddddddddddddddddddddddddddd";
        await renderCommitHeader(
            staleSha,
            makeCommitData(staleSha, "old commit"),
        );
        expect(screen.queryByText(/\d+ \/ \d+/)).not.toBeInTheDocument();
        expect(
            screen.queryByRole("link", { name: "← Previous" }),
        ).not.toBeInTheDocument();
    });
});

describe("CommitCountList", () => {
    it("renders a link to each commit's changes view", () => {
        render(
            <CommitCountList
                commits={COMMITS}
                currentSha={COMMITS[1]!.oid}
                number={42}
                owner="acme"
                repo="widget"
            />,
        );

        for (const commit of COMMITS) {
            expect(
                screen.getByRole("link", {
                    name: new RegExp(commit.message),
                }),
            ).toHaveAttribute(
                "href",
                `/gh/acme/widget/pull/42/changes/${commit.oid}`,
            );
        }
    });

    it("highlights only the currently viewed commit", () => {
        const current = COMMITS[1]!;
        render(
            <CommitCountList
                commits={COMMITS}
                currentSha={current.oid}
                number={42}
                owner="acme"
                repo="widget"
            />,
        );

        expect(
            screen.getByRole("link", { name: new RegExp(current.message) }),
        ).toHaveClass("border-l-2");
        for (const commit of [COMMITS[0]!, COMMITS[2]!]) {
            expect(
                screen.getByRole("link", { name: new RegExp(commit.message) }),
            ).not.toHaveClass("border-l-2");
        }
    });

    it("shows the total commit count in the header", () => {
        render(
            <CommitCountList
                commits={COMMITS}
                currentSha={null}
                number={42}
                owner="acme"
                repo="widget"
            />,
        );

        expect(screen.getByText("Commits (3)")).toBeInTheDocument();
    });

    it("shows the author and relative time per commit", () => {
        render(
            <CommitCountList
                commits={COMMITS}
                currentSha={null}
                number={42}
                owner="acme"
                repo="widget"
            />,
        );

        expect(screen.getAllByText(/alice committed/)).toHaveLength(
            COMMITS.length,
        );
    });
});
