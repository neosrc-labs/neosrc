import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function opId() {
    return Math.floor(Math.random() * 10000000);
}

export function parseTarget(target: string): {
    provider: string | null;
    name: string;
} {
    const colonIndex = target.indexOf(":");
    if (colonIndex === -1) return { provider: null, name: target };
    const provider = target.slice(0, colonIndex);
    return {
        provider: provider || null,
        name: target.slice(colonIndex + 1),
    };
}

export function applyArrayOperations<
    TItem,
    TOp extends { id: number; op: "add" | "remove" },
>(
    items: TItem[],
    operations: ReadonlyArray<TOp>,
    getValue: (op: TOp) => TItem,
    keyFn: (item: TItem) => string,
): TItem[] {
    let updated = [...items];
    for (const op of operations) {
        const value = getValue(op);
        if (
            op.op === "add" &&
            !updated.some((i) => keyFn(i) === keyFn(value))
        ) {
            updated.push(value);
        }
        if (op.op === "remove") {
            updated = updated.filter((i) => keyFn(i) !== keyFn(value));
        }
    }
    return updated;
}

export function formatCount(n: number): string {
    if (n < 1000) return String(n);
    if (n < 1_000_000) {
        const k = n / 1000;
        return `${k % 1 === 0 ? k : k.toFixed(1)}K`;
    }
    const m = n / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1)}M`;
}

/** Stable tab/hash id for a repo doc file (README, CONTRIBUTING, LICENSE, ...). */
export function getDocFileHashName(name: string): string {
    if (/^readme/i.test(name)) return "readme";
    if (/^contributing/i.test(name)) return "contributing";
    if (/^code_of_conduct/i.test(name)) return "code-of-conduct";
    if (/^(licen[cs]e|copying)/i.test(name)) return "license";
    return name.toLowerCase().replace(/\.[^.]+$/, "");
}
