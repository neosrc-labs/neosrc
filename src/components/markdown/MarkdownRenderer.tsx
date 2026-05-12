"use client";

import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { IssueHoverCard } from "~/components/issue-hover-card";
import { remarkEmojiPlugin } from "./plugins/remark-emoji";
import { remarkIssuePlugin } from "./plugins/remark-issue";
import { remarkMentionPlugin } from "./plugins/remark-mention";

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
					const match =
						href?.match(
							/^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)$/,
						);
					if (match?.[1] && match[2] && match[3]) {
						return (
							<IssueHoverCard
								owner={match[1]}
								repo={match[2]}
								issueNumber={Number.parseInt(match[3])}
							>
								<a href={href} {...props}>
									{children}
								</a>
							</IssueHoverCard>
						);
					}
					return (
						<a href={href} {...props}>
							{children}
						</a>
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
