import { CircleCheck, CircleDot, MessageSquare } from "lucide-react";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { CodeTitle } from "~/components/markdown/accessories/code-title";
import type { IssueSearchItem } from "~/server/api/routers/issues/types";
import { formatRelativeTime } from "~/utils/format-time";
import { domain } from "~/utils/provider-url";

export function PinnedIssues({
    issues,
    provider,
    owner,
    repo,
}: {
    issues: IssueSearchItem[];
    provider: "gh" | "cb";
    owner: string;
    repo: string;
}) {
    if (issues.length === 0) return null;

    return (
        <section
            aria-labelledby="pinned-issues-heading"
            className="mb-4 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr))]"
        >
            <h2 id="pinned-issues-heading" className="sr-only">
                Pinned issues
            </h2>
            {issues.map((issue) => (
                <article
                    key={issue.number}
                    className="flex min-h-24 min-w-0 flex-col rounded-md border border-border-subtle bg-surface px-4 py-3"
                >
                    <div className="flex min-w-0 items-start gap-2">
                        {issue.state === "OPEN" ? (
                            <CircleDot
                                aria-label="Open issue"
                                className="mt-0.5 size-4 shrink-0 text-state-open"
                            />
                        ) : (
                            <CircleCheck
                                aria-label="Closed issue"
                                className="mt-0.5 size-4 shrink-0 text-state-closed"
                            />
                        )}
                        <a
                            href={`/${provider}/${owner}/${repo}/issues/${issue.number}`}
                            className="line-clamp-2 font-semibold text-sm text-text-primary leading-5 hover:text-link"
                        >
                            <CodeTitle
                                provider={provider}
                                owner={owner}
                                repo={repo}
                            >
                                {issue.title}
                            </CodeTitle>
                        </a>
                    </div>
                    <div className="mt-auto flex min-w-0 items-center justify-between gap-3 pt-2 text-text-tertiary text-xs">
                        <div className="min-w-0 truncate">
                            <span>#{issue.number} · </span>
                            {issue.author ? (
                                <UserHoverCard
                                    login={issue.author.login}
                                    provider={provider}
                                >
                                    <a
                                        href={
                                            issue.author.url ||
                                            `https://${domain(provider)}/${encodeURIComponent(issue.author.login)}`
                                        }
                                        className="font-medium text-text-secondary hover:text-link"
                                    >
                                        {issue.author.login}
                                    </a>
                                </UserHoverCard>
                            ) : (
                                <span>unknown</span>
                            )}
                            <span>
                                {" "}
                                opened{" "}
                                <span
                                    title={new Date(
                                        issue.createdAt,
                                    ).toLocaleString()}
                                >
                                    {formatRelativeTime(issue.createdAt)}
                                </span>
                            </span>
                        </div>
                        {issue.comments > 0 && (
                            <a
                                aria-label={`${issue.comments} comments`}
                                href={`/${provider}/${owner}/${repo}/issues/${issue.number}`}
                                className="flex shrink-0 items-center gap-1 hover:text-link"
                            >
                                <MessageSquare className="size-3.5" />
                                <span>{issue.comments}</span>
                            </a>
                        )}
                    </div>
                </article>
            ))}
        </section>
    );
}
