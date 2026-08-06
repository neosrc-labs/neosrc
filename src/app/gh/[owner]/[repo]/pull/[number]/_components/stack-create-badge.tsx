"use client";

import { LayersPlus } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "~/components/ui/tooltip";

interface StackCreateBadgeProps {
    onClick: () => void;
}

export function StackCreateBadge({ onClick }: StackCreateBadgeProps) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    aria-label="Create stack"
                    className="flex cursor-pointer items-center rounded px-1 py-0.5 text-text-secondary transition-colors hover:bg-surface-selected hover:text-text"
                    onClick={onClick}
                >
                    <LayersPlus className="size-3.5" />
                </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Create stack</TooltipContent>
        </Tooltip>
    );
}
