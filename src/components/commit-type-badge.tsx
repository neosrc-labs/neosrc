import type { ConventionalParts } from "~/utils/commit-message";

const TYPE_COLORS: Record<string, string> = {
    feat: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    fix: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    perf: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    refactor:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    revert: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    docs: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400",
    style: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400",
    test: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    build: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    ci: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
    chore: "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-gray-400",
};

const BREAKING_COLOR =
    "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 font-bold";

export function CommitTypeBadge({
    conventional,
}: {
    conventional: ConventionalParts;
}) {
    const color = conventional.breaking
        ? BREAKING_COLOR
        : (TYPE_COLORS[conventional.type] ?? TYPE_COLORS.chore);

    return (
        <span
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0 font-mono text-[11px] leading-[1.4] ${color}`}
        >
            {conventional.breaking && <span aria-hidden="true">!</span>}
            {conventional.type}
        </span>
    );
}
