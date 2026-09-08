// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { PullsGetResponseData } from "~/server/github";
import type { PullRequestPermissionContext } from "../permissions-utils";
import { ConflictedFiles } from "./conflicted-files";

vi.mock("next/image", () => ({
    default: ({ alt, src }: { alt: string; src: string }) => (
        // biome-ignore lint/performance/noImgElement: test stub for next/image
        <img alt={alt} src={src} />
    ),
}));

function pullRequest(options?: {
    headRepo?: string | null;
    maintainerCanModify?: boolean;
}): PullsGetResponseData {
    const headRepo =
        options?.headRepo === undefined ? "owner/repo" : options.headRepo;
    return {
        head: {
            repo: headRepo
                ? {
                      full_name: headRepo,
                      owner: { login: headRepo.split("/")[0] },
                  }
                : null,
        },
        base: { repo: { full_name: "owner/repo" } },
        maintainer_can_modify: options?.maintainerCanModify ?? false,
    } as unknown as PullsGetResponseData;
}

function permissions(
    repoPermission: PullRequestPermissionContext["repoPermission"],
    overrides?: Partial<PullRequestPermissionContext>,
): PullRequestPermissionContext {
    return {
        currentUser: "reader",
        isPullRequestAuthor: false,
        isPullRequestLocked: false,
        repoPermission,
        ...overrides,
    };
}

function renderConflicts(
    permissionContext: PullRequestPermissionContext,
    options?: {
        compact?: boolean;
        headRepo?: string | null;
        maintainerCanModify?: boolean;
    },
) {
    return render(
        <ConflictedFiles
            owner="owner"
            repo="repo"
            number={7}
            pullRequest={pullRequest(options)}
            conflictedFiles={["src/index.ts"]}
            permissionContext={permissionContext}
            compact={options?.compact}
        />,
    );
}

function resolveLink() {
    return screen.queryByRole("link", { name: /resolve/i });
}

describe("ConflictedFiles resolve access", () => {
    it("links to the conflict editor for a user with push access", () => {
        renderConflicts(permissions("write"));

        expect(resolveLink()).toHaveAttribute(
            "href",
            "https://github.com/owner/repo/pull/7/conflicts",
        );
    });

    it("hides the resolve link from a read-only user", () => {
        renderConflicts(permissions("read"));

        expect(screen.getByText("Conflicting files")).toBeInTheDocument();
        expect(resolveLink()).not.toBeInTheDocument();
    });

    it("hides the resolve link from a signed-out visitor", () => {
        renderConflicts(
            permissions(null, { currentUser: null, isPullRequestLocked: true }),
        );

        expect(resolveLink()).not.toBeInTheDocument();
    });

    it("links the owner of a fork branch to the conflict editor", () => {
        renderConflicts(permissions("read", { currentUser: "forker" }), {
            headRepo: "forker/repo",
        });

        expect(resolveLink()).toHaveAttribute(
            "href",
            "https://github.com/owner/repo/pull/7/conflicts",
        );
    });

    it("hides the resolve link on a fork branch owned by someone else", () => {
        renderConflicts(permissions("write"), { headRepo: "forker/repo" });

        expect(resolveLink()).not.toBeInTheDocument();
    });

    it("links a maintainer to the conflict editor when fork edits are allowed", () => {
        renderConflicts(permissions("write"), {
            headRepo: "forker/repo",
            maintainerCanModify: true,
        });

        expect(resolveLink()).toHaveAttribute(
            "href",
            "https://github.com/owner/repo/pull/7/conflicts",
        );
    });

    it("hides the resolve link when the head repository is gone", () => {
        renderConflicts(permissions("write"), { headRepo: null });

        expect(resolveLink()).not.toBeInTheDocument();
    });

    it("hides the resolve link in the compact popover for a read-only user", async () => {
        renderConflicts(permissions("read"), { compact: true });

        await userEvent.click(
            screen.getByRole("button", { name: /conflicting files/i }),
        );

        expect(screen.getByText("src/index.ts")).toBeInTheDocument();
        expect(resolveLink()).not.toBeInTheDocument();
    });

    it("shows the resolve link in the compact popover for a maintainer", async () => {
        renderConflicts(permissions("admin"), { compact: true });

        await userEvent.click(
            screen.getByRole("button", { name: /conflicting files/i }),
        );

        expect(resolveLink()).toHaveAttribute(
            "href",
            "https://github.com/owner/repo/pull/7/conflicts",
        );
    });
});
