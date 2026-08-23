"use client";

import {
    IssueAutocomplete,
    type IssueItem,
} from "./accessories/issue-autocomplete";
import { SlashCommandMenu } from "./accessories/slash-command-menu";

interface EditorPopoversProps {
    mode: "write" | "preview";
    autocompleteQuery: string | null;
    owner: string | undefined;
    repo: string | undefined;
    autocompleteIssues: IssueItem[];
    issuesLoading: boolean;
    autocompleteError: string | null;
    autocompleteIndex: number;
    onAutocompleteSelect: (issueNumber: number) => void;
    dropdownTop: number;
    slashMenuView: "menu" | "table-form" | "alert-form" | null;
    slashMenuPos: React.CSSProperties;
    onCommandSelect: (itemId: string) => void;
    onInsertTable: (columns: number, rows: number) => void;
    selectedAlertType: string;
    onSelectAlertType: (type: string) => void;
    onBackToMenu: () => void;
    onClose: () => void;
}

export function EditorPopovers({
    mode,
    autocompleteQuery,
    owner,
    repo,
    autocompleteIssues,
    issuesLoading,
    autocompleteError,
    autocompleteIndex,
    onAutocompleteSelect,
    dropdownTop,
    slashMenuView,
    slashMenuPos,
    onCommandSelect,
    onInsertTable,
    selectedAlertType,
    onSelectAlertType,
    onBackToMenu,
    onClose,
}: EditorPopoversProps) {
    if (mode !== "write") return null;
    return (
        <>
            {mode === "write" &&
                autocompleteQuery !== null &&
                owner &&
                repo &&
                !issuesLoading &&
                autocompleteIssues.length > 0 && (
                    <IssueAutocomplete
                        issues={autocompleteIssues}
                        loading={issuesLoading}
                        error={autocompleteError}
                        selectedIndex={autocompleteIndex}
                        onSelect={onAutocompleteSelect}
                        style={{ top: dropdownTop }}
                    />
                )}
            {mode === "write" && slashMenuView !== null && (
                <SlashCommandMenu
                    style={slashMenuPos}
                    view={slashMenuView}
                    onCommandSelect={onCommandSelect}
                    onInsertTable={onInsertTable}
                    selectedAlertType={selectedAlertType}
                    onSelectAlertType={onSelectAlertType}
                    onBackToMenu={onBackToMenu}
                    onClose={onClose}
                />
            )}{" "}
        </>
    );
}
