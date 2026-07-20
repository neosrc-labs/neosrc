"use client";

import {
    CheckIcon,
    ChevronDownIcon,
    GitBranchIcon,
    SearchIcon,
    XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";

interface RefSelectorProps {
    owner: string;
    repo: string;
    selectedRef: string;
    onSelect: (ref: string) => void;
}

type Tab = "branches" | "tags";

interface RefItem {
    name: string;
}

export function RefSelector({
    owner,
    repo,
    selectedRef,
    onSelect,
}: RefSelectorProps) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<Tab>("branches");
    const [filter, setFilter] = useState("");
    const searchInputRef = useRef<HTMLInputElement>(null);

    const { data: branches } = api.repos.getBranches.useQuery({
        owner,
        repo,
    });

    const { data: tags } = api.repos.getTags.useQuery({
        owner,
        repo,
    });

    const items: RefItem[] = useMemo(() => {
        const source = tab === "branches" ? branches : tags;
        if (!source) return [];
        const lower = filter.toLowerCase();
        return source.filter((item) => item.name.toLowerCase().includes(lower));
    }, [tab, branches, tags, filter]);

    useEffect(() => {
        if (open) {
            setFilter("");
            const timer = setTimeout(() => {
                searchInputRef.current?.focus();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [open]);

    const handleSelect = (name: string) => {
        onSelect(name);
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition",
                        open
                            ? "border-border bg-surface-secondary text-text-primary"
                            : "border-border bg-surface text-text-primary hover:bg-surface-secondary",
                    )}
                >
                    <GitBranchIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
                    <span className="max-w-[200px] truncate">
                        {selectedRef}
                    </span>
                    <ChevronDownIcon className="h-3 w-3 shrink-0 text-text-tertiary" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start">
                <div className="border-border border-b p-3 pb-0">
                    <div className="relative">
                        <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    setFilter("");
                                }
                            }}
                            placeholder={`Find a ${tab === "branches" ? "branch" : "tag"}...`}
                            className="w-full rounded-md border border-border bg-surface-secondary py-1.5 pr-7 pl-8 text-text-primary text-xs outline-hidden placeholder:text-text-tertiary"
                        />
                        {filter && (
                            <button
                                type="button"
                                className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-text-tertiary hover:text-text-secondary"
                                onClick={() => setFilter("")}
                            >
                                <XIcon className="h-3 w-3" />
                            </button>
                        )}
                    </div>
                    <div className="mt-2 flex gap-0.5 rounded-md bg-surface-secondary p-0.5">
                        <button
                            type="button"
                            className={cn(
                                "flex-1 cursor-pointer rounded-sm px-2 py-1 font-medium text-xs transition-colors",
                                tab === "branches"
                                    ? "bg-surface text-text-primary shadow-xs"
                                    : "text-text-tertiary hover:text-text-secondary",
                            )}
                            onClick={() => setTab("branches")}
                        >
                            Branches
                        </button>
                        <button
                            type="button"
                            className={cn(
                                "flex-1 cursor-pointer rounded-sm px-2 py-1 font-medium text-xs transition-colors",
                                tab === "tags"
                                    ? "bg-surface text-text-primary shadow-xs"
                                    : "text-text-tertiary hover:text-text-secondary",
                            )}
                            onClick={() => setTab("tags")}
                        >
                            Tags
                        </button>
                    </div>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                    {items.length === 0 ? (
                        <div className="px-3 py-4 text-center text-text-tertiary text-xs">
                            {filter ? "No matching items" : `No ${tab} to show`}
                        </div>
                    ) : (
                        items.map((item) => (
                            <button
                                key={item.name}
                                type="button"
                                className={cn(
                                    "flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-surface-secondary",
                                    item.name === selectedRef
                                        ? "bg-surface-secondary"
                                        : "text-text-primary",
                                )}
                                onClick={() => handleSelect(item.name)}
                            >
                                <span className="flex w-4 shrink-0 items-center justify-center">
                                    {item.name === selectedRef && (
                                        <CheckIcon className="h-3.5 w-3.5 text-text-label" />
                                    )}
                                </span>
                                <span className="truncate">{item.name}</span>
                            </button>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
