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

// --- Test Helpers ---

function getSearchInput() {
    return screen.getByPlaceholderText(
        "Search pull requests by title, body, or comments",
    ) as HTMLInputElement;
}

async function mockLabelData(labels?: { name: string; color: string }[]) {
    const labelList = labels ?? [
        { name: "bug", color: "d73a4a" },
        { name: "enhancement", color: "a2eeef" },
    ];
    const listLabelsMock = vi.mocked(
        (await import("~/trpc/react")).api.pulls.listLabels.useQuery,
    );
    listLabelsMock.mockReturnValue({
        data: labelList,
        isLoading: false,
    } as never);
}

async function openDropdownAndSelectLabel(
    user: ReturnType<typeof userEvent.setup>,
    labelName: string,
) {
    // Only open the dropdown if it's not already open (labels don't autoclose)
    const existingInput = screen.queryByPlaceholderText("Filter labels");
    if (!existingInput) {
        const allButtons = screen.getAllByRole("button");
        const labelBtn = allButtons.find(
            (b) => b.textContent?.trim() === "Label",
        );
        if (!labelBtn) throw new Error("Label button not found");
        await user.click(labelBtn);
    }

    const dropdownInput = await screen.findByPlaceholderText("Filter labels");
    expect(dropdownInput).toBeInTheDocument();

    // Clear any previous filter text and type the new label name
    await user.clear(dropdownInput);
    await user.type(dropdownInput, labelName);

    const option = screen.getByRole("option", {
        name: new RegExp(`^${labelName}$`, "i"),
    });
    await user.click(option);
}

async function mockUserSearchData(
    users?: { login: string; avatar_url: string }[],
) {
    const userList = users ?? [{ login: "testuser", avatar_url: "" }];
    const listAssigneesMock = vi.mocked(
        (await import("~/trpc/react")).api.pulls.listAssignees.useQuery,
    );
    listAssigneesMock.mockReturnValue({
        data: userList,
        isLoading: false,
    } as never);

    const listRecentAuthorsMock = vi.mocked(
        (await import("~/trpc/react")).api.pulls.listRecentAuthors.useQuery,
    );
    listRecentAuthorsMock.mockReturnValue({
        data: userList,
        isLoading: false,
    } as never);

    const currentUserMock = vi.mocked(
        (await import("~/trpc/react")).api.users.currentUser.useQuery,
    );
    currentUserMock.mockReturnValue({
        data: { login: userList[0]?.login ?? "testuser", avatar_url: "" },
        isLoading: false,
    } as never);
}

async function openDropdownAndSelectUser(
    user: ReturnType<typeof userEvent.setup>,
    triggerName: RegExp,
    searchText?: string,
) {
    const text = searchText ?? "testuser";
    await user.click(screen.getByRole("button", { name: triggerName }));

    const dropdownInput = screen.getByPlaceholderText("Filter users...");
    expect(dropdownInput).toBeInTheDocument();

    await user.type(dropdownInput, text);

    const option = screen.getByRole("option", { name: new RegExp(text, "i") });
    await user.click(option);
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

    it("clicking the Merged tab adds 'is:merged ' to the search bar", async () => {
        const user = userEvent.setup();
        renderList();

        await user.click(screen.getByRole("button", { name: /merged/i }));

        const input = screen.getByPlaceholderText(
            "Search pull requests by title, body, or comments",
        ) as HTMLInputElement;
        expect(input.value).toBe("is:merged ");
        expect(input.selectionStart).toBe("is:merged ".length);
    });

    it("typing 'is:c' and pressing Enter selects 'is:closed' from autocomplete and switches to Closed tab", async () => {
        const user = userEvent.setup();
        renderList();

        const input = screen.getByPlaceholderText(
            "Search pull requests by title, body, or comments",
        ) as HTMLInputElement;

        await user.click(input);
        await user.type(input, "is:c");

        expect(input.value).toBe("is:c");

        await user.keyboard("{Enter}");

        expect(input.value).toBe("is:closed ");
        expect(input.selectionStart).toBe("is:closed ".length);

        const pushCalls = mockRouter.push.mock.calls.map((c) => c[0] as string);
        expect(pushCalls.some((url) => url.includes("state=closed"))).toBe(
            true,
        );
        expect(pushCalls.some((url) => url.includes("q=is%3Aclosed"))).toBe(
            true,
        );

        const closedTab = screen.getByRole("button", { name: /closed/i });
        expect(closedTab.className).toContain("border-blue-500");
    });

    it("clicking the Closed tab adds 'is:closed ' to the search bar", async () => {
        const user = userEvent.setup();
        renderList();

        await user.click(screen.getByRole("button", { name: /closed/i }));

        const input = screen.getByPlaceholderText(
            "Search pull requests by title, body, or comments",
        ) as HTMLInputElement;
        expect(input.value).toBe("is:closed ");
        expect(input.selectionStart).toBe("is:closed ".length);
    });

    it("clicking Merged tab sets 'is:merged ', then clicking Open tab clears the search bar", async () => {
        const user = userEvent.setup();
        renderList();

        const input = screen.getByPlaceholderText(
            "Search pull requests by title, body, or comments",
        ) as HTMLInputElement;

        await user.click(screen.getByRole("button", { name: /merged/i }));
        expect(input.value).toBe("is:merged ");

        await user.click(screen.getByRole("button", { name: /open/i }));
        expect(input.value).toBe("");
    });

    it("clicking the Author button and selecting a user adds 'author:<login>' to the search bar", async () => {
        await mockUserSearchData();

        const user = userEvent.setup();
        renderList();

        await openDropdownAndSelectUser(user, /author/i);

        expect(getSearchInput().value).toContain("author:testuser");
    });

    it("clicking the Assignee button and selecting a user adds 'assignee:<login>' to the search bar", async () => {
        await mockUserSearchData();

        const user = userEvent.setup();
        renderList();

        await openDropdownAndSelectUser(user, /assignee/i);

        expect(getSearchInput().value).toContain("assignee:testuser");
    });

    it("selecting a second author replaces the first author in the search bar", async () => {
        await mockUserSearchData([
            { login: "user1", avatar_url: "" },
            { login: "user2", avatar_url: "" },
        ]);

        const user = userEvent.setup();
        renderList();

        await openDropdownAndSelectUser(user, /author/i, "user1");
        expect(getSearchInput().value).toContain("author:user1");

        await openDropdownAndSelectUser(user, /author/i, "user2");
        expect(getSearchInput().value).toContain("author:user2");
        expect(getSearchInput().value).not.toContain("author:user1");
    });

    it("selecting a second assignee replaces the first assignee in the search bar", async () => {
        await mockUserSearchData([
            { login: "user1", avatar_url: "" },
            { login: "user2", avatar_url: "" },
        ]);

        const user = userEvent.setup();
        renderList();

        await openDropdownAndSelectUser(user, /assignee/i, "user1");
        expect(getSearchInput().value).toContain("assignee:user1");

        await openDropdownAndSelectUser(user, /assignee/i, "user2");
        expect(getSearchInput().value).toContain("assignee:user2");
        expect(getSearchInput().value).not.toContain("assignee:user1");
    });

    it("adds two labels, an author, and clicks Closed tab - search bar shows all qualifiers", async () => {
        await mockLabelData([
            { name: "bug", color: "d73a4a" },
            { name: "enhancement", color: "a2eeef" },
        ]);
        await mockUserSearchData([{ login: "testuser", avatar_url: "" }]);

        const user = userEvent.setup();
        renderList();

        await openDropdownAndSelectLabel(user, "bug");

        await openDropdownAndSelectLabel(user, "enhancement");
        await openDropdownAndSelectUser(user, /author/i);

        await user.click(screen.getByRole("button", { name: /closed/i }));

        const value = getSearchInput().value;
        expect(value).toContain(
            "label:bug label:enhancement author:testuser is:closed",
        );
    });
});
