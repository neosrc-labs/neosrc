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
    return {
        provider: target.slice(0, colonIndex),
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
