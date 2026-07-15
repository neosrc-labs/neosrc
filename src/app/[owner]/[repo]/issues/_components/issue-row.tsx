import { Circle, CircleCheck, MessageSquare } from "lucide-react";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { CodeTitle } from "~/components/markdown/code-title";
import { Label } from "~/components/ui/label";
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
        <div className="flex items-start gap-3 border-gray-200 border-b px-4 py-3 transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50">
            <div className="mt-0.5 shrink-0">
                {issue.state === "open" ? (
                    <CircleCheck className="size-4 text-green-600 dark:text-green-500" />
                ) : (
                    <Circle className="size-4 text-red-600 dark:text-red-500" />
                )}
            </div>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <a
                        href={`https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}/${repo}/issues/${issue.number}`}
                        className="font-medium text-gray-900 hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
                    >
                        <CodeTitle>{issue.title}</CodeTitle>
                    </a>
                </div>
                <div className="mt-1 flex items-center gap-1 text-gray-600 text-sm dark:text-zinc-400">
                    <span>#{issue.number} opened </span>
                    <span title={new Date(issue.created_at).toLocaleString()}>
                        {formatRelativeTime(issue.created_at)}
                    </span>
                    {issue.user ? (
                        <span className="flex items-center gap-1">
                            by{" "}
                            <UserLink
                                actor={{
                                    login: issue.user.login,
                                    avatarUrl: issue.user.avatar_url,
                                }}
                                onClick={() => {
                                    // biome-ignore lint/style/noNonNullAssertion: guarded by enclosing conditional
                                    onAuthorFilter?.(issue.user!.login);
                                }}
                            />
                        </span>
                    ) : (
                        <span>by unknown</span>
                    )}
                </div>
                {issue.labels && issue.labels.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                        {[...issue.labels]
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map((label) => (
                                <Label
                                    key={label.name}
                                    color={label.color}
                                    description={label.description ?? undefined}
                                    className="cursor-pointer"
                                    onClick={() => onLabelFilter?.(label.name)}
                                >
                                    {label.name}
                                </Label>
                            ))}
                    </div>
                )}
            </div>
            <div className="flex w-20 shrink-0 items-center justify-center">
                {issue.assignee ? (
                    <UserHoverCard login={issue.assignee.login}>
                        <button
                            type="button"
                            onClick={() => {
                                // biome-ignore lint/style/noNonNullAssertion: guarded by enclosing conditional
                                const login = issue.assignee!.login;
                                onAssigneesFilter?.(login);
                            }}
                            className="cursor-pointer rounded-full"
                        >
                            <img
                                src={issue.assignee.avatar_url}
                                alt={issue.assignee.login}
                                className="size-5 rounded-full"
                            />
                        </button>
                    </UserHoverCard>
                ) : (
                    <span className="size-5" />
                )}
            </div>
            <div className="flex w-16 shrink-0 items-center justify-end">
                {issue.comments_count > 0 ? (
                    <a
                        href={`https://${provider === "cb" ? "codeberg.org" : "github.com"}/${owner}/${repo}/issues/${issue.number}`}
                        className="flex items-center gap-1 text-gray-500 text-sm hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400"
                    >
                        <MessageSquare className="size-4" />
                        <span>{issue.comments_count}</span>
                    </a>
                ) : (
                    <span className="size-4" />
                )}
            </div>
        </div>
    );
}
