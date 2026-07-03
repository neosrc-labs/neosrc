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
            className={`inline-flex min-w-0 items-baseline gap-1.5 ${className ?? ""}`}
        >
            <CommitTypeBadge conventional={conventional} />
            {conventional.scope && (
                <span className="shrink-0 text-gray-500 dark:text-gray-400">
                    ({conventional.scope})
                </span>
            )}
            <span className="truncate">{conventional.description}</span>
        </span>
    );
}
