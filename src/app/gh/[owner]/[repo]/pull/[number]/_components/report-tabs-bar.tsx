"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import type { RouterOutputs } from "~/trpc/react";

type Report = RouterOutputs["reports"]["getReportsByPullRequest"][number];

interface ReportTabsBarProps {
    reports: Report[];
    activeTab: string;
    onTabChange: (tab: string) => void;
}

const TIMELINE_TAB = "__timeline";
const MORE_BUTTON_WIDTH_ESTIMATE = 90;

export function ReportTabsBar({
    reports,
    activeTab,
    onTabChange,
}: ReportTabsBarProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const moreRef = useRef<HTMLButtonElement>(null);
    const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
    const [visibleCount, setVisibleCount] = useState<number>(
        reports.length + 1,
    );
    const [popoverOpen, setPopoverOpen] = useState(false);

    const tabs = useMemo(
        () => [
            { key: TIMELINE_TAB, title: "Timeline" },
            ...reports.map((r) => ({ key: r.name, title: r.title })),
        ],
        [reports],
    );

    const setTabRef = useCallback(
        (key: string) => (el: HTMLButtonElement | null) => {
            if (el) tabRefs.current.set(key, el);
            else tabRefs.current.delete(key);
        },
        [],
    );

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const measure = () => {
            const containerWidth = container.clientWidth;
            const gap = 4;
            const moreWidth =
                moreRef.current?.offsetWidth ?? MORE_BUTTON_WIDTH_ESTIMATE;

            let totalWidth = 0;
            let count = 0;

            for (const tab of tabs) {
                const el = tabRefs.current.get(tab.key);
                if (!el) break;

                const tabWidth = el.offsetWidth;
                const widthWithGap =
                    totalWidth + tabWidth + (count > 0 ? gap : 0);
                const isLast = count === tabs.length - 1;
                const needsMore = !isLast;
                const effectiveWidth =
                    widthWithGap + (needsMore ? gap + moreWidth : 0);

                if (effectiveWidth <= containerWidth) {
                    totalWidth = widthWithGap;
                    count++;
                } else {
                    break;
                }
            }

            if (count !== visibleCount) {
                setVisibleCount(count);
            }
        };

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(container);
        return () => observer.disconnect();
    }, [tabs, visibleCount]);

    const visibleTabs = tabs.slice(0, visibleCount);
    const overflowTabs = tabs.slice(visibleCount);
    const hasOverflow = overflowTabs.length > 0;
    const activeOverflowed =
        hasOverflow && overflowTabs.some((t) => t.key === activeTab);

    const tabClassName = (isActive: boolean) =>
        `cursor-pointer rounded-t-md px-3 py-1.5 font-medium text-sm transition-colors whitespace-nowrap ${
            isActive
                ? "border-gray-200 border-x border-t bg-white text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                : "text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        }`;

    return (
        <div
            ref={containerRef}
            className="flex gap-1 overflow-hidden border-gray-200 border-b dark:border-zinc-700"
        >
            {visibleTabs.map((tab) => (
                <button
                    key={tab.key}
                    ref={setTabRef(tab.key)}
                    type="button"
                    onClick={() => onTabChange(tab.key)}
                    className={tabClassName(activeTab === tab.key)}
                >
                    {tab.title}
                </button>
            ))}
            {hasOverflow && (
                <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                    <PopoverTrigger asChild>
                        <button
                            ref={moreRef}
                            type="button"
                            className={`cursor-pointer whitespace-nowrap rounded-t-md px-3 py-1.5 font-medium text-sm transition-colors ${
                                activeOverflowed
                                    ? "border-gray-200 border-x border-t bg-white text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                                    : "text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300"
                            }`}
                        >
                            <span className="flex items-center gap-0.5">
                                {overflowTabs.length} more
                                <ChevronDown
                                    size={14}
                                    className={popoverOpen ? "rotate-180" : ""}
                                />
                            </span>
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="start"
                        sideOffset={8}
                        className="w-52 space-y-0.5 bg-white p-1 dark:bg-zinc-900"
                    >
                        {overflowTabs.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => {
                                    onTabChange(tab.key);
                                    setPopoverOpen(false);
                                }}
                                className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                                    activeTab === tab.key
                                        ? "bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100"
                                        : "text-gray-700 hover:bg-gray-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                                }`}
                            >
                                {tab.title}
                            </button>
                        ))}
                    </PopoverContent>
                </Popover>
            )}
        </div>
    );
}
