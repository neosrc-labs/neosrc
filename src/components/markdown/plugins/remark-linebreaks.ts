import type { Parent, Root, RootContent } from "mdast";

/**
 * Turn single newlines into hard breaks (`<br>`), except inside list items
 * where continuation lines flow like GitHub's README rendering. Paragraphs
 * like `foo\nbar\nbaz` still render on three lines, while bullet point
 * continuations wrap naturally instead of breaking at the source line.
 */
export function remarkLinebreaksPlugin() {
    return function transformer(tree: Root) {
        breakNewlinesOutsideLists(tree);
    };
}

function breakNewlinesOutsideLists(
    node: RootContent | Root,
    parent: Parent | null = null,
    inListItem = false,
): void {
    if ("children" in node) {
        const childInListItem = inListItem || node.type === "listItem";
        for (const child of [...node.children]) {
            breakNewlinesOutsideLists(child, node, childInListItem);
        }
    }

    if (node.type === "text" && parent && !inListItem) {
        const lines = node.value.split(/\r?\n|\r/);
        if (lines.length <= 1) return;
        const childIndex = parent.children.indexOf(node);
        if (childIndex === -1) return;
        const parts: RootContent[] = [];
        for (let i = 0; i < lines.length; i++) {
            if (i > 0) parts.push({ type: "break" });
            const line = lines[i];
            if (line) parts.push({ type: "text", value: line });
        }
        parent.children.splice(childIndex, 1, ...parts);
    }
}
