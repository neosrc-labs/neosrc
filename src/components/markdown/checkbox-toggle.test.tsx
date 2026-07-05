import { fireEvent, render } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { MarkdownRenderer } from "./MarkdownRenderer";

describe("checkbox index mapping", () => {
    it("maps the first clicked checkbox to the first task item", () => {
        const toggled: string[] = [];
        const content = "- [ ] task one\n- [ ] task two";
        const { container } = render(
            <MarkdownRenderer
                content={content}
                onToggleTask={(newContent) => toggled.push(newContent)}
                canToggleTasks
            />,
        );
        const inputs = container.querySelectorAll('input[type="checkbox"]');
        expect(inputs.length).toBe(2);
        // Click the FIRST checkbox
        fireEvent.click(inputs[0]!);
        expect(toggled.length).toBe(1);
        // The first task should now be checked, the second unchanged
        expect(toggled[0]).toBe("- [x] task one\n- [ ] task two");
    });

    it("does not count task markers inside fenced code blocks", () => {
        const toggled: string[] = [];
        const content = [
            "```",
            "- [ ] not a real checkbox (it's in a code block)",
            "```",
            "- [ ] real task one",
            "- [ ] real task two",
        ].join("\n");
        const { container } = render(
            <MarkdownRenderer
                content={content}
                onToggleTask={(newContent) => toggled.push(newContent)}
                canToggleTasks
            />,
        );
        const inputs = container.querySelectorAll('input[type="checkbox"]');
        // Only the two real task items should render checkboxes
        expect(inputs.length).toBe(2);
        fireEvent.click(inputs[0]!);
        expect(toggled[0]).toBe(
            [
                "```",
                "- [ ] not a real checkbox (it's in a code block)",
                "```",
                "- [x] real task one",
                "- [ ] real task two",
            ].join("\n"),
        );
    });

    it("counts task items inside blockquotes", () => {
        const toggled: string[] = [];
        const content =
            "> - [ ] quoted task\n- [ ] real task one\n- [ ] real task two";
        const { container } = render(
            <MarkdownRenderer
                content={content}
                onToggleTask={(newContent) => toggled.push(newContent)}
                canToggleTasks
            />,
        );
        const inputs = container.querySelectorAll('input[type="checkbox"]');
        expect(inputs.length).toBe(3);
        fireEvent.click(inputs[1]!);
        expect(toggled[0]).toBe(
            "> - [ ] quoted task\n- [x] real task one\n- [ ] real task two",
        );
    });

    it("counts ordered-list task items", () => {
        const toggled: string[] = [];
        const content = "1. [ ] ordered task\n- [ ] real task one";
        const { container } = render(
            <MarkdownRenderer
                content={content}
                onToggleTask={(newContent) => toggled.push(newContent)}
                canToggleTasks
            />,
        );
        const inputs = container.querySelectorAll('input[type="checkbox"]');
        expect(inputs.length).toBe(2);
        fireEvent.click(inputs[1]!);
        expect(toggled[0]).toBe("1. [ ] ordered task\n- [x] real task one");
    });

    it("toggles each of 3 boxes independently in sequence", () => {
        // Simulates the optimistic savedBody state advancing after each click
        // (so the content the renderer sees is the post-toggle body).
        const events: Array<{ index: number; result: string }> = [];
        function Harness() {
            const [body, setBody] = useState(
                "- [ ] one\n- [ ] two\n- [ ] three",
            );
            return (
                <div>
                    <MarkdownRenderer
                        canToggleTasks
                        content={body}
                        onToggleTask={(newContent) => {
                            events.push({
                                index: events.length,
                                result: newContent,
                            });
                            setBody(newContent);
                        }}
                    />
                </div>
            );
        }
        const { container } = render(<Harness />);
        const getInputs = () =>
            container.querySelectorAll('input[type="checkbox"]');

        // Click the FIRST checkbox
        fireEvent.click(getInputs()[0]!);
        expect(events[0]?.result).toBe("- [x] one\n- [ ] two\n- [ ] three");

        // After re-render, click the THIRD checkbox
        fireEvent.click(getInputs()[2]!);
        expect(events[1]?.result).toBe("- [x] one\n- [ ] two\n- [x] three");

        // Click the SECOND checkbox
        fireEvent.click(getInputs()[1]!);
        expect(events[2]?.result).toBe("- [x] one\n- [x] two\n- [x] three");
    });
});
