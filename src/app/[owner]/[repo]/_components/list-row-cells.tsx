import { MessageSquare } from "lucide-react";
import Image from "next/image";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { Label } from "~/components/ui/label";

export function ListRowLabels({
    labels,
    onLabelFilter,
}: {
    labels: Array<{
        id?: number;
        name: string;
        color: string;
        description?: string | null;
    }>;
    onLabelFilter?: (name: string) => void;
}) {
    if (labels.length === 0) return null;
    return (
        <div className="mt-1.5 flex flex-wrap gap-1">
            {[...labels]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((label) => (
                    <Label
                        key={label.id ?? label.name}
                        color={label.color}
                        description={label.description ?? undefined}
                        className="cursor-pointer"
                        onClick={() => onLabelFilter?.(label.name)}
                    >
                        {label.name}
                    </Label>
                ))}
        </div>
    );
}

export function ListRowMetaCells({
    assignee,
    commentsHref,
    commentsCount,
    provider,
    onAssigneesFilter,
}: {
    assignee: { login: string; avatar_url: string } | null;
    commentsHref: string;
    commentsCount: number;
    provider: "gh" | "cb";
    onAssigneesFilter?: (login: string) => void;
}) {
    return (
        <>
            <div className="flex w-20 shrink-0 items-center justify-center">
                {assignee ? (
                    <UserHoverCard login={assignee.login} provider={provider}>
                        <button
                            type="button"
                            onClick={() => {
                                const login = assignee?.login;
                                if (login) onAssigneesFilter?.(login);
                            }}
                            className="cursor-pointer rounded-full"
                        >
                            <Image
                                src={assignee.avatar_url}
                                alt={assignee.login}
                                className="size-5 rounded-full"
                                width={20}
                                height={20}
                            />
                        </button>
                    </UserHoverCard>
                ) : (
                    <span className="size-5" />
                )}
            </div>
            <div className="flex w-16 shrink-0 items-center justify-end">
                {commentsCount > 0 ? (
                    <a
                        href={commentsHref}
                        className="flex items-center gap-1 text-sm text-text-tertiary hover:text-blue-600 dark:hover:text-blue-400"
                    >
                        <MessageSquare className="size-4" />
                        <span>{commentsCount}</span>
                    </a>
                ) : (
                    <span className="size-4" />
                )}
            </div>
        </>
    );
}
