// Row geometry mirrors WorkflowRunRow (65px: py-3, 16px icon, 40px body, border-b).
// The meta line is 20px because UserLink renders a 20px avatar. Each bar is inset
// inside its line box so the two lines read as separate lines, not one block.
const SKELETON_ROWS = ["wr1", "wr2", "wr3", "wr4", "wr5"];

export function WorkflowRunSkeleton() {
    return (
        <div>
            {SKELETON_ROWS.map((id) => (
                <div
                    key={id}
                    className="flex items-start gap-3 border-border-subtle border-b px-4 py-3"
                >
                    <div className="mt-0.5 size-4 shrink-0 animate-pulse rounded bg-surface-selected" />
                    <div className="min-w-0 flex-1">
                        <div className="mt-1.5 h-3.5 w-1/2 animate-pulse rounded bg-surface-selected" />
                        <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-surface-selected" />
                    </div>
                    <div className="h-4 w-8 shrink-0 animate-pulse rounded bg-surface-selected" />
                </div>
            ))}
        </div>
    );
}
