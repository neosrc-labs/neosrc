"use client";

import { CheckIcon, ChevronDownIcon, Code2Icon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { CopyButton } from "~/components/ui/copy-button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";
import { cn } from "~/utils/helpers";
import { domain, type Provider } from "~/utils/provider-url";

interface ClonePopoverProps {
    owner: string;
    repo: string;
    provider?: Provider;
}

type CloneTab = "https" | "ssh" | "cli";

function getTabOptions(provider: Provider): { key: CloneTab; label: string }[] {
    return [
        { key: "https", label: "HTTPS" },
        { key: "ssh", label: "SSH" },
        { key: "cli", label: provider === "cb" ? "CLI" : "GitHub CLI" },
    ];
}

function getCloneUrl(
    owner: string,
    repo: string,
    tab: CloneTab,
    provider: Provider,
): string {
    const host = domain(provider);
    switch (tab) {
        case "ssh":
            return `git@${host}:${owner}/${repo}.git`;
        case "cli":
            return provider === "cb"
                ? `git clone https://${host}/${owner}/${repo}.git`
                : `gh repo clone ${owner}/${repo}`;
        default:
            return `https://${host}/${owner}/${repo}.git`;
    }
}

export function ClonePopover({
    owner,
    repo,
    provider = "gh",
}: ClonePopoverProps) {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<CloneTab>("https");
    const tabOptions = getTabOptions(provider);
    const url = getCloneUrl(owner, repo, tab, provider);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-action bg-action px-3 py-1.5 text-action-foreground text-xs transition hover:bg-action-hover",
                        open && "bg-action-hover",
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
                        {tabOptions.map((option) => (
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
                        <CopyButton
                            text={url}
                            className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs transition-colors hover:bg-surface-secondary"
                        >
                            {(copied) =>
                                copied ? (
                                    <>
                                        <CheckIcon className="h-3 w-3 text-success-emphasis" />
                                        <span>Copied</span>
                                    </>
                                ) : (
                                    <>
                                        <CopyIcon className="h-3 w-3" />
                                        <span>Copy</span>
                                    </>
                                )
                            }
                        </CopyButton>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
