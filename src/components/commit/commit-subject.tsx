import { TriangleAlert } from "lucide-react";
import { CodeTitle } from "~/components/markdown/accessories/code-title";
import { parseCommitMessage } from "~/utils/commit-message";
import { cn } from "~/utils/helpers";
import type { Provider } from "~/utils/provider-url";
import { CommitTypeBadge } from "./commit-type-badge";

export function CommitSubject({
    provider,
    owner,
    repo,
    message,
    className,
}: {
    provider?: Provider;
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
                        className="size-3.5 shrink-0 text-danger-emphasis"
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
