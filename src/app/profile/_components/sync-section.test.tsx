// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SyncSection } from "./sync-section";

const mutationState = vi.hoisted(() => ({
    currentUser: {
        mutate: vi.fn(),
        reset: vi.fn(),
        isPending: false,
        error: null as Error | null,
        data: null as unknown,
    },
    refresh: {
        mutate: vi.fn(),
        reset: vi.fn(),
        isPending: false,
        error: null as Error | null,
        data: null as unknown,
    },
    poll: {
        mutate: vi.fn(),
        reset: vi.fn(),
        isPending: false,
        error: null as Error | null,
        data: null as unknown,
    },
}));

vi.mock("~/trpc/react", () => ({
    api: {
        sync: {
            currentUser: {
                useMutation: vi.fn(() => mutationState.currentUser),
            },
            refreshOwnerRepos: {
                useMutation: vi.fn(() => mutationState.refresh),
            },
            poll: {
                useMutation: vi.fn(() => mutationState.poll),
            },
        },
    },
}));

describe("SyncSection", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mutationState.currentUser.isPending = false;
        mutationState.currentUser.error = null;
        mutationState.currentUser.data = null;
        mutationState.refresh.isPending = false;
        mutationState.refresh.error = null;
        mutationState.refresh.data = null;
        mutationState.poll.isPending = false;
        mutationState.poll.error = null;
        mutationState.poll.data = null;
    });

    it("prompts to link an account when no provider is connected", () => {
        render(<SyncSection hasGithub={false} hasCodeberg={false} />);

        expect(
            screen.getByText(/link a github or codeberg account/i),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /sync permissions/i }),
        ).not.toBeInTheDocument();
    });

    it("renders both sync cards when a provider is connected", () => {
        render(<SyncSection hasGithub hasCodeberg={false} />);

        expect(
            screen.getByRole("heading", { name: /sync my permissions/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", {
                name: /refresh owner repositories/i,
            }),
        ).toBeInTheDocument();
    });

    it("syncs the current user when the button is clicked", async () => {
        const user = userEvent.setup();
        render(<SyncSection hasGithub hasCodeberg={false} />);

        await user.click(
            screen.getByRole("button", { name: /sync permissions/i }),
        );

        expect(mutationState.currentUser.mutate).toHaveBeenCalledTimes(1);
    });

    it("refreshes owner repos with the selected provider and owner", async () => {
        const user = userEvent.setup();
        render(<SyncSection hasGithub hasCodeberg />);

        await user.selectOptions(
            screen.getByRole("combobox"),
            screen.getByRole("option", { name: "Codeberg" }),
        );
        await user.type(screen.getByPlaceholderText(/owner/i), "neosrc ");
        await user.click(
            screen.getByRole("button", { name: /refresh repos/i }),
        );

        expect(mutationState.refresh.mutate).toHaveBeenCalledWith({
            provider: "codeberg",
            owner: "neosrc",
        });
    });

    it("disables the refresh button until an owner is typed", async () => {
        const user = userEvent.setup();
        render(<SyncSection hasGithub hasCodeberg={false} />);

        const button = screen.getByRole("button", { name: /refresh repos/i });
        expect(button).toBeDisabled();

        await user.type(screen.getByPlaceholderText(/owner/i), "acme");
        expect(button).toBeEnabled();
    });

    it("shows the per-provider sync result after syncing", () => {
        mutationState.currentUser.data = {
            github: {
                accountsUpserted: 2,
                reposUpserted: 14,
                relationsWritten: 3,
                relationsRemoved: 1,
                teamsSkipped: 0,
            },
        };
        render(<SyncSection hasGithub hasCodeberg={false} />);

        expect(
            screen.getByText(
                /2 accounts, 14 repos, 3 grants added, 1 removed/i,
            ),
        ).toBeInTheDocument();
    });

    it("shows the refresh result and surfaces mutation errors", () => {
        mutationState.refresh.data = {
            accountsUpserted: 1,
            reposUpserted: 22,
            relationsWritten: 0,
            relationsRemoved: 0,
            teamsSkipped: 2,
        };
        mutationState.currentUser.error = new Error("sync failed");
        render(<SyncSection hasGithub hasCodeberg={false} />);

        expect(
            screen.getByText(/1 account, 22 repos, 2 teams skipped/i),
        ).toBeInTheDocument();
        expect(screen.getByText("sync failed")).toBeInTheDocument();
    });

    it("polls the incremental sync on mount and reports up-to-date state", () => {
        mutationState.poll.data = {
            github: { changed: false, result: null },
        };
        render(<SyncSection hasGithub hasCodeberg={false} />);

        expect(mutationState.poll.mutate).toHaveBeenCalled();
        expect(
            screen.getByText(/permissions are up to date/i),
        ).toBeInTheDocument();
    });

    it("reports when the incremental poll detected permission changes", () => {
        mutationState.poll.data = {
            codeberg: {
                changed: true,
                result: {
                    accountsUpserted: 1,
                    reposUpserted: 3,
                    relationsWritten: 2,
                    relationsRemoved: 0,
                    teamsSkipped: 0,
                },
            },
        };
        render(<SyncSection hasGithub hasCodeberg />);

        expect(
            screen.getByText(/permission changes detected and synced/i),
        ).toBeInTheDocument();
    });

    it("disables the sync button and shows the pending label while syncing", () => {
        mutationState.currentUser.isPending = true;
        render(<SyncSection hasGithub hasCodeberg={false} />);

        expect(screen.getByRole("button", { name: /syncing/i })).toBeDisabled();
    });

    it("surfaces incremental poll failures instead of a stale verdict", () => {
        mutationState.poll.error = new Error("poll exploded");
        render(<SyncSection hasGithub hasCodeberg={false} />);

        expect(
            screen.getByText(/sync check failed: poll exploded/i),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/permissions are up to date/i),
        ).not.toBeInTheDocument();
    });
});
