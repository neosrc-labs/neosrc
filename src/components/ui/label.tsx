"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "~/utils/helpers";

interface LabelProps extends React.HTMLAttributes<HTMLElement> {
    color: string;
    description?: string;
}

function channels(hex: string): [number, number, number] {
    const h = hex.startsWith("#") ? hex.slice(1) : hex;
    return [
        Number.parseInt(h.substring(0, 2), 16),
        Number.parseInt(h.substring(2, 4), 16),
        Number.parseInt(h.substring(4, 6), 16),
    ];
}

// WCAG relative luminance.
function relLuminance(hex: string): number {
    const [r, g, b] = channels(hex).map((c) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Mix toward white by t (0 = unchanged, 1 = white).
function lighten(hex: string, t: number): string {
    const [r, g, b] = channels(hex);
    const mix = (c: number) => Math.round(c + (255 - c) * t);
    return [mix(r), mix(g), mix(b)]
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("");
}

function labelStyle(hex: string, darkMode: boolean): React.CSSProperties {
    if (darkMode) {
        // Tint over an assumed #0d1117 surface. Lighten the label color for
        // text instead of falling back to white so the chip keeps its hue.
        const bgRgb = channels(hex).map((c) =>
            Math.round(0x0d + (c - 0x0d) * 0.125),
        );
        const bg = bgRgb.map((c) => c.toString(16).padStart(2, "0")).join("");
        return {
            backgroundColor: `#${bg}`,
            color: `#${lighten(hex, 0.65)}`,
            borderColor: `#${hex}66`,
            borderWidth: 1,
            borderStyle: "solid",
        };
    }
    // Full-color chip in light mode; dark text on light labels, white otherwise.
    return {
        backgroundColor: `#${hex}`,
        color: relLuminance(hex) > 0.35 ? "#1f2328" : "#ffffff",
    };
}

export function Label({
    color,
    description,
    className,
    children,
    ...props
}: LabelProps) {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Before mount, render without theme-dependent styles so SSR and
    // initial client render match. next-themes recommends this pattern.
    // FIXME: Could we hack around this by setting a theme cookie?
    const darkMode = mounted ? resolvedTheme === "dark" : true;

    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 font-medium text-xs",
                className,
            )}
            style={labelStyle(color, darkMode)}
            title={description}
            {...props}
        >
            {children}
        </span>
    );
}
