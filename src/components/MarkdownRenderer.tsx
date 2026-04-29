"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
	content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
	if (!content) {
		return <p className="text-gray-500 italic">No description provided.</p>;
	}

	const stripped = content.replace(/<!--[\s\S]*?-->/g, "");
	return <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripped}</ReactMarkdown>;
}
