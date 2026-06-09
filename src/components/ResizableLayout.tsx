"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useSidebar } from "./sidebar-context";

const LEFT_STORAGE_KEY = "neosrc-sidebar-width";
const RIGHT_STORAGE_KEY = "neosrc-right-sidebar-width";
const DEFAULT_LEFT_WIDTH = 325;
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
    const [sidebarTopPx, setSidebarTopPx] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const headerHeight = parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue(
                    "--header-height",
                ) || "0",
            );
            setSidebarTopPx(Math.max(0, headerHeight - window.scrollY));
        };
        handleScroll();
        window.addEventListener("scroll", handleScroll, { passive: true });
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    const sidebarTop = `${sidebarTopPx}px`;

    const isDraggingRef = useRef(false);
    const dragSideRef = useRef<"left" | "right">("left");
    const startXRef = useRef(0);
    const startWidthRef = useRef(DEFAULT_LEFT_WIDTH);
    const currentWidthRef = useRef(DEFAULT_LEFT_WIDTH);

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
            {/* Left sidebar spacer for grid layout */}
            <div className="relative">
                {isLeftOpen && (
                    <>
                        <div
                            className="fixed bottom-0 overflow-y-auto border-gray-200 border-r bg-white dark:border-zinc-800 dark:bg-zinc-950"
                            style={{
                                left: 0,
                                width: leftWidth,
                                top: sidebarTop,
                            }}
                        >
                            {leftSidebar}
                        </div>
                        <div
                            className="fixed z-10 w-1 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-500 active:bg-blue-600 dark:bg-zinc-700"
                            style={{
                                left: leftWidth - 4,
                                top: sidebarTop,
                                bottom: 0,
                            }}
                            onMouseDown={handleMouseDown("left")}
                        />
                    </>
                )}
            </div>

            {/* Middle Section - PR Content */}
            <main className="min-w-0 border-gray-200 border-r bg-white dark:border-zinc-800 dark:bg-zinc-950">
                {children}
            </main>

            {/* Right sidebar spacer for grid layout */}
            <div className="relative">
                {isRightOpen && (
                    <>
                        <div
                            className="fixed bottom-0 overflow-y-auto border-gray-200 border-l bg-white dark:border-zinc-800 dark:bg-zinc-950"
                            style={{
                                right: 0,
                                width: rightWidth,
                                top: sidebarTop,
                            }}
                        >
                            {rightSidebar}
                        </div>
                        <div
                            className="fixed z-10 w-1 cursor-col-resize bg-gray-200 transition-colors hover:bg-blue-500 active:bg-blue-600 dark:bg-zinc-700"
                            style={{
                                right: rightWidth - 4,
                                top: sidebarTop,
                                bottom: 0,
                            }}
                            onMouseDown={handleMouseDown("right")}
                        />
                    </>
                )}
            </div>
        </div>
    );
}
