// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

let paramsState = new URLSearchParams();
function getSearchParams() {
    return paramsState;
}
function setSearchParams(params: URLSearchParams) {
    paramsState = params;
}

const mockRouter = {
    push: vi.fn((url: string) => {
        const queryStart = url.indexOf("?");
        if (queryStart !== -1) {
            setSearchParams(new URLSearchParams(url.slice(queryStart + 1)));
        }
    }),
    replace: vi.fn(),
};

vi.mock("next/navigation", () => ({
    useRouter: () => mockRouter,
    useSearchParams: () => getSearchParams(),
}));

vi.mock("~/trpc/react", () => ({
    api: {
        pulls: {
            search: {
                useQuery: vi.fn(() => ({
                    data: {
                        items: [],
                        totalCount: 0,
                        hasNextPage: false,
                        endCursor: null,
                        stateCounts: { open: 0, closed: 0 },
                    },
                    isLoading: false,
                })),
            },
            listLabels: {
                useQuery: vi.fn(() => ({ data: [], isLoading: false })),
            },
            listAssignees: {
                useQuery: vi.fn(() => ({ data: [], isLoading: false })),
            },
            listRecentAuthors: {
                useQuery: vi.fn(() => ({ data: [], isLoading: false })),
            },
            listMilestones: {
                useQuery: vi.fn(() => ({ data: [], isLoading: false })),
            },
        },
        users: {
            currentUser: {
                useQuery: vi.fn(() => ({ data: null, isLoading: false })),
            },
            getByUsername: {
                useQuery: vi.fn(() => ({ data: null, isFetched: true })),
            },
        },
    },
}));

import { PullRequestList } from "~/app/[owner]/[repo]/pulls/_components/pull-request-list";

// --- Helpers ---

function renderList(props?: {
    owner?: string;
    repo?: string;
    defaultState?: string;
}) {
    return render(
        <PullRequestList
            owner={props?.owner ?? "test-owner"}
            repo={props?.repo ?? "test-repo"}
            defaultState={
                (props?.defaultState as "open" | "closed" | "merged") ?? "open"
            }
        />,
    );
}

// --- Tests ---

describe("PullRequestList", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        paramsState.delete("state");
        paramsState.delete("q");
        paramsState.delete("page");
        paramsState.delete("sort");
        paramsState.delete("order");
    });

    it("renders the search input with placeholder", () => {
        renderList();
        const input = screen.getByPlaceholderText(
            "Search pull requests by title, body, or comments",
        );
        expect(input).toBeInTheDocument();
    });

    it("renders tab buttons: Open, Closed, Merged", () => {
        renderList();
        expect(
            screen.getByRole("button", { name: /open/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /closed/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /merged/i }),
        ).toBeInTheDocument();
    });

    it("shows Open as the default active tab", () => {
        renderList();
        const openTab = screen.getByRole("button", { name: /open/i });
        expect(openTab.className).toContain("border-blue-500");
    });

    it("navigates when a tab is clicked", async () => {
        const user = userEvent.setup();
        renderList();

        await user.click(screen.getByRole("button", { name: /closed/i }));

        expect(mockRouter.push).toHaveBeenCalledWith(
            expect.stringContaining("state=closed"),
        );
    });

    it("renders header links: Labels, Milestones, New Pull Request", () => {
        renderList();
        expect(
            screen.getByRole("link", { name: /labels/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: /milestones/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: /new pull request/i }),
        ).toBeInTheDocument();
    });

    it("submits search on Enter key", async () => {
        const user = userEvent.setup();
        renderList();

        const input = screen.getByPlaceholderText(
            "Search pull requests by title, body, or comments",
        );
        await user.type(input, "test query");
        await user.keyboard("{Enter}");

        expect(mockRouter.push).toHaveBeenCalledWith(
            expect.stringContaining("q=test+query"),
        );
    });

    it("submits search when Search button is clicked", async () => {
        const user = userEvent.setup();
        renderList();

        const input = screen.getByPlaceholderText(
            "Search pull requests by title, body, or comments",
        );
        await user.type(input, "button search");

        const searchButton = screen.getByRole("button", { name: /search/i });
        await user.click(searchButton);

        expect(mockRouter.push).toHaveBeenCalledWith(
            expect.stringContaining("q=button+search"),
        );
    });

    it("appears on the correct tab based on URL state param", () => {
        paramsState.set("state", "closed");
        renderList();
        const closedTab = screen.getByRole("button", { name: /closed/i });
        expect(closedTab.className).toContain("border-blue-500");
    });

    it("typing 'is:m' and pressing Enter selects 'is:merged' from autocomplete and switches to Merged tab", async () => {
        const user = userEvent.setup();
        renderList();

        const input = screen.getByPlaceholderText(
            "Search pull requests by title, body, or comments",
        ) as HTMLInputElement;

        // Type "is:m" which should trigger the autocomplete for "is:" with "merged" as a suggestion
        await user.click(input);
        await user.type(input, "is:m");

        // Verify the input has the expected value
        expect(input.value).toBe("is:m");

        // Press Enter to select "merged" from autocomplete
        await user.keyboard("{Enter}");

        // The search input should now show "is:merged " with cursor at the end
        expect(input.value).toBe("is:merged ");
        expect(input.selectionStart).toBe("is:merged ".length);

        // Selecting from autocomplete should have navigated with state=merged
        const pushCalls = mockRouter.push.mock.calls.map((c) => c[0] as string);
        expect(pushCalls.some((url) => url.includes("state=merged"))).toBe(
            true,
        );
        expect(pushCalls.some((url) => url.includes("q=is%3Amerged"))).toBe(
            true,
        );

        const mergedTab = screen.getByRole("button", { name: /merged/i });
        expect(mergedTab.className).toContain("border-blue-500");
    });
});
