// Shared test-suite factory for the IssueList and PullRequestList suites.
//
// Both suites render a searchable list with tab navigation, label/user
// qualifiers, and tRPC-backed search. They differ only in the component
// under test, the tRPC namespace of the search procedure, the presence of
// a Merged tab, the header "New Pull Request" link, a few extra api mocks
// (pulls), and the empty-state copy (issues). This factory registers the
// full describe block and parameterizes those differences via
// ListTestConfig.
//
// The component is loaded lazily (see ListTestConfig.loadComponent): the
// vi.mock registrations in this module must run before any component
// module is evaluated, and the trpc mock wires the configured search
// namespace, so the component cannot be imported statically.

import { type RenderResult, render, screen } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import type { ComponentType } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock state ---
// Hoisted so the vi.mock factories below can reference the same vi.fn
// instances the tests assert on. The namespace/extra-mock flags are set
// by createListTests before the component is imported, so the mocked
// trpc module is wired per suite.

const hoisted = vi.hoisted(() => {
    let paramsState = new URLSearchParams();

    const mockRouter = {
        push: vi.fn((url: string) => {
            const queryStart = url.indexOf("?");
            if (queryStart !== -1) {
                paramsState = new URLSearchParams(url.slice(queryStart + 1));
            }
        }),
        replace: vi.fn(),
    };

    const mockSearchFetch = vi.fn(() =>
        Promise.resolve({
            items: [],
            totalCount: 0,
            hasNextPage: false,
            endCursor: null,
            stateCounts: { open: 0, closed: 0 },
        }),
    );

    const searchUseQuery = vi.fn(() => ({
        data: {
            items: [],
            totalCount: 0,
            hasNextPage: false,
            endCursor: null,
            stateCounts: { open: 0, closed: 0 },
        },
        isLoading: false,
    }));

    const listLabelsUseQuery = vi.fn(() => ({ data: [], isLoading: false }));
    const listAssigneesUseQuery = vi.fn(() => ({
        data: [],
        isLoading: false,
    }));
    const listRecentAuthorsUseQuery = vi.fn(() => ({
        data: [],
        isLoading: false,
    }));
    const listMilestonesUseQuery = vi.fn(() => ({
        data: [],
        isLoading: false,
    }));
    const listDetailsByPrNumbersUseQuery = vi.fn(() => ({
        data: {},
        isLoading: false,
    }));
    const currentUserUseQuery = vi.fn(() => ({ data: null, isLoading: false }));
    const getByUsernameUseQuery = vi.fn(() => ({
        data: null,
        isFetched: true,
    }));

    return {
        getSearchParams: (): URLSearchParams => paramsState,
        setSearchParams: (params: URLSearchParams) => {
            paramsState = params;
        },
        clearParams: () => {
            paramsState.delete("state");
            paramsState.delete("q");
            paramsState.delete("page");
            paramsState.delete("sort");
            paramsState.delete("order");
        },
        setParam: (key: string, value: string) => {
            paramsState.set(key, value);
        },
        mockRouter,
        mockSearchFetch,
        searchUseQuery,
        listLabelsUseQuery,
        listAssigneesUseQuery,
        listRecentAuthorsUseQuery,
        listMilestonesUseQuery,
        listDetailsByPrNumbersUseQuery,
        currentUserUseQuery,
        getByUsernameUseQuery,
        searchNamespace: "issues" as "issues" | "pulls",
        extraApiMocks: false as boolean,
    };
});

// --- Mocks ---

vi.mock("next/navigation", () => ({
    useRouter: () => hoisted.mockRouter,
    useSearchParams: () => hoisted.getSearchParams(),
}));

vi.mock("~/trpc/react", () => {
    const ns = hoisted.searchNamespace;
    return {
        api: {
            useUtils: vi.fn(() => ({
                [ns]: {
                    search: {
                        fetch: hoisted.mockSearchFetch,
                    },
                },
            })),
            issues:
                ns === "issues"
                    ? { search: { useQuery: hoisted.searchUseQuery } }
                    : {},
            pulls: {
                ...(ns === "pulls"
                    ? { search: { useQuery: hoisted.searchUseQuery } }
                    : {}),
                listLabels: { useQuery: hoisted.listLabelsUseQuery },
                listAssignees: { useQuery: hoisted.listAssigneesUseQuery },
                listRecentAuthors: {
                    useQuery: hoisted.listRecentAuthorsUseQuery,
                },
                listMilestones: { useQuery: hoisted.listMilestonesUseQuery },
                ...(hoisted.extraApiMocks
                    ? {
                          listDetailsByPrNumbers: {
                              useQuery: hoisted.listDetailsByPrNumbersUseQuery,
                          },
                      }
                    : {}),
            },
            ...(hoisted.extraApiMocks ? { checks: {} } : {}),
            users: {
                currentUser: { useQuery: hoisted.currentUserUseQuery },
                getByUsername: { useQuery: hoisted.getByUsernameUseQuery },
            },
        },
    };
});

const mockRouter = hoisted.mockRouter;

// --- Configuration ---

export interface ListProps {
    owner: string;
    repo: string;
    defaultState: "open" | "closed";
}

export interface EmptyStateCopy {
    noOpen: string;
    noClosed: string;
    noMatch: string;
}

export interface ListTestConfig {
    /** describe() name for the suite ("IssueList" or "PullRequestList"). */
    describeName: string;
    /** Search input placeholder, asserted verbatim by the suite. */
    searchPlaceholder: string;
    /** tRPC namespace the search procedure is mocked under. */
    searchNamespace: "issues" | "pulls";
    /** Whether the component renders a Merged tab. */
    hasMergedTab: boolean;
    /** Whether the header links include "New Pull Request". */
    hasNewPullRequestLink: boolean;
    /** Extra tRPC api mocks required by the pulls list. */
    extraApiMocks?: boolean;
    /** Empty-state copy; when present, the empty-state tests are registered. */
    emptyState?: EmptyStateCopy;
    /**
     * Lazily imports the component under test. Must stay lazy: this
     * factory registers the trpc/navigation mocks before any component
     * module is evaluated, and the trpc mock wires the configured search
     * namespace, so the component cannot be imported statically.
     */
    loadComponent: () => Promise<ComponentType<ListProps>>;
}

// --- Helpers ---

interface SuiteHelpers {
    renderList: (props?: {
        owner?: string;
        repo?: string;
        defaultState?: string;
    }) => RenderResult;
    getSearchInput: () => HTMLInputElement;
    mockLabelData: (labels?: { name: string; color: string }[]) => void;
    openDropdownAndSelectLabel: (
        user: UserEvent,
        labelName: string,
    ) => Promise<void>;
    mockUserSearchData: (
        users?: { login: string; avatar_url: string }[],
    ) => void;
    openDropdownAndSelectUser: (
        user: UserEvent,
        triggerName: RegExp,
        searchText?: string,
    ) => Promise<void>;
}

function mockLabelData(labels?: { name: string; color: string }[]) {
    const labelList = labels ?? [
        { name: "bug", color: "d73a4a" },
        { name: "enhancement", color: "a2eeef" },
    ];
    hoisted.listLabelsUseQuery.mockReturnValue({
        data: labelList,
        isLoading: false,
    } as never);
}

async function openDropdownAndSelectLabel(user: UserEvent, labelName: string) {
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

function mockUserSearchData(users?: { login: string; avatar_url: string }[]) {
    const userList = users ?? [{ login: "testuser", avatar_url: "" }];
    hoisted.listAssigneesUseQuery.mockReturnValue({
        data: userList,
        isLoading: false,
    } as never);
    hoisted.listRecentAuthorsUseQuery.mockReturnValue({
        data: userList,
        isLoading: false,
    } as never);
    hoisted.currentUserUseQuery.mockReturnValue({
        data: {
            login: userList[0]?.login ?? "testuser",
            avatar_url: "",
        },
        isLoading: false,
    } as never);
}

async function openDropdownAndSelectUser(
    user: UserEvent,
    triggerName: RegExp,
    searchText?: string,
) {
    const text = searchText ?? "testuser";
    await user.click(screen.getByRole("button", { name: triggerName }));

    const dropdownInput = screen.getByPlaceholderText("Filter users...");
    expect(dropdownInput).toBeInTheDocument();

    await user.type(dropdownInput, text);

    const option = screen.getByRole("option", {
        name: new RegExp(text, "i"),
    });
    await user.click(option);
}

// --- Suite ---

export function createListTests(config: ListTestConfig) {
    hoisted.searchNamespace = config.searchNamespace;
    hoisted.extraApiMocks = config.extraApiMocks ?? false;

    const { emptyState } = config;

    describe(config.describeName, () => {
        let List: ComponentType<ListProps>;

        beforeAll(async () => {
            List = await config.loadComponent();
        });

        beforeEach(() => {
            vi.clearAllMocks();
            hoisted.clearParams();
        });

        const helpers: SuiteHelpers = {
            renderList: (props) =>
                render(
                    <List
                        owner={props?.owner ?? "test-owner"}
                        repo={props?.repo ?? "test-repo"}
                        defaultState={
                            (props?.defaultState as ListProps["defaultState"]) ??
                            "open"
                        }
                    />,
                ),
            getSearchInput: () =>
                screen.getByPlaceholderText(
                    config.searchPlaceholder,
                ) as HTMLInputElement,
            mockLabelData,
            openDropdownAndSelectLabel,
            mockUserSearchData,
            openDropdownAndSelectUser,
        };

        registerBasicRenderTests(config, helpers);
        registerSearchAndTabTests(config, helpers);
        registerQualifierTests(helpers);

        if (emptyState) {
            registerEmptyStateTests(emptyState, helpers);
        }
    });
}

function registerTabButtonsTest(hasMergedTab: boolean, helpers: SuiteHelpers) {
    const { renderList } = helpers;
    it(
        hasMergedTab
            ? "renders tab buttons: Open, Closed, Merged"
            : "renders tab buttons: Open and Closed (no Merged)",
        () => {
            renderList();
            expect(
                screen.getByRole("button", { name: /open/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: /closed/i }),
            ).toBeInTheDocument();
            if (hasMergedTab) {
                expect(
                    screen.getByRole("button", { name: /merged/i }),
                ).toBeInTheDocument();
            } else {
                expect(
                    screen.queryByRole("button", { name: /merged/i }),
                ).not.toBeInTheDocument();
            }
        },
    );
}

function registerHeaderLinksTest(
    hasNewPullRequestLink: boolean,
    helpers: SuiteHelpers,
) {
    const { renderList } = helpers;
    it(
        hasNewPullRequestLink
            ? "renders header links: Labels, Milestones, New Pull Request"
            : "renders header links: Labels, Milestones (no New Pull Request)",
        () => {
            renderList();
            expect(
                screen.getByRole("link", { name: /labels/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole("link", { name: /milestones/i }),
            ).toBeInTheDocument();
            if (hasNewPullRequestLink) {
                expect(
                    screen.getByRole("link", { name: /new pull request/i }),
                ).toBeInTheDocument();
            } else {
                expect(
                    screen.queryByRole("link", { name: /new pull request/i }),
                ).not.toBeInTheDocument();
            }
        },
    );
}

function registerBasicRenderTests(
    config: ListTestConfig,
    helpers: SuiteHelpers,
) {
    const { renderList } = helpers;

    it("renders the search input with placeholder", () => {
        renderList();
        const input = screen.getByPlaceholderText(config.searchPlaceholder);
        expect(input).toBeInTheDocument();
    });

    registerTabButtonsTest(config.hasMergedTab, helpers);

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

    registerHeaderLinksTest(config.hasNewPullRequestLink, helpers);
}

function registerSearchAndTabTests(
    config: ListTestConfig,
    helpers: SuiteHelpers,
) {
    const { renderList } = helpers;

    function registerTabAddsQualifierTest(state: string) {
        const label = state.charAt(0).toUpperCase() + state.slice(1);
        it(`clicking the ${label} tab adds 'is:${state} ' to the search bar`, async () => {
            const user = userEvent.setup();
            renderList();

            await user.click(
                screen.getByRole("button", { name: new RegExp(state, "i") }),
            );

            const input = screen.getByPlaceholderText(
                config.searchPlaceholder,
            ) as HTMLInputElement;
            expect(input.value).toBe(`is:${state} `);
            expect(input.selectionStart).toBe(`is:${state} `.length);
        });
    }

    it("submits search on Enter key", async () => {
        const user = userEvent.setup();
        renderList();

        const input = screen.getByPlaceholderText(config.searchPlaceholder);
        await user.type(input, "test query");
        await user.keyboard("{Enter}");

        expect(mockRouter.push).toHaveBeenCalledWith(
            expect.stringContaining("q=test+query"),
        );
    });

    it("submits search when Search button is clicked", async () => {
        const user = userEvent.setup();
        renderList();

        const input = screen.getByPlaceholderText(config.searchPlaceholder);
        await user.type(input, "button search");

        const searchButton = screen.getByRole("button", { name: /search/i });
        await user.click(searchButton);

        expect(mockRouter.push).toHaveBeenCalledWith(
            expect.stringContaining("q=button+search"),
        );
    });

    it("appears on the correct tab based on URL state param", () => {
        hoisted.setParam("state", "closed");
        renderList();
        const closedTab = screen.getByRole("button", { name: /closed/i });
        expect(closedTab.className).toContain("border-blue-500");
    });

    if (config.hasMergedTab) {
        it("typing 'is:m' and pressing Enter selects 'is:merged' from autocomplete and switches to Merged tab", async () => {
            const user = userEvent.setup();
            renderList();

            const input = screen.getByPlaceholderText(
                config.searchPlaceholder,
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
            const pushCalls = mockRouter.push.mock.calls.map(
                (c) => c[0] as string,
            );
            expect(pushCalls.some((url) => url.includes("state=merged"))).toBe(
                true,
            );
            expect(pushCalls.some((url) => url.includes("q=is%3Amerged"))).toBe(
                true,
            );

            const mergedTab = screen.getByRole("button", {
                name: /merged/i,
            });
            expect(mergedTab.className).toContain("border-blue-500");
        });

        registerTabAddsQualifierTest("merged");
    }

    it("typing 'is:c' and pressing Enter selects 'is:closed' from autocomplete and switches to Closed tab", async () => {
        const user = userEvent.setup();
        renderList();

        const input = screen.getByPlaceholderText(
            config.searchPlaceholder,
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

    registerTabAddsQualifierTest("closed");

    if (config.hasMergedTab) {
        it("clicking Merged tab sets 'is:merged ', then clicking Open tab clears the search bar", async () => {
            const user = userEvent.setup();
            renderList();

            const input = screen.getByPlaceholderText(
                config.searchPlaceholder,
            ) as HTMLInputElement;

            await user.click(screen.getByRole("button", { name: /merged/i }));
            expect(input.value).toBe("is:merged ");

            await user.click(screen.getByRole("button", { name: /open/i }));
            expect(input.value).toBe("");
        });
    } else {
        it("clicking Closed tab sets 'is:closed ', then clicking Open tab clears the search bar", async () => {
            const user = userEvent.setup();
            renderList();

            const input = screen.getByPlaceholderText(
                config.searchPlaceholder,
            ) as HTMLInputElement;

            await user.click(screen.getByRole("button", { name: /closed/i }));
            expect(input.value).toBe("is:closed ");

            await user.click(screen.getByRole("button", { name: /open/i }));
            expect(input.value).toBe("");
        });
    }
}

function registerQualifierTests(helpers: SuiteHelpers) {
    const { renderList, getSearchInput, mockUserSearchData } = helpers;

    const userQualifiers = ["author", "assignee"] as const;

    for (const qualifier of userQualifiers) {
        const label = qualifier.charAt(0).toUpperCase() + qualifier.slice(1);
        const trigger = new RegExp(qualifier, "i");

        it(`clicking the ${label} button and selecting a user adds '${qualifier}:<login>' to the search bar`, async () => {
            mockUserSearchData();

            const user = userEvent.setup();
            renderList();

            await openDropdownAndSelectUser(user, trigger);

            expect(getSearchInput().value).toContain(`${qualifier}:testuser`);
        });

        it(`selecting a second ${qualifier} replaces the first ${qualifier} in the search bar`, async () => {
            mockUserSearchData([
                { login: "user1", avatar_url: "" },
                { login: "user2", avatar_url: "" },
            ]);

            const user = userEvent.setup();
            renderList();

            await openDropdownAndSelectUser(user, trigger, "user1");
            expect(getSearchInput().value).toContain(`${qualifier}:user1`);

            await openDropdownAndSelectUser(user, trigger, "user2");
            expect(getSearchInput().value).toContain(`${qualifier}:user2`);
            expect(getSearchInput().value).not.toContain(`${qualifier}:user1`);
        });
    }

    it("adds two labels, an author, and clicks Closed tab - search bar shows all qualifiers", async () => {
        mockLabelData([
            { name: "bug", color: "d73a4a" },
            { name: "enhancement", color: "a2eeef" },
        ]);
        mockUserSearchData([{ login: "testuser", avatar_url: "" }]);

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
}

function registerEmptyStateTests(
    emptyState: EmptyStateCopy,
    helpers: SuiteHelpers,
) {
    const { renderList } = helpers;

    it("shows empty state for no open issues", () => {
        renderList();
        expect(screen.getByText(emptyState.noOpen)).toBeInTheDocument();
    });

    it("shows empty state for no closed issues", () => {
        hoisted.setParam("state", "closed");
        renderList();
        expect(screen.getByText(emptyState.noClosed)).toBeInTheDocument();
    });

    it("shows empty state with search message when search query is present", () => {
        hoisted.setParam("q", "something");
        renderList();
        expect(screen.getByText(emptyState.noMatch)).toBeInTheDocument();
    });
}
