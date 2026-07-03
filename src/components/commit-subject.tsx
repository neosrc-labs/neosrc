import { TriangleAlert } from "lucide-react";
import { CommitTypeBadge } from "~/components/commit-type-badge";
import { parseCommitMessage } from "~/utils/commit-message";

export function CommitSubject({
    message,
    className,
}: {
    message: string;
    className?: string;
}) {
    const { subject, conventional } = parseCommitMessage(message);

    if (!conventional) {
        return <span className={className}>{subject}</span>;
    }

    return (
        <span
            className={`inline-flex min-w-0 items-center gap-1.5 ${className ?? ""}`}
        >
            <CommitTypeBadge conventional={conventional} />
            {conventional.breaking && (
                <span title="Breaking change">
                    <TriangleAlert
                        aria-label="Breaking change"
                        className="size-3.5 shrink-0 text-red-600 dark:text-red-400"
                    />
                </span>
            )}
            {conventional.scope && (
                <span className="shrink-0 opacity-60">
                    ({conventional.scope})
                </span>
            )}
            <span className="truncate">{conventional.description}</span>
        </span>
    );
}
