"use client";

import { useTheme } from "next-themes";
import {
    type CSSProperties,
    createContext,
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
}: MarkdownRendererProps) {
    if (!content) {
        return (
            <p className="text-gray-500 italic dark:text-gray-400">
                No description provided.
            </p>
        );
    }

    const stripped = content.replace(/<!--[\s\S]*?-->/g, "");
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
                summary({ children, ...props }) {
                    return (
                        <summary className="cursor-pointer" {...props}>
                            {children}
                        </summary>
                    );
                },
            }}
        >
            {stripped}
        </ReactMarkdown>
    );
}
