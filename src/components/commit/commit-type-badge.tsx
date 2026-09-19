import type { ConventionalParts } from "~/utils/commit-message";

const TYPE_COLORS: Record<string, string> = {
    feat: "bg-success-surface text-success-text",
    fix: "bg-danger-surface text-danger-text",
    perf: "bg-info-surface text-info-text",
    refactor: "bg-info-surface text-info-text",
    revert: "bg-danger-surface text-danger-text",
    docs: "bg-surface-tertiary text-text-secondary",
    style: "bg-surface-tertiary text-text-secondary",
    test: "bg-warning-surface text-warning-text",
    build: "bg-info-surface text-info-text",
    ci: "bg-info-surface text-info-text",
    chore: "bg-surface-tertiary text-text-secondary",
};

const NEUTRAL_COLOR = "bg-surface-tertiary text-text-secondary";

export function CommitTypeBadge({
    conventional,
}: {
    conventional: ConventionalParts;
}) {
    const color = TYPE_COLORS[conventional.type] ?? NEUTRAL_COLOR;

    return (
        <span
            className={`inline-flex shrink-0 items-center rounded-full px-2 py-1 font-mono text-xs leading-none ${color}`}
        >
            {conventional.type}
        </span>
    );
}
