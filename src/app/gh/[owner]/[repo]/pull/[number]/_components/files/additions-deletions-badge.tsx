import { cn } from "~/utils/helpers";

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
                <span className="font-medium text-success-emphasis">
                    +{additions.toLocaleString()}
                </span>
            )}
            {deletions > 0 && (
                <span className="font-medium text-danger-emphasis">
                    -{deletions.toLocaleString()}
                </span>
            )}
        </div>
    );
}
