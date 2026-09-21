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

function clamp(n: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(n, hi));
}

// WCAG relative luminance, normalized to 0..1.
function perceivedLightness([r, g, b]: [number, number, number]): number {
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function hexToHsl(hex: string): [number, number, number] {
    const [r0, g0, b0] = channels(hex).map((c) => c / 255) as [
        number,
        number,
        number,
    ];
    const max = Math.max(r0, g0, b0);
    const min = Math.min(r0, g0, b0);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min;
    const s = d / (1 - Math.abs(2 * l - 1));
    let h: number;
    if (max === r0) h = ((g0 - b0) / d) % 6;
    else if (max === g0) h = (b0 - r0) / d + 2;
    else h = (r0 - g0) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    return [h, Math.round(s * 100), Math.round(l * 100)];
}

// Mirrors GitHub's Primer IssueLabel token styling (primer-react-css
// .prc-Token-IssueLabel) so chips look identical to github.com.
function labelStyle(hex: string, darkMode: boolean): React.CSSProperties {
    const rgb = channels(hex);
    const perceived = perceivedLightness(rgb);
    const [h, s, l] = hexToHsl(hex);

    if (darkMode) {
        // 18% tint of the raw color; text/border use the color itself,
        // lightened in HSL space when too dark against the background.
        const threshold = 0.6;
        const lightenBy =
            (threshold - perceived) *
            100 *
            clamp(1 / (threshold - perceived), 0, 1);
        const l2 = Math.round(l + lightenBy);
        const fg = `hsl(${h} ${s}% ${l2}%)`;
        return {
            backgroundColor: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.18)`,
            color: fg,
            borderColor: `hsl(${h} ${s}% ${l2}% / 0.3)`,
            borderWidth: 1,
            borderStyle: "solid",
        };
    }

    // Full-color chip. Dark labels get white text, light labels black text.
    const threshold = 0.453;
    const textSwitch = clamp(1 / (threshold - perceived), 0, 1);
    const borderAlpha = clamp((perceived - 0.96) * 100, 0, 1);
    return {
        backgroundColor: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
        color: textSwitch > 0.5 ? "#ffffff" : "#000000",
        borderColor: `hsl(${h} ${s}% ${Math.max(l - 25, 0)}% / ${borderAlpha})`,
        borderWidth: 1,
        borderStyle: "solid",
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
