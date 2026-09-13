"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";

export interface ActionsFilterOption {
    value: string;
    label: string;
    avatarUrl?: string;
}

export function ActionsFilterDropdown({
    label,
    options,
    selectedValue,
    onSelect,
    isLoading,
}: {
    label: string;
    options: ActionsFilterOption[];
    selectedValue: string | null;
    onSelect: (value: string | null) => void;
    isLoading?: boolean;
}) {
    const selectedLabel = options.find(
        (option) => option.value === selectedValue,
    )?.label;

    return (
        <SearchableDropdown
            items={options}
            isSelected={(option) => option.value === selectedValue}
            onSelect={(option) =>
                onSelect(option.value === selectedValue ? null : option.value)
            }
            keyFn={(option) => option.value}
            searchFn={(option, query) =>
                option.label.toLowerCase().includes(query.toLowerCase())
            }
            renderItem={(option) => (
                <>
                    {option.avatarUrl && (
                        <Image
                            src={option.avatarUrl}
                            alt=""
                            className="size-4 shrink-0 rounded-full"
                            width={16}
                            height={16}
                        />
                    )}
                    <span className="truncate">{option.label}</span>
                </>
            )}
            placeholder={`Filter ${label.toLowerCase()}`}
            emptyText="No matches"
            ariaLabel={`Filter by ${label.toLowerCase()}`}
            closeOnSelect
            isLoading={isLoading}
            trigger={
                <button
                    className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary dark:hover:text-zinc-100"
                    type="button"
                >
                    {selectedLabel ? `${label}: ${selectedLabel}` : label}
                    <ChevronDown className="size-3.5" />
                </button>
            }
        />
    );
}
