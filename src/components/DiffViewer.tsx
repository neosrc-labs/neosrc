"use client";

import { html as diff2html } from "diff2html";
import { useEffect, useRef } from "react";
import "diff2html/bundles/css/diff2html.min.css";

interface DiffViewerProps {
	diff: string;
	fileName: string;
}

export default function DiffViewer({ diff, fileName }: DiffViewerProps) {
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {

		console.log("diff input:", JSON.stringify(diff));
		if (containerRef.current) {
			const normalizedDiff = diff.startsWith("---")
				? diff
				: `--- a/${fileName}\n+++ b/${fileName}\n${diff}`;
			const diffHtml = diff2html(normalizedDiff, {
				drawFileList: false,
				matching: "lines",
				outputFormat: "line-by-line",
			});
			containerRef.current.innerHTML = diffHtml;
		}
	}, [diff]);

	return (
		<div className="diff-viewer mb-6 rounded-lg border border-gray-200">
			<div ref={containerRef} />
		</div>
	);
}
