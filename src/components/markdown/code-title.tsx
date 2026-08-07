"use client";

import type { ReactNode } from "react";

const tokenRegex = /(`+)(.+?)\1|#(\d+)/g;

interface CodeTitleProps {
    children: string;
    provider?: string;
    owner?: string;
    repo?: string;
}

function suppressParentHover(el: HTMLElement) {
    const parent = el.closest("a");
    if (parent) {
        parent.style.color = "var(--color-text-primary)";
    }
}

function restoreParentHover(el: HTMLElement) {
    const parent = el.closest("a");
    if (parent) {
        parent.style.removeProperty("color");
    }
}

export function CodeTitle({ children, provider, owner, repo }: CodeTitleProps) {
    const showIssueLinks =
        provider !== undefined && owner !== undefined && repo !== undefined;

    const elements: ReactNode[] = [];
    let lastIndex = 0;

    for (const match of children.matchAll(tokenRegex)) {
        if (match.index > lastIndex) {
            elements.push(children.slice(lastIndex, match.index));
        }

        if (match[1] !== undefined) {
            elements.push(
                <code
                    key={elements.length}
                    className="rounded bg-gray-100 px-1.25 py-0.5 font-mono before:content-none after:content-none dark:bg-zinc-700"
                >
                    {match[2]}
                </code>,
            );
        } else if (match[3] !== undefined) {
            if (showIssueLinks) {
                const host = provider === "cb" ? "codeberg.org" : "github.com";
                elements.push(
                    <span
                        key={elements.length}
                        className="cursor-pointer text-blue-600 hover:underline dark:text-blue-400"
                        onClick={(e) => {
                            // Keep the click from bubbling to a wrapping
                            // commit/pr link: only the issue should open.
                            // preventDefault stops the anchor's native
                            // navigation; stopPropagation keeps the Link's
                            // onClick (router push) from running.
                            e.preventDefault();
                            e.stopPropagation();
                            window.open(
                                `https://${host}/${owner}/${repo}/issues/${match[3]}`,
                                "_blank",
                                "noopener,noreferrer",
                            );
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                e.stopPropagation();
                                window.open(
                                    `https://${host}/${owner}/${repo}/issues/${match[3]}`,
                                    "_blank",
                                    "noopener,noreferrer",
                                );
                            }
                        }}
                        onMouseEnter={(e) =>
                            suppressParentHover(e.currentTarget)
                        }
                        onMouseLeave={(e) =>
                            restoreParentHover(e.currentTarget)
                        }
                    >
                        #{match[3]}
                    </span>,
                );
            } else {
                elements.push(match[0]);
            }
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < children.length) {
        elements.push(children.slice(lastIndex));
    }

    if (elements.length === 0) {
        return <>{children}</>;
    }

    return <>{elements}</>;
}
