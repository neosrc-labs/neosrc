"use client";

import {
    SearchListToolbar,
    type SearchListToolbarProps,
} from "~/components/list/search-list-toolbar";

const TABS = [
    { key: "open", label: "Open" },
    { key: "closed", label: "Closed" },
];

type IssueToolbarProps = Omit<
    SearchListToolbarProps,
    "tabs" | "showAssigneeFilter" | "children"
>;

export function IssueToolbar(props: IssueToolbarProps) {
    return <SearchListToolbar {...props} tabs={TABS} showAssigneeFilter />;
}
