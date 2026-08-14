import { cn } from "~/lib/utils";

export function AdditionsDeletionsBadge({
    additions,
    deletions,
    className,
}: {
    additions: number;
    deletions: number;
    className?: string;
}) {
    return (
        <div className={cn("flex items-center gap-1.5 text-sm", className)}>
            {additions > 0 && (
                <span className="font-medium text-green-600 dark:text-green-500">
                    +{additions.toLocaleString()}
                </span>
            )}
            {deletions > 0 && (
                <span className="font-medium text-red-600 dark:text-red-500">
                    -{deletions.toLocaleString()}
                </span>
            )}
        </div>
    );
}
