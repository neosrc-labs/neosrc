// Row geometry mirrors a pull/issue row (89px: py-3, 16px icon, 64px body, border-b),
// so loaded rows land where the placeholder was. Bars sit inset in their line
// boxes to keep the three lines visually apart.
export function ListSkeleton() {
    return (
        <div>
            {["sk1", "sk2", "sk3", "sk4", "sk5"].map((id) => (
                <div
                    key={id}
                    className="flex items-start gap-3 border-border-subtle border-b px-4 py-3"
                >
                    <div className="mt-0.5 size-4 shrink-0 animate-pulse rounded bg-surface-selected" />
                    <div className="min-w-0 flex-1">
                        <div className="mt-2 h-3.5 w-3/4 animate-pulse rounded bg-surface-selected" />
                        <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-surface-selected" />
                        <div className="mt-2 h-3.5 w-24 animate-pulse rounded-full bg-surface-selected" />
                    </div>
                    <div className="h-4 w-8 shrink-0 animate-pulse rounded bg-surface-selected" />
                </div>
            ))}
        </div>
    );
}
