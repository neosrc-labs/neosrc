import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
    buildFileTree,
    compressTree,
    type FileNode,
    highlightMatch,
    pruneTree,
} from "./file-tree";

function file(filename: string, status = "modified") {
    return {
        filename,
        status,
        additions: 1,
        deletions: 0,
    } as Parameters<typeof buildFileTree>[0][number];
}

function dir({
    name,
    path,
    children,
}: {
    name: string;
    path: string;
    children?: FileNode[];
}): FileNode {
    return { name, path, children: children ?? [], isFile: false };
}

function leaf(name: string, path: string): FileNode {
    return { name, path, isFile: true };
}

describe("compressTree", () => {
    it("compresses a single chain into one node", () => {
        const tree = [
            dir({
                name: "a",
                path: "a",
                children: [
                    dir({
                        name: "b",
                        path: "a/b",
                        children: [
                            dir({
                                name: "c",
                                path: "a/b/c",
                                children: [leaf("file.txt", "a/b/c/file.txt")],
                            }),
                        ],
                    }),
                ],
            }),
        ];
        const result = compressTree(tree);
        expect(result).toHaveLength(1);
        expect(result[0]!.name).toBe("a/b/c");
        expect(result[0]!.path).toBe("a/b/c");
        expect(result[0]!.children).toHaveLength(1);
        expect(result[0]!.children![0]!.name).toBe("file.txt");
        expect(result[0]!.children![0]!.isFile).toBe(true);
    });

    it("does not compress when a directory has multiple children", () => {
        const tree = [
            dir({
                name: "a",
                path: "a",
                children: [
                    dir({
                        name: "b",
                        path: "a/b",
                        children: [leaf("f1.txt", "a/b/f1.txt")],
                    }),
                    dir({
                        name: "c",
                        path: "a/c",
                        children: [leaf("f2.txt", "a/c/f2.txt")],
                    }),
                ],
            }),
        ];
        const result = compressTree(tree);
        expect(result).toHaveLength(1);
        expect(result[0]!.name).toBe("a");
        expect(result[0]!.children).toHaveLength(2);
    });

    it("does not compress a single child that is a file", () => {
        const tree = [
            dir({
                name: "a",
                path: "a",
                children: [leaf("f.txt", "a/f.txt")],
            }),
        ];
        const result = compressTree(tree);
        expect(result).toHaveLength(1);
        expect(result[0]!.name).toBe("a");
        expect(result[0]!.children).toHaveLength(1);
        expect(result[0]!.children![0]!.isFile).toBe(true);
    });

    it("compresses mixed: chain + sibling directory at different levels", () => {
        const tree = [
            dir({
                name: "a",
                path: "a",
                children: [
                    dir({
                        name: "b",
                        path: "a/b",
                        children: [
                            dir({
                                name: "c",
                                path: "a/b/c",
                                children: [leaf("f.txt", "a/b/c/f.txt")],
                            }),
                        ],
                    }),
                    dir({
                        name: "d",
                        path: "a/d",
                        children: [leaf("g.txt", "a/d/g.txt")],
                    }),
                ],
            }),
        ];
        const result = compressTree(tree);
        expect(result).toHaveLength(1);
        // a has 2 children (b, d) so a is not compressed
        expect(result[0]!.name).toBe("a");
        const aChildren = result[0]!.children!;
        expect(aChildren).toHaveLength(2);
        // b/c chain compresses into one node
        expect(aChildren[0]!.name).toBe("b/c");
        expect(aChildren[0]!.children).toHaveLength(1);
        expect(aChildren[0]!.children![0]!.name).toBe("f.txt");
        // d has a single file child, not compressed
        expect(aChildren[1]!.name).toBe("d");
        expect(aChildren[1]!.children).toHaveLength(1);
        expect(aChildren[1]!.children![0]!.name).toBe("g.txt");
    });

    it("handles empty children", () => {
        const tree = [dir({ name: "empty", path: "empty", children: [] })];
        const result = compressTree(tree);
        expect(result).toHaveLength(1);
        expect(result[0]!.name).toBe("empty");
        expect(result[0]!.children).toHaveLength(0);
    });

    it("is idempotent", () => {
        const tree = [
            dir({
                name: "a",
                path: "a",
                children: [
                    dir({
                        name: "b",
                        path: "a/b",
                        children: [leaf("f.txt", "a/b/f.txt")],
                    }),
                ],
            }),
        ];
        const once = compressTree(tree);
        const twice = compressTree(once);
        expect(twice).toEqual(once);
    });

    it("handles very deep chains", () => {
        const depth = 20;
        let tree: FileNode[] = [
            leaf("file.txt", `${"x/".repeat(depth)}file.txt`),
        ];
        for (let i = depth - 1; i >= 0; i--) {
            const part = String.fromCharCode(97 + (i % 26));
            tree = [
                dir({
                    name: part,
                    path: `${"x/".repeat(i)}${part}`.replace(/\/$/, ""),
                    children: tree,
                }),
            ];
        }
        const result = compressTree(tree);
        expect(result).toHaveLength(1);
        const parts = result[0]!.name.split("/");
        expect(parts.length).toBe(depth);
    });

    it("preserves a flat list of files", () => {
        const tree = [leaf("a.ts", "a.ts"), leaf("b.ts", "b.ts")];
        const result = compressTree(tree);
        expect(result).toHaveLength(2);
        expect(result[0]!.isFile).toBe(true);
        expect(result[1]!.isFile).toBe(true);
    });
});

describe("buildFileTree", () => {
    it("builds a compressed tree from flat file list", () => {
        const files = [file("a/b/c/f1.txt"), file("a/b/c/f2.txt")];
        const tree = buildFileTree(files);
        expect(tree).toHaveLength(1);
        expect(tree[0]!.name).toBe("a/b/c");
        expect(tree[0]!.children).toHaveLength(2);
    });

    it("does not compress divergent paths", () => {
        const files = [
            file("src/utils/format.ts"),
            file("src/components/Button.tsx"),
        ];
        const tree = buildFileTree(files);
        expect(tree).toHaveLength(1);
        expect(tree[0]!.name).toBe("src");
        expect(tree[0]!.children).toHaveLength(2);
    });

    it("handles a single file at root", () => {
        const files = [file("index.ts")];
        const tree = buildFileTree(files);
        expect(tree).toHaveLength(1);
        expect(tree[0]!.isFile).toBe(true);
        expect(tree[0]!.name).toBe("index.ts");
    });
});

describe("pruneTree", () => {
    it("keeps nodes matching at the root level", () => {
        const tree = [leaf("index.ts", "index.ts"), leaf("main.ts", "main.ts")];
        const result = pruneTree(tree, "index");
        expect(result).toHaveLength(1);
        expect(result[0]!.name).toBe("index.ts");
    });

    it("keeps ancestors of matching files", () => {
        const tree = [
            dir({
                name: "src",
                path: "src",
                children: [
                    dir({
                        name: "utils",
                        path: "src/utils",
                        children: [leaf("format.ts", "src/utils/format.ts")],
                    }),
                    leaf("index.ts", "src/index.ts"),
                ],
            }),
        ];
        const result = pruneTree(tree, "format");
        expect(result).toHaveLength(1);
        expect(result[0]!.name).toBe("src");
        expect(result[0]!.children).toHaveLength(1);
        expect(result[0]!.children![0]!.name).toBe("utils");
        expect(result[0]!.children![0]!.children).toHaveLength(1);
        expect(result[0]!.children![0]!.children![0]!.name).toBe("format.ts");
    });

    it("returns empty array when nothing matches", () => {
        const tree = [leaf("a.ts", "a.ts"), leaf("b.ts", "b.ts")];
        const result = pruneTree(tree, "nonexistent");
        expect(result).toHaveLength(0);
    });

    it("is case insensitive", () => {
        const tree = [leaf("UpperCase.ts", "UpperCase.ts")];
        const result = pruneTree(tree, "uppercase");
        expect(result).toHaveLength(1);
        expect(result[0]!.name).toBe("UpperCase.ts");
    });

    it("matches on directory names", () => {
        const tree = [
            dir({
                name: "components",
                path: "components",
                children: [leaf("Button.tsx", "components/Button.tsx")],
            }),
        ];
        const result = pruneTree(tree, "components");
        expect(result).toHaveLength(1);
        expect(result[0]!.name).toBe("components");
        expect(result[0]!.children).toHaveLength(1);
    });

    it("returns original tree when search is empty", () => {
        const tree = [leaf("a.ts", "a.ts"), leaf("b.ts", "b.ts")];
        const result = pruneTree(tree, "");
        expect(result).toHaveLength(2);
    });
});

describe("highlightMatch", () => {
    function marks(text: string, query: string) {
        const { container } = render(
            <span>{highlightMatch(text, query)}</span>,
        );
        return Array.from(container.querySelectorAll("mark")).map(
            (m) => m.textContent,
        );
    }

    function plain(text: string, query: string) {
        const { container } = render(
            <span>{highlightMatch(text, query)}</span>,
        );
        return container.textContent;
    }

    it("highlights matching substring with full query", () => {
        expect(marks("file.txt", "file")).toEqual(["file"]);
    });

    it("returns plain text unchanged when nothing matches", () => {
        expect(marks("file.txt", "xyz")).toEqual([]);
    });

    it("is case insensitive", () => {
        expect(marks("UpperCase.ts", "uppercase")).toEqual(["UpperCase"]);
    });

    it("matches full path when query matches the entire name", () => {
        expect(marks("cargo/core", "cargo/core")).toEqual(["cargo/core"]);
    });

    it("merges adjacent path segment matches across / separator", () => {
        const result = marks("cargo/core", "cargo/core/features.rs");
        expect(result).toEqual(["cargo/core"]);
    });

    it("highlights last path segment in a filename", () => {
        const result = marks("feature.rs", "cargo/core/feature.rs");
        expect(result).toEqual(["feature.rs"]);
    });

    it("highlights middle path segment in a directory name", () => {
        const result = marks("core", "cargo/core/feature.rs");
        expect(result).toEqual(["core"]);
    });

    it("does not segment-fallback when query has no slash", () => {
        expect(marks("file.txt", "notfound")).toEqual([]);
    });

    it("preserves non-matching text around highlights", () => {
        expect(plain("my-file.txt", "file")).toBe("my-file.txt");
    });

    it("returns text unchanged for empty query", () => {
        expect(marks("anything", "")).toEqual([]);
        expect(plain("anything", "")).toBe("anything");
    });
});
