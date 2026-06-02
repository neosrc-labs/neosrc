"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useSidebar } from "./sidebar-context";

const LEFT_STORAGE_KEY = "neosrc-sidebar-width";
const RIGHT_STORAGE_KEY = "neosrc-right-sidebar-width";
const DEFAULT_LEFT_WIDTH = 250;
const DEFAULT_RIGHT_WIDTH = 300;
const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DRAG_MIN = 50;
const COLLAPSE_THRESHOLD = 100;

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
    const { isLeftOpen, isRightOpen, toggleLeft, toggleRight } = useSidebar();
    const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
    const [rightWidth, setRightWidth] = useState(DEFAULT_RIGHT_WIDTH);
    const isDraggingRef = useRef(false);
    const dragSideRef = useRef<"left" | "right">("left");
    const startXRef = useRef(0);
    const startWidthRef = useRef(DEFAULT_LEFT_WIDTH);
    const currentWidthRef = useRef(DEFAULT_LEFT_WIDTH);

    // Load saved widths from localStorage on mount
    useEffect(() => {
        const savedLeft = localStorage.getItem(LEFT_STORAGE_KEY);
        if (savedLeft) {
            const parsed = parseInt(savedLeft, 10);
            if (
                !Number.isNaN(parsed) &&
                parsed >= MIN_WIDTH &&
                parsed <= MAX_WIDTH
            ) {
                setLeftWidth(parsed);
            }
        }

        const savedRight = localStorage.getItem(RIGHT_STORAGE_KEY);
        if (savedRight) {
            const parsed = parseInt(savedRight, 10);
            if (
                !Number.isNaN(parsed) &&
                parsed >= MIN_WIDTH &&
                parsed <= MAX_WIDTH
            ) {
                setRightWidth(parsed);
            }
        }
    }, []);

    const handleMouseDown =
        (side: "left" | "right") => (e: React.MouseEvent) => {
            isDraggingRef.current = true;
            dragSideRef.current = side;
            startXRef.current = e.clientX;
            const initialWidth = side === "left" ? leftWidth : rightWidth;
            startWidthRef.current = initialWidth;
            currentWidthRef.current = initialWidth;

            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";

            const handleMouseMove = (e: MouseEvent) => {
                if (!isDraggingRef.current) return;

                const delta = e.clientX - startXRef.current;
                let newWidth: number;

                if (dragSideRef.current === "left") {
                    newWidth = Math.min(
                        MAX_WIDTH,
                        Math.max(DRAG_MIN, startWidthRef.current + delta),
                    );
                    setLeftWidth(newWidth);
                } else {
                    newWidth = Math.min(
                        MAX_WIDTH,
                        Math.max(DRAG_MIN, startWidthRef.current - delta),
                    );
                    setRightWidth(newWidth);
                }
                currentWidthRef.current = newWidth;
            };

            const handleMouseUp = () => {
                isDraggingRef.current = false;
                document.body.style.cursor = "";
                document.body.style.userSelect = "";

                const side = dragSideRef.current;
                const finalWidth = currentWidthRef.current;

                if (finalWidth < COLLAPSE_THRESHOLD) {
                    if (side === "left") {
                        toggleLeft();
                        setLeftWidth(DEFAULT_LEFT_WIDTH);
                    } else {
                        toggleRight();
                        setRightWidth(DEFAULT_RIGHT_WIDTH);
                    }
                } else {
                    const clamped = Math.min(
                        MAX_WIDTH,
                        Math.max(MIN_WIDTH, finalWidth),
                    );
                    if (side === "left") {
                        setLeftWidth(clamped);
                    } else {
                        setRightWidth(clamped);
                    }
                    const key =
                        side === "left" ? LEFT_STORAGE_KEY : RIGHT_STORAGE_KEY;
                    localStorage.setItem(key, clamped.toString());
                }

                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            };

            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
        };

    const getGridTemplateColumns = () => {
        const leftCol = isLeftOpen ? `${leftWidth}px` : "0px";
        const rightCol = isRightOpen ? `${rightWidth}px` : "0px";
        return `${leftCol} 1fr ${rightCol}`;
    };

    return (
        <div
            className="grid"
            style={{ gridTemplateColumns: getGridTemplateColumns() }}
        >
            {/* Left Sidebar - Sticky */}
            <div
                className={`relative sticky top-[var(--header-height)] h-[calc(99vh-var(--header-height))] overflow-y-auto ${!isLeftOpen ? "overflow-hidden" : ""}`}
            >
                {isLeftOpen && (
                    <div
                        className="absolute top-0 right-0 z-10 h-full w-1 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-500 active:bg-blue-600 dark:bg-zinc-700"
                        onMouseDown={handleMouseDown("left")}
                    />
                )}
                {leftSidebar}
            </div>

            {/* Middle Section - PR Content */}
            <main className="min-w-0 border-gray-200 border-r bg-white dark:border-zinc-800 dark:bg-zinc-950">
                {children}
            </main>

            {/* Right Sidebar - Sticky */}
            <div
                className={`relative sticky top-[var(--header-height)] h-[calc(99vh-var(--header-height))] overflow-y-auto ${!isRightOpen ? "overflow-hidden" : ""}`}
            >
                {isRightOpen && (
                    <div
                        className="absolute top-0 left-0 z-10 h-full w-1 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-500 active:bg-blue-600 dark:bg-zinc-700"
                        onMouseDown={handleMouseDown("right")}
                    />
                )}
                {rightSidebar}
            </div>
        </div>
    );
}
