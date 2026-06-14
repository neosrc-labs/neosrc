export function IssueSkeleton() {
    return (
        <div className="space-y-0">
            {["sk1", "sk2", "sk3", "sk4", "sk5"].map((id) => (
                <div
                    key={id}
                    className="flex items-start gap-3 border-gray-200 border-b px-4 py-3 dark:border-zinc-800"
                >
                    <div className="mt-0.5 size-4 shrink-0 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                            <div className="size-4 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                        </div>
                        <div className="flex items-center gap-1">
                            <div className="h-3 w-32 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                            <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                        </div>
                        <div className="flex flex-wrap gap-1">
                            <div className="h-5 w-12 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
                            <div className="h-5 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
                        </div>
                    </div>
                    <div className="flex w-20 shrink-0 items-center justify-center">
                        <div className="size-5 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
                    </div>
                    <div className="flex w-16 shrink-0 items-center justify-end">
                        <div className="h-4 w-8 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
                    </div>
                </div>
            ))}
        </div>
    );
}
