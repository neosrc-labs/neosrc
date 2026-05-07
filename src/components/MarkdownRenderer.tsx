"use client";

import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
	content: string;
}

const schema = {
	...defaultSchema,
	tagNames: [...(defaultSchema.tagNames ?? []), "details", "summary"],
};

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
	if (!content) {
		return <p className="text-gray-500 italic">No description provided.</p>;
	}

	const stripped = content.replace(/<!--[\s\S]*?-->/g, "");
	// TODO: Could this be done easier with remark-collapse? I am a bit worried about XXS
	return (
		<ReactMarkdown
			remarkPlugins={[remarkGfm]}
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
