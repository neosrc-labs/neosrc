import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "~/components/ui/tooltip";
import { MarkdownEditor } from "../markdown-editor";

vi.mock("~/trpc/react", () => ({
    api: {
        issues: {
            searchAutocomplete: {
                useQuery: () => ({
                    data: [{ number: 12, title: "Fix login", type: "issue" }],
                    isFetching: false,
                    isError: false,
                    error: undefined,
                }),
            },
        },
    },
}));

type EditorProps = Parameters<typeof MarkdownEditor>[0];

// Keeps the editor controlled so typing updates the value like a real parent.
function Harness(props: Partial<EditorProps>) {
    const [value, setValue] = useState(props.value ?? "");
    return (
        <MarkdownEditor
            {...props}
            value={value}
            onChange={(v) => {
                props.onChange?.(v);
                setValue(v);
            }}
        />
    );
}

function typeInTextarea(text: string) {
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: text } });
}

function renderEditor(ui: React.ReactElement) {
    return render(<TooltipProvider>{ui}</TooltipProvider>);
}

describe("MarkdownEditor", () => {
    it("renders toolbar tabs and buttons, textarea, cancel, and footer actions", () => {
        renderEditor(
            <Harness
                onCancel={() => {}}
                footerActions={[
                    {
                        label: "Comment",
                        variant: "approve",
                        onClick: () => {},
                    },
                    {
                        label: "Resolve",
                        tooltip: "Marks the thread resolved",
                        disabled: (text) => text.length === 0,
                        onClick: () => {},
                    },
                ]}
            />,
        );

        expect(
            screen.getByRole("button", { name: "Write" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Preview" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Bold (Ctrl+B)" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Insert table" }),
        ).toBeInTheDocument();
        expect(screen.getByRole("textbox")).toBeEnabled();
        expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
        expect(
            screen.getByRole("button", { name: "Comment" }),
        ).toBeInTheDocument();
        // disabled callback receives the current text; empty text disables it
        expect(screen.getByRole("button", { name: "Resolve" })).toBeDisabled();
    });

    it("applies bold formatting through the toolbar button", () => {
        const onChange = vi.fn();
        renderEditor(<Harness value="word" onChange={onChange} />);

        fireEvent.click(screen.getByRole("button", { name: "Bold (Ctrl+B)" }));

        expect(onChange).toHaveBeenCalledWith(expect.stringContaining("**"));
    });

    it("switches to preview and hides the write surface", () => {
        renderEditor(<Harness value="**hello**" />);

        fireEvent.click(screen.getByRole("button", { name: "Preview" }));

        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: "Bold (Ctrl+B)" }),
        ).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Write" }));
        expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    it("opens the slash command popover when typing /", () => {
        renderEditor(<Harness />);

        typeInTextarea("/");

        expect(screen.getByText("Insert a markdown table")).toBeInTheDocument();
        expect(
            screen.getByText("Insert a GitHub alert blockquote"),
        ).toBeInTheDocument();
    });

    it("shows the issue autocomplete popover while typing a # query", () => {
        renderEditor(<Harness owner="o" repo="r" />);

        typeInTextarea("#");

        expect(screen.getByText("Fix login")).toBeInTheDocument();
    });

    it("hides footer actions when none are provided", () => {
        renderEditor(<Harness />);
        expect(
            screen.queryByRole("button", { name: "Cancel" }),
        ).not.toBeInTheDocument();
    });
});
