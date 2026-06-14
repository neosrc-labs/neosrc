export function findLineStart(text: string, position: number): number {
    return text.lastIndexOf("\n", position - 1) + 1;
}

export function getListPrefixLength(lineText: string): number {
    if (lineText.startsWith("- [ ] ") || lineText.startsWith("- [x] "))
        return 6;
    if (lineText.startsWith("- ")) return 2;
    const orderedMatch = lineText.match(/^\d+\.\s/);
    if (orderedMatch) return orderedMatch[0].length;
    return 0;
}

export function findEnclosingCodeBlock(
    text: string,
    pos: number,
): {
    openStart: number;
    openEnd: number;
    closeStart: number;
    closeEnd: number;
} | null {
    const lines = text.split("\n");
    const cursorLine = text.slice(0, pos).split("\n").length - 1;
    let openLine = -1;

    for (let i = 0; i < lines.length; i++) {
        // biome-ignore lint/style/noNonNullAssertion: guarded by bounds check
        if (lines[i]!.trimStart().startsWith("```")) {
            if (openLine === -1) {
                openLine = i;
            } else if (cursorLine > openLine && cursorLine < i) {
                let openStart = 0;
                for (let j = 0; j < openLine; j++)
                    // biome-ignore lint/style/noNonNullAssertion: guarded by bounds check
                    openStart += lines[j]!.length + 1;
                const openEndIdx = text.indexOf("\n", openStart);
                const openEnd =
                    openEndIdx === -1 ? text.length : openEndIdx + 1;

                let closeStart = 0;
                // biome-ignore lint/style/noNonNullAssertion: guarded by bounds check
                for (let j = 0; j < i; j++) closeStart += lines[j]!.length + 1;
                const closeEndIdx = text.indexOf("\n", closeStart);
                const closeEnd =
                    closeEndIdx === -1 ? text.length : closeEndIdx + 1;

                return { openStart, openEnd, closeStart, closeEnd };
            } else {
                openLine = -1;
            }
        }
    }
    return null;
}

export function applyInlineFormat(
    text: string,
    start: number,
    end: number,
    delimiter: string,
    placeholder: string,
): { newText: string; newStart: number; newEnd: number } {
    if (start === end) {
        let wordStart = start;
        while (wordStart > 0 && /\S/.test(text.charAt(wordStart - 1))) {
            wordStart--;
        }
        let wordEnd = start;
        while (wordEnd < text.length && /\S/.test(text.charAt(wordEnd))) {
            wordEnd++;
        }
        if (wordStart < wordEnd) {
            const word = text.slice(wordStart, wordEnd);
            return {
                newText: `${text.slice(0, wordStart)}${delimiter}${word}${delimiter}${text.slice(wordEnd)}`,
                newStart: wordStart + delimiter.length,
                newEnd: wordStart + delimiter.length + word.length,
            };
        }
    }
    const selected = text.slice(start, end);
    if (selected) {
        return {
            newText: `${text.slice(0, start)}${delimiter}${selected}${delimiter}${text.slice(end)}`,
            newStart: start,
            newEnd: end + delimiter.length * 2,
        };
    }
    return {
        newText: `${text.slice(0, start)}${delimiter}${placeholder}${delimiter}${text.slice(end)}`,
        newStart: start + delimiter.length,
        newEnd: start + delimiter.length + placeholder.length,
    };
}

export function applyCodeBlockFormat(
    text: string,
    start: number,
    end: number,
): { newText: string; newStart: number; newEnd: number } {
    const block = findEnclosingCodeBlock(text, start);
    if (block) {
        const before = text.slice(0, block.openStart);
        const content = text.slice(block.openEnd, block.closeStart);
        const after = text.slice(block.closeEnd);
        const removedBefore = block.openEnd - block.openStart;
        const removedTotal =
            removedBefore + (block.closeEnd - block.closeStart);
        return {
            newText: before + content + after,
            newStart: Math.max(start - removedBefore, block.openStart),
            newEnd: Math.max(end - removedTotal, block.openStart),
        };
    }
    const selected = text.slice(start, end);
    if (selected) {
        return {
            newText: `${text.slice(0, start)}\`\`\`\n${selected}\n\`\`\`${text.slice(end)}`,
            newStart: start,
            newEnd: end + 8,
        };
    }
    return {
        newText: `${text.slice(0, start)}\`\`\`\n\n\`\`\`${text.slice(end)}`,
        newStart: start + 4,
        newEnd: start + 4,
    };
}

export function generateTable(
    columns: number,
    rows: number,
): { text: string; cursorPos: number } {
    const headers = Array.from(
        { length: columns },
        (_, i) => `Column ${i + 1}`,
    );
    const separator = Array.from({ length: columns }, () => "---");
    const body = Array.from({ length: rows }, () =>
        Array.from({ length: columns }, (_, j) => (j === 0 ? "" : "Cell")),
    );

    const headerLine = `| ${headers.join(" | ")} |`;
    const separatorLine = `| ${separator.join(" | ")} |`;
    const bodyLines = body.map((row) => `| ${row.join(" | ")} |`);

    const text = [headerLine, separatorLine, ...bodyLines].join("\n");
    // Cursor ends up in the first data cell (first row, first column after header)
    const cursorPos = headerLine.length + separatorLine.length + 3;
    return { text, cursorPos };
}

export function generateAlert(type: string): {
    text: string;
    cursorPos: number;
} {
    const text = `> [!${type}]\n> `;
    return { text, cursorPos: text.length };
}

export function generateDetails(): { text: string; cursorPos: number } {
    const text = `<details>\n<summary>Click to expand</summary>\n\n\n</details>`;
    return { text, cursorPos: text.length - 10 };
}

export function generateCodeBlock(language?: string): {
    text: string;
    cursorPos: number;
} {
    const lang = language ?? "";
    if (lang) {
        const text = `\`\`\`${lang}\n\n\`\`\``;
        return { text, cursorPos: text.length - 3 };
    }
    const text = "```\n\n```";
    return { text, cursorPos: text.length - 3 };
}

export function generateTaskList(items?: number): {
    text: string;
    cursorPos: number;
} {
    const count = items ?? 3;
    const text = Array.from({ length: count }, (_, i) =>
        i === 0 ? "- [ ] " : `\n- [ ] `,
    ).join("");
    return { text, cursorPos: 6 };
}

export interface LinePrefix {
    prefix: string;
    type: "unordered" | "ordered" | "task" | "blockquote" | "none";
    number?: number;
    checked?: boolean;
}

export function getLinePrefix(lineText: string): LinePrefix {
    if (lineText.startsWith("- [x] "))
        return { prefix: "- [x] ", type: "task", checked: true };
    if (lineText.startsWith("- [ ] "))
        return { prefix: "- [ ] ", type: "task", checked: false };
    if (lineText.startsWith("- ")) return { prefix: "- ", type: "unordered" };
    if (lineText.startsWith("* ")) return { prefix: "* ", type: "unordered" };
    if (lineText.startsWith("+ ")) return { prefix: "+ ", type: "unordered" };
    if (lineText.startsWith("> ")) return { prefix: "> ", type: "blockquote" };
    const orderedMatch = lineText.match(/^(\d+)\.\s/);
    if (orderedMatch)
        return {
            prefix: orderedMatch[0],
            type: "ordered",
            number: Number.parseInt(orderedMatch[1] ?? "1", 10),
        };
    return { prefix: "", type: "none" };
}

export function getNextOrderedNumber(text: string, lineStart: number): number {
    const beforeText = text.slice(0, lineStart);
    const lines = beforeText.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
        const match = lines[i]?.match(/^(\d+)\.\s/);
        if (match) {
            return Number.parseInt(match[1] ?? "1", 10) + 1;
        }
        const line = lines[i];
        if (line !== undefined && line.trim() !== "") break;
    }
    return 1;
}

export function handleEnterKey(
    text: string,
    cursorPos: number,
): { newText: string; newCursorPos: number } | null {
    const lineStart = findLineStart(text, cursorPos);
    const lineEnd = text.indexOf("\n", cursorPos);
    const lineEndPos = lineEnd === -1 ? text.length : lineEnd;
    const lineText = text.slice(lineStart, lineEndPos);

    const prefixInfo = getLinePrefix(lineText);
    if (prefixInfo.type === "none") return null;

    const contentAfterPrefix = lineText.slice(prefixInfo.prefix.length);

    if (contentAfterPrefix.trim() === "") {
        const afterNewline = lineEnd === -1 ? text.length : lineEnd + 1;
        return {
            newText: text.slice(0, lineStart) + text.slice(afterNewline),
            newCursorPos: lineStart,
        };
    }

    const offsetInLine = Math.max(
        cursorPos - lineStart,
        prefixInfo.prefix.length,
    );
    const leftPart = lineText.slice(0, offsetInLine);
    const rightPart = lineText.slice(offsetInLine);

    let newPrefix: string;
    if (prefixInfo.type === "ordered") {
        newPrefix = `${(prefixInfo.number ?? 0) + 1}. `;
    } else if (prefixInfo.type === "task") {
        newPrefix = "- [ ] ";
    } else {
        newPrefix = prefixInfo.prefix;
    }

    return {
        newText:
            text.slice(0, lineStart) +
            leftPart +
            "\n" +
            newPrefix +
            rightPart +
            text.slice(lineEndPos),
        newCursorPos: lineStart + leftPart.length + 1 + newPrefix.length,
    };
}

export function applyListFormat(
    text: string,
    start: number,
    end: number,
    prefix: string,
): { newText: string; newStart: number; newEnd: number } {
    const lineStart = findLineStart(text, start);
    const lineEnd = text.indexOf("\n", lineStart);
    const lineText =
        lineEnd === -1 ? text.slice(lineStart) : text.slice(lineStart, lineEnd);
    const prefixLen = getListPrefixLength(lineText);

    if (prefixLen === prefix.length && lineText.startsWith(prefix)) {
        return {
            newText:
                text.slice(0, lineStart) + text.slice(lineStart + prefixLen),
            newStart: Math.max(start - prefixLen, lineStart),
            newEnd: Math.max(end - prefixLen, lineStart),
        };
    }

    const stripped =
        prefixLen > 0
            ? {
                  text:
                      text.slice(0, lineStart) +
                      text.slice(lineStart + prefixLen),
                  start: Math.max(start - prefixLen, lineStart),
                  end: Math.max(end - prefixLen, lineStart),
              }
            : { text, start, end };
    return {
        newText:
            stripped.text.slice(0, lineStart) +
            prefix +
            stripped.text.slice(lineStart),
        newStart: stripped.start + prefix.length,
        newEnd: stripped.end + prefix.length,
    };
}
