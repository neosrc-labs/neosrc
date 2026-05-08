"use client";

import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
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
				remarkGfm,
				remarkIssuePlugin(owner, repo),
				remarkMentionPlugin,
			]}
			rehypePlugins={[rehypeRaw, [rehypeSanitize, schema]]}
			components={{
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
