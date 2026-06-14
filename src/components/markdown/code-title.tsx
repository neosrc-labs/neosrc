import type { ReactNode } from "react";

const backtickRegex = /(`+)/g;

export function CodeTitle({ children }: { children: string }) {
    const parts = children.split(backtickRegex);
    const elements: ReactNode[] = [];
    let i = 0;
    while (i < parts.length) {
        const part = parts[i];
        if (!part) {
            i++;
            continue;
        }
        if (part.startsWith("`")) {
            const content = parts[i + 1];
            const closing = parts[i + 2];
            if (closing === part) {
                elements.push(
                    <code
                        key={elements.length}
                        className="rounded bg-gray-100 px-1.25 py-0.5 font-mono before:content-none after:content-none dark:bg-zinc-700"
                    >
                        {content}
                    </code>,
                );
                i += 3;
                continue;
            }
        }
        elements.push(part);
        i++;
    }
    return <>{elements}</>;
}
