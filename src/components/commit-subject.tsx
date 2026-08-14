import { TriangleAlert } from "lucide-react";
import { CommitTypeBadge } from "~/components/commit-type-badge";
import { CodeTitle } from "~/components/markdown/accessories/code-title";
import { cn } from "~/lib/utils";
import { parseCommitMessage } from "~/utils/commit-message";

export function CommitSubject({
    provider,
    owner,
    repo,
    message,
    className,
}: {
    provider?: string;
    owner?: string;
    repo?: string;
    message: string;
    className?: string;
}) {
    const { subject, conventional } = parseCommitMessage(message);

    if (!conventional) {
        return (
            <span className={className}>
                <CodeTitle provider={provider} owner={owner} repo={repo}>
                    {subject}
                </CodeTitle>
            </span>
        );
    }

    return (
        <span
            className={cn(
                "inline-flex min-w-0 items-center gap-1.5",
                className,
            )}
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
            <span className="truncate">
                <CodeTitle provider={provider} owner={owner} repo={repo}>
                    {conventional.description}
                </CodeTitle>
            </span>
        </span>
    );
}
