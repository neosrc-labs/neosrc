"use client";

import { useTheme } from "next-themes";
import type * as React from "react";
import { cn } from "~/lib/utils";

interface LabelProps extends React.HTMLAttributes<HTMLElement> {
    color: string;
}

function luminance(hex: string): number {
    const r = Number.parseInt(hex.substring(0, 2), 16);
    const g = Number.parseInt(hex.substring(2, 4), 16);
    const b = Number.parseInt(hex.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function getTextColor(hex: string, darkMode: boolean): string {
    if (darkMode) {
        return `#${hex}`;
    }

    return luminance(hex) > 0.5 ? "#1f2328" : "#ffffff";
}

function getBgColor(hex: string, darkMode: boolean): string {
    if (darkMode) {
        return `#${hex}20`;
    }
    return `#${hex}`;
}

export function Label({ color, className, children }: LabelProps) {
    const { resolvedTheme } = useTheme();
    const darkMode = resolvedTheme === "dark";

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs",
                className,
            )}
            style={{
                backgroundColor: getBgColor(color, darkMode),
                color: getTextColor(color, darkMode),
            }}
        >
            {children}
        </span>
    );
}
