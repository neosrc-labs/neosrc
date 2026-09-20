import { screen } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { expect, vi } from "vitest";
import { api } from "~/trpc/react";

export function getSearchInput() {
    return screen.getByPlaceholderText(
        /Search (issues|pull requests) by title, body, or comments/,
    ) as HTMLInputElement;
}

export async function mockLabelData(
    labels?: { name: string; color: string }[],
) {
    const labelList = labels ?? [
        { name: "bug", color: "d73a4a" },
        { name: "enhancement", color: "a2eeef" },
    ];
    const listLabelsMock = vi.mocked(api.pulls.listLabels.useQuery);
    listLabelsMock.mockReturnValue({
        data: labelList,
        isLoading: false,
    } as never);
}

export async function openDropdownAndSelectLabel(
    user: UserEvent,
    labelName: string,
) {
    const existingInput = screen.queryByPlaceholderText("Filter labels");
    if (!existingInput) {
        const labelButton = screen
            .getAllByRole("button")
            .find((button) => button.textContent?.trim() === "Label");
        if (!labelButton) throw new Error("Label button not found");
        await user.click(labelButton);
    }

    const dropdownInput = await screen.findByPlaceholderText("Filter labels");
    expect(dropdownInput).toBeInTheDocument();
    await user.clear(dropdownInput);
    await user.type(dropdownInput, labelName);

    const option = screen.getByRole("option", {
        name: new RegExp(`^${labelName}$`, "i"),
    });
    await user.click(option);
}

export async function mockUserSearchData(
    users?: { login: string; avatar_url: string }[],
) {
    const userList = users ?? [{ login: "testuser", avatar_url: "" }];
    const trpc = api;

    vi.mocked(trpc.pulls.listAssignees.useQuery).mockReturnValue({
        data: userList,
        isLoading: false,
    } as never);
    vi.mocked(trpc.pulls.listRecentAuthors.useQuery).mockReturnValue({
        data: userList,
        isLoading: false,
    } as never);
    vi.mocked(trpc.users.currentUser.useQuery).mockReturnValue({
        data: { login: userList[0]?.login ?? "testuser", avatar_url: "" },
        isLoading: false,
    } as never);
}

export async function openDropdownAndSelectUser(
    user: UserEvent,
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
