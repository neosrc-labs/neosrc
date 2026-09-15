// Row geometry mirrors a loaded branch row (40px, 5 columns) so the table
// does not jump when the branches arrive.
const SKELETON_ROWS = ["sk1", "sk2", "sk3", "sk4", "sk5"];
const SKELETON_COLUMNS = ["branch", "updated", "checks", "pull", "actions"];

export function BranchTableSkeleton() {
    return (
        <div>
            <div className="flex h-8 items-center gap-4 border-border border-b bg-surface-elevated px-4">
                {SKELETON_COLUMNS.map((column) => (
                    <div
                        key={`head-${column}`}
                        className="h-3 w-16 animate-pulse rounded bg-surface-selected"
                    />
                ))}
            </div>
            {SKELETON_ROWS.map((row) => (
                <div
                    key={row}
                    className="flex h-10 items-center gap-4 border-border-subtle border-b px-4"
                >
                    {SKELETON_COLUMNS.map((column) => (
                        <div
                            key={`${row}-${column}`}
                            className="h-3 w-24 animate-pulse rounded bg-surface-selected"
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
