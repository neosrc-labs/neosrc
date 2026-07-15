"use client";

import { useTheme } from "next-themes";
import {
    Children,
    type CSSProperties,
    createContext,
    isValidElement,
    type ReactElement,
    type ReactNode,
    useContext,
    useEffect,
    useState,
} from "react";
import ReactMarkdown from "react-markdown";
import SyntaxHighlighter from "react-syntax-highlighter";
import darkTheme from "react-syntax-highlighter/dist/esm/styles/hljs/atom-one-dark";
import lightTheme from "react-syntax-highlighter/dist/esm/styles/hljs/docco";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { remarkAlert } from "remark-github-blockquote-alert";
import { MarkdownCommitHoverCard } from "~/components/hovercards/commit-hover-card";
import { IssueHoverCard } from "~/components/hovercards/issue-hover-card";
import { TeamHoverCard } from "~/components/hovercards/team-hover-card";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { remarkCommitPlugin } from "./plugins/remark-commit";
import { remarkEmojiPlugin } from "./plugins/remark-emoji";
import { remarkIssuePlugin } from "./plugins/remark-issue";
import { remarkMentionPlugin } from "./plugins/remark-mention";
import { SuggestionBlock } from "./SuggestionBlock";

const CodeBlockContext = createContext(false);

function InlineCode({
    children,
    ...props
}: {
    children: React.ReactNode;
    [key: string]: unknown;
}) {
    return (
        <code
            className="rounded bg-gray-100 px-1.25 py-0.5 font-mono text-sm before:content-none after:content-none dark:bg-zinc-700"
            {...props}
        >
            {children}
        </code>
    );
}

function CodeElement({
    children,
    className,
    ...props
}: {
    children: React.ReactNode;
    className?: string;
    [key: string]: unknown;
}) {
    const { resolvedTheme } = useTheme();
    const inCodeBlock = useContext(CodeBlockContext);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (className || inCodeBlock) {
        if (!mounted) {
            return (
                <pre className="overflow-x-auto rounded-lg bg-zinc-100 p-2 text-sm dark:bg-zinc-800">
                    <code className={className}>{children}</code>
                </pre>
            );
        }

        const style = resolvedTheme === "dark" ? darkTheme : lightTheme;
        const extraStyles: CSSProperties =
            resolvedTheme === "dark" ? {} : { background: "#f0f0f0" };

        let language = "";
        switch (className) {
            case "language-rust": {
                language = "rust";
                break;
            }
            case "language-js": {
                language = "javascript";
                break;
            }
            // TODO: Add other languages
        }

        const codeString = Array.isArray(children)
            ? children.join("")
            : String(children ?? "");

        return (
            <SyntaxHighlighter
                language={language}
                style={style}
                customStyle={extraStyles}
                {...props}
            >
                {codeString}
            </SyntaxHighlighter>
        );
    }
    return <InlineCode {...props}>{children}</InlineCode>;
}

interface MarkdownRendererProps {
    content: string;
    owner?: string;
    repo?: string;
    pullNumber?: number;
    commentPath?: string;
    commentLine?: number | null;
    commentStartLine?: number | null;
    commentThreadId?: string;
    onToggleTask?: (content: string) => void;
    /**
     * Whether task-list checkboxes should be interactive. When `false`
     * (or when `onToggleTask` is absent) they render as disabled inputs.
     * Defaults to `true` so existing callers (e.g. {@link MarkdownEditor}
     * preview) keep interactive checkboxes.
     */
    canToggleTasks?: boolean;
}

const schema = {
    ...defaultSchema,
    tagNames: [
        ...(defaultSchema.tagNames ?? []),
        "details",
        "summary",
        "svg",
        "path",
    ],
    attributes: {
        ...defaultSchema.attributes,
        div: [...(defaultSchema.attributes?.div ?? []), "className"],
        p: [...(defaultSchema.attributes?.p ?? []), "className"],
        svg: ["className", "viewBox", "width", "height", "ariaHidden"],
        path: ["d"],
    },
};

type HastNode = {
    type?: string;
    tagName?: string;
    position?: {
        start?: { line?: number };
    } | null;
};

/**
 * Toggle the `[ ]`/`[x]` marker on the 1-based `lineNumber` of the source
 * content. The line is identified by the hast `<li>` element's
 * `position.start.line` (preserved by remark-rehype from the original mdast
 * listItem position), which react-markdown passes to the `li` component
 * override via the `node` prop. Because each `<li>` directly knows its own
 * source line, no global index/positional-ref matching is needed — every
 * checkbox toggles itself regardless of document structure (blockquotes,
 * ordered lists, nested lists, headings before the list, etc).
 */
function toggleCheckboxAtLine(content: string, lineNumber: number): string {
    if (lineNumber < 1) return content;
    const lines = content.split("\n");
    const line = lines[lineNumber - 1];
    if (line === undefined) return content;
    const toggled = line.replace(
        /^(\s*(?:>\s*)*(?:[-*+]|\d+\.)\s+)\[([ xX])\]/,
        (_match, prefix: string, state: string) =>
            `${prefix}[${state === " " ? "x" : " "}]`,
    );
    lines[lineNumber - 1] = toggled;
    return lines.join("\n");
}

function getPlainText(children: ReactNode): string {
    if (typeof children === "string") return children;
    if (typeof children === "number") return String(children);
    if (Array.isArray(children)) return children.map(getPlainText).join("");
    return "";
}

export function MarkdownRenderer({
    content,
    owner = "",
    repo = "",
    pullNumber,
    commentPath,
    commentLine,
    commentStartLine,
    commentThreadId,
    onToggleTask,
    canToggleTasks = true,
}: MarkdownRendererProps) {
    if (!content) {
        return (
            <p className="text-text-tertiary italic">
                No description provided.
            </p>
        );
    }

    const stripped = content.replace(/<!--[\s\S]*?-->/g, "");
    const interactive = canToggleTasks && Boolean(onToggleTask);
    return (
        <ReactMarkdown
            remarkPlugins={[
                remarkBreaks,
                remarkGfm,
                remarkIssuePlugin(owner, repo),
                remarkCommitPlugin(owner, repo),
                remarkMentionPlugin,
                remarkEmojiPlugin,
                remarkAlert,
            ]}
            rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
            components={{
                a({ href, children, ...props }) {
                    const issueMatch = href?.match(
                        /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/(?:issues|pull)\/(\d+)$/,
                    );
                    if (issueMatch?.[1] && issueMatch[2] && issueMatch[3]) {
                        const matchedOwner = issueMatch[1];
                        const matchedRepo = issueMatch[2];
                        const issueNumber = Number.parseInt(issueMatch[3], 10);
                        const isSameRepo =
                            matchedOwner === owner && matchedRepo === repo;
                        const shortRef = isSameRepo
                            ? `#${issueNumber}`
                            : `${matchedOwner}/${matchedRepo}#${issueNumber}`;
                        const childrenText = getPlainText(children);
                        const displayChildren =
                            childrenText === href ? shortRef : children;
                        return (
                            <IssueHoverCard
                                owner={matchedOwner}
                                repo={matchedRepo}
                                issueNumber={issueNumber}
                            >
                                <a href={href} {...props}>
                                    {displayChildren}
                                </a>
                            </IssueHoverCard>
                        );
                    }
                    const teamMatch = href?.match(
                        /^https:\/\/github\.com\/orgs\/([\w.-]+)\/teams\/([\w.-]+)$/,
                    );
                    if (teamMatch?.[1] && teamMatch[2]) {
                        return (
                            <TeamHoverCard
                                org={teamMatch[1]}
                                teamSlug={teamMatch[2]}
                            >
                                <a href={href} {...props}>
                                    {children}
                                </a>
                            </TeamHoverCard>
                        );
                    }
                    const commitMatch = href?.match(
                        /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/commit\/([a-f0-9]{7,40})$/i,
                    );
                    if (commitMatch?.[1] && commitMatch[2] && commitMatch[3]) {
                        return (
                            <MarkdownCommitHoverCard
                                owner={commitMatch[1]}
                                repo={commitMatch[2]}
                                sha={commitMatch[3].toLowerCase()}
                            >
                                <a href={href} {...props}>
                                    {children}
                                </a>
                            </MarkdownCommitHoverCard>
                        );
                    }
                    const userMatch = href?.match(
                        /^https:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)$/,
                    );
                    if (userMatch?.[1]) {
                        return (
                            <UserHoverCard login={userMatch[1]}>
                                <a href={href} {...props}>
                                    {children}
                                </a>
                            </UserHoverCard>
                        );
                    }
                    return (
                        <a href={href} {...props}>
                            {children}
                        </a>
                    );
                },
                pre({ children }) {
                    return (
                        <CodeBlockContext.Provider value={true}>
                            {children}
                        </CodeBlockContext.Provider>
                    );
                },
                code({ children, className, ...props }) {
                    if (className?.startsWith("language-suggestion")) {
                        const codeString = Array.isArray(children)
                            ? children.join("")
                            : String(children ?? "");
                        return (
                            <SuggestionBlock
                                code={codeString}
                                owner={owner}
                                repo={repo}
                                pullNumber={pullNumber}
                                path={commentPath}
                                line={commentLine}
                                startLine={commentStartLine}
                                resolveThreadId={commentThreadId}
                            />
                        );
                    }
                    return (
                        <CodeElement className={className} {...props}>
                            {children}
                        </CodeElement>
                    );
                },
                img({ ...props }) {
                    return (
                        <img
                            className="m-0 inline-block max-h-10 align-middle"
                            {...props}
                            alt={props.alt ?? ""}
                        />
                    );
                },
                ul({ children, className, style, ...props }) {
                    const items = Children.toArray(children);
                    const isTaskList = items.some((child) => {
                        if (!isValidElement<{ children?: ReactNode }>(child))
                            return false;
                        const liChildren = Children.toArray(
                            child.props.children,
                        );
                        return liChildren.some(
                            (c) =>
                                isValidElement<{ type?: string }>(c) &&
                                c.props.type === "checkbox",
                        );
                    });
                    return (
                        <ul
                            style={
                                isTaskList
                                    ? { ...style, paddingLeft: 0 }
                                    : style
                            }
                            className={className}
                            {...props}
                        >
                            {children}
                        </ul>
                    );
                },
                li({ children, className, node, ...props }) {
                    const childrenArray = Children.toArray(children);
                    const firstChild = childrenArray[0];
                    const isTaskItem =
                        isValidElement<{ type?: string }>(firstChild) &&
                        firstChild.props.type === "checkbox";
                    if (isTaskItem) {
                        // Each task-list <li> knows its own source line via
                        // the hast `node.position.start.line` (preserved from
                        // the mdast listItem by remark-rehype). We replace
                        // the gfm-injected <input> child with our own
                        // controlled checkbox whose onChange bakes in this
                        // line — no global index/ref positional matching, so
                        // toggles are robust to any document structure
                        // (blockquotes, ordered lists, nested lists,
                        // preceding headings, etc).
                        const line = (node as HastNode | undefined)?.position
                            ?.start?.line;
                        const inputEl = firstChild as ReactElement<{
                            checked?: boolean;
                        }>;
                        const originalKey = (firstChild as ReactElement).key;
                        const replacement = (
                            <input
                                key={originalKey ?? "task-checkbox-input"}
                                checked={inputEl.props.checked === true}
                                className="size-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-500 dark:bg-zinc-700 dark:focus:ring-blue-400"
                                disabled={!interactive}
                                onChange={
                                    interactive
                                        ? () => {
                                              if (typeof line !== "number")
                                                  return;
                                              const newContent =
                                                  toggleCheckboxAtLine(
                                                      stripped,
                                                      line,
                                                  );
                                              onToggleTask?.(newContent);
                                          }
                                        : undefined
                                }
                                type="checkbox"
                            />
                        );
                        const newChildren = childrenArray.map((c, i) =>
                            i === 0 ? replacement : c,
                        );
                        return (
                            <li className="list-none" {...props}>
                                {newChildren}
                            </li>
                        );
                    }
                    return <li className={className}>{children}</li>;
                },
                summary({ children, ...props }) {
                    return (
                        <summary className="cursor-pointer" {...props}>
                            {children}
                        </summary>
                    );
                },
                table({ children }) {
                    return (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-gray-300 dark:border-zinc-600">
                                {children}
                            </table>
                        </div>
                    );
                },
                thead({ children }) {
                    return (
                        <thead className="bg-surface-tertiary">
                            {children}
                        </thead>
                    );
                },
                th({ children, style, ...props }) {
                    return (
                        <th
                            className="border border-gray-300 px-3 py-2 font-semibold dark:border-zinc-600"
                            style={style}
                            {...props}
                        >
                            {children}
                        </th>
                    );
                },
                td({ children, style, ...props }) {
                    return (
                        <td
                            className="border border-gray-300 px-3 py-2 dark:border-zinc-600"
                            style={style}
                            {...props}
                        >
                            {children}
                        </td>
                    );
                },
            }}
        >
            {stripped}
        </ReactMarkdown>
    );
}
