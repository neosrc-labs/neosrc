"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "dub-sidebar-width";
const DEFAULT_WIDTH = 250;
const MIN_WIDTH = 200;
const MAX_WIDTH = 500;

interface ResizableLayoutProps {
	leftSidebar: ReactNode;
	children: ReactNode;
	rightSidebar: ReactNode;
}

export function ResizableLayout({
	leftSidebar,
	children,
	rightSidebar,
}: ResizableLayoutProps) {
	const [leftWidth, setLeftWidth] = useState(DEFAULT_WIDTH);
	const isDraggingRef = useRef(false);
	const startXRef = useRef(0);
	const startWidthRef = useRef(DEFAULT_WIDTH);

	// Load saved width from localStorage on mount
	useEffect(() => {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved) {
			const parsed = parseInt(saved, 10);
			if (!Number.isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
				setLeftWidth(parsed);
			}
		}
	}, []);

	const handleMouseDown = (e: React.MouseEvent) => {
		isDraggingRef.current = true;
		startXRef.current = e.clientX;
		startWidthRef.current = leftWidth;

		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";

		const handleMouseMove = (e: MouseEvent) => {
			if (!isDraggingRef.current) return;

			const delta = e.clientX - startXRef.current;
			const newWidth = Math.min(
				MAX_WIDTH,
				Math.max(MIN_WIDTH, startWidthRef.current + delta),
			);
			setLeftWidth(newWidth);
		};

		const handleMouseUp = () => {
			isDraggingRef.current = false;
			document.body.style.cursor = "";
			document.body.style.userSelect = "";
			localStorage.setItem(STORAGE_KEY, leftWidth.toString());

			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);
	};

	return (
		<div
			className="grid"
			style={{ gridTemplateColumns: `${leftWidth}px 1fr 300px` }}
		>
			{/* Left Sidebar - Sticky */}
			<div className="relative sticky top-[var(--header-height)] h-[calc(99vh-var(--header-height))] overflow-y-auto">
				{leftSidebar}
				{/* Drag Handle */}
				<div
					className="absolute top-0 right-0 h-full w-1 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-500 active:bg-blue-600"
					onMouseDown={handleMouseDown}
				/>
			</div>

			{/* Middle Section - PR Content */}
			<main className="min-w-0 border-gray-200 border-r bg-white">
				{children}
			</main>

			{/* Right Sidebar - Sticky */}
			<div className="sticky sticky top-[var(--header-height)] h-[calc(99vh-var(--header-height))] overflow-y-auto">
				{rightSidebar}
			</div>
		</div>
	);
}
