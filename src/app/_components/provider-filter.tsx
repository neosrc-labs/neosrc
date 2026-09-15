"use client";

import { CodebergIcon, GitHubIcon } from "~/components/icons";
import type { ViewerItemProvider } from "~/server/api/routers/dashboard/types";
import { cn } from "~/utils/helpers";
import { providerLabel } from "~/utils/provider-url";

export type ProviderFilterValue = "all" | ViewerItemProvider;

interface FilterOption {
    value: ProviderFilterValue;
    label: string;
    Icon?: (props: { className?: string }) => React.ReactNode;
}

const OPTIONS: FilterOption[] = [
    { value: "all", label: "All" },
    { value: "gh", label: providerLabel("gh"), Icon: GitHubIcon },
    { value: "cb", label: providerLabel("cb"), Icon: CodebergIcon },
];

export function ProviderFilter({
    value,
    onChange,
    providers,
}: {
    value: ProviderFilterValue;
    onChange: (value: ProviderFilterValue) => void;
    /** Linked providers; `all` is always offered. */
    providers: ViewerItemProvider[];
}) {
    return (
        <fieldset className="inline-flex items-center gap-0.5 rounded-lg border border-border p-0.5">
            <legend className="sr-only">Filter by provider</legend>
            {OPTIONS.filter(
                (option) =>
                    option.value === "all" || providers.includes(option.value),
            ).map((option) => {
                const { Icon } = option;
                const selected = option.value === value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-sm transition-colors",
                            selected
                                ? "bg-surface-tertiary font-medium text-text-primary"
                                : "text-text-secondary hover:text-text-primary",
                        )}
                    >
                        {Icon && <Icon className="size-3.5" />}
                        {option.label}
                    </button>
                );
            })}
        </fieldset>
    );
}
