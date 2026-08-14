import { Circle, CircleCheck } from "lucide-react";
import {
    ListRowLabels,
    ListRowMetaCells,
} from "~/app/[owner]/[repo]/_components/list-row-cells";
import { CodeTitle } from "~/components/markdown/code-title";
import { UserLink } from "~/components/user-link";
import { formatRelativeTime } from "~/utils";

export interface IssueRowData {
    number: number;
    title: string;
    state: string;
    user: { login: string; avatar_url: string } | null;
    assignee: { login: string; avatar_url: string } | null;
    labels: Array<{
        name: string;
        color: string;
        description?: string | null;
    }>;
    created_at: string;
    closed_at: string | null;
    comments_count: number;
}

export function IssueRow({
    issue,
    provider = "gh",
    owner,
    repo,
    onAssigneesFilter,
    onAuthorFilter,
    onLabelFilter,
}: {
    issue: IssueRowData;
    provider?: "gh" | "cb";
    owner: string;
    repo: string;
    onAssigneesFilter?: (login: string) => void;
    onAuthorFilter?: (login: string) => void;
    onLabelFilter?: (name: string) => void;
}) {
    return (
        <div className="flex items-start gap-3 border-border-subtle border-b px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-900/50">
            <div className="mt-0.5 shrink-0">
                {issue.state === "open" ? (
                    <CircleCheck className="size-4 text-state-open" />
                ) : (
                    <Circle className="size-4 text-state-closed" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <a
                        href={`https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}/${repo}/issues/${issue.number}`}
                        className="font-medium text-text-primary hover:text-blue-600 dark:hover:text-blue-400"
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
                <div className="mt-1 flex items-center gap-1 text-sm text-text-secondary">
                    <span>#{issue.number} opened </span>
                    <span title={new Date(issue.created_at).toLocaleString()}>
                        {formatRelativeTime(issue.created_at)}
                    </span>
                    {issue.user ? (
                        <span className="flex items-center gap-1">
                            by{" "}
                            <UserLink
                                provider={provider}
                                actor={{
                                    login: issue.user.login,
                                    avatarUrl: issue.user.avatar_url,
                                }}
                                onClick={() => {
                                    const login = issue.user?.login;
                                    if (login) onAuthorFilter?.(login);
                                }}
                            />
                        </span>
                    ) : (
                        <span>by unknown</span>
                    )}
                </div>
                <ListRowLabels
                    labels={issue.labels}
                    onLabelFilter={onLabelFilter}
                />
            </div>
            <ListRowMetaCells
                assignee={issue.assignee}
                commentsHref={`https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}/${repo}/issues/${issue.number}`}
                commentsCount={issue.comments_count}
                provider={provider}
                onAssigneesFilter={onAssigneesFilter}
            />
        </div>
    );
}
