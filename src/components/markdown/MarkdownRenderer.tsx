"use client";

import { createContext, useContext } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { IssueHoverCard } from "~/components/issue-hover-card";
import { TeamHoverCard } from "~/components/team-hover-card";
import { UserHoverCard } from "~/components/user-hover-card";
import { remarkEmojiPlugin } from "./plugins/remark-emoji";
import { remarkIssuePlugin } from "./plugins/remark-issue";
import { remarkMentionPlugin } from "./plugins/remark-mention";

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
			className="rounded bg-gray-100 px-[5px] py-[2px] font-mono text-sm before:content-none after:content-none dark:bg-zinc-700"
			{...props}
		>
			{children}
		</code>
	);
}

function CodeBlockCode({
	children,
	...props
}: {
	children: React.ReactNode;
	[key: string]: unknown;
}) {
	return <code {...props}>{children}</code>;
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
	const inCodeBlock = useContext(CodeBlockContext);
	if (className || inCodeBlock) {
		return (
			<CodeBlockCode className={className} {...props}>
				{children}
			</CodeBlockCode>
		);
	}
	return <InlineCode {...props}>{children}</InlineCode>;
}

interface MarkdownRendererProps {
	content: string;
	owner?: string;
	repo?: string;
}

const schema = {
	...defaultSchema,
	tagNames: [...(defaultSchema.tagNames ?? []), "details", "summary"],
};

export function MarkdownRenderer({
	content,
	owner,
	repo,
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
				remarkMentionPlugin,
				remarkEmojiPlugin,
			]}
			rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
			components={{
				a({ href, children, ...props }) {
					const issueMatch = href?.match(
						/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)$/,
					);
					if (issueMatch?.[1] && issueMatch[2] && issueMatch[3]) {
						return (
							<IssueHoverCard
								owner={issueMatch[1]}
								repo={issueMatch[2]}
								issueNumber={Number.parseInt(issueMatch[3], 10)}
							>
								<a href={href} {...props}>
									{children}
								</a>
							</IssueHoverCard>
						);
					}
					const teamMatch = href?.match(
						/^https:\/\/github\.com\/orgs\/([\w.-]+)\/teams\/([\w.-]+)$/,
					);
					if (teamMatch?.[1] && teamMatch[2]) {
						return (
							<TeamHoverCard org={teamMatch[1]} teamSlug={teamMatch[2]}>
								<a href={href} {...props}>
									{children}
								</a>
							</TeamHoverCard>
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
				pre({ children, ...props }) {
					return (
						<pre
							className="overflow-x-auto rounded-md bg-gray-100 p-4 dark:bg-zinc-800"
							{...props}
						>
							<CodeBlockContext.Provider value={true}>
								{children}
							</CodeBlockContext.Provider>
						</pre>
					);
				},
				code({ children, className, ...props }) {
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
