"use client";

import { CheckIcon, ChevronDownIcon, Code2Icon, CopyIcon } from "lucide-react";
import { useCallback, useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/lib/utils";

interface ClonePopoverProps {
    owner: string;
    repo: string;
}

type CloneTab = "https" | "ssh" | "cli";

const TAB_OPTIONS: { key: CloneTab; label: string }[] = [
    { key: "https", label: "HTTPS" },
    { key: "ssh", label: "SSH" },
    { key: "cli", label: "GitHub CLI" },
];

function getCloneUrl(owner: string, repo: string, tab: CloneTab): string {
    switch (tab) {
        case "ssh":
            return `git@github.com:${owner}/${repo}.git`;
        case "cli":
            return `gh repo clone ${owner}/${repo}`;
        default:
            return `https://github.com/${owner}/${repo}.git`;
    }
}

export function ClonePopover({ owner, repo }: ClonePopoverProps) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<CloneTab>("https");
    const url = getCloneUrl(owner, repo, tab);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition",
                        open
                            ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
                            : "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600",
                    )}
                >
                    <Code2Icon className="h-3.5 w-3.5" />
                    <span>Code</span>
                    <ChevronDownIcon className="h-3 w-3 text-text-tertiary" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="border-border border-b p-3 pb-0">
                    <div className="flex gap-0.5 rounded-md bg-surface-secondary p-0.5">
                        {TAB_OPTIONS.map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                className={cn(
                                    "flex-1 cursor-pointer rounded-sm px-2 py-1 font-medium text-xs transition-colors",
                                    tab === option.key
                                        ? "bg-surface text-text-primary shadow-xs"
                                        : "text-text-tertiary hover:text-text-secondary",
                                )}
                                onClick={() => setTab(option.key)}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="p-3">
                    <div className="flex items-center gap-2">
                        <input
                            readOnly
                            value={url}
                            className="min-w-0 flex-1 rounded-md border border-border bg-surface-secondary px-2.5 py-1.5 font-mono text-text-primary text-xs outline-hidden"
                            onFocus={(e) => e.target.select()}
                        />
                        <CopyButton text={url} />
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [text]);

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-surface-secondary"
        >
            {copied ? (
                <>
                    <CheckIcon className="h-3 w-3 text-green-600" />
                    <span>Copied</span>
                </>
            ) : (
                <>
                    <CopyIcon className="h-3 w-3" />
                    <span>Copy</span>
                </>
            )}
        </button>
    );
}
