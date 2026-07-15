"use client";

import { User } from "lucide-react";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import type { GQLCommitAuthor } from "~/server/github-graphql";

const AVATAR_OVERLAP = 8;

function Avatar({
    author,
    size,
}: {
    author: {
        name: string | null;
        avatarUrl: string | null;
        login?: string | null;
    };
    size: number;
}) {
    return (
        <img
            alt={author.login ?? author.name ?? "Author"}
            className="shrink-0 rounded-full ring-2 ring-white dark:ring-zinc-950"
            src={author.avatarUrl ?? undefined}
            style={{ width: size, height: size }}
        />
    );
}

function PlaceholderAvatar({
    name,
    size,
}: {
    name: string | null;
    size: number;
}) {
    return (
        <div
            className="flex shrink-0 items-center justify-center rounded-full bg-gray-200 text-text-tertiary ring-2 ring-white dark:bg-zinc-700 dark:ring-zinc-950"
            style={{ width: size, height: size }}
            title={name ?? "Co-author"}
        >
            <User size={Math.round(size * 0.6)} />
        </div>
    );
}

interface CommitAuthorsProps {
    authors: (GQLCommitAuthor | null)[];
    size?: number;
}

export function CommitAuthors({ authors, size = 20 }: CommitAuthorsProps) {
    const nonNull = authors.filter((a): a is GQLCommitAuthor => a !== null);
    const visible = nonNull.slice(0, 2);
    const overflow = nonNull.slice(2).length;

    if (authors.length === 0) return null;

    return (
        <div
            className="flex"
            style={{
                width:
                    size +
                    Math.max(0, visible.length - 1) * (size - AVATAR_OVERLAP),
            }}
        >
            {visible.map((author, i) => {
                const avatar = (
                    <span className="flex">
                        {author.avatarUrl ? (
                            <Avatar author={author} size={size} />
                        ) : (
                            <PlaceholderAvatar name={author.name} size={size} />
                        )}
                    </span>
                );
                return (
                    <div
                        key={author.user?.login ?? author.name ?? i}
                        className="first:ml-0"
                        style={{
                            marginLeft: i === 0 ? 0 : -AVATAR_OVERLAP,
                            zIndex: visible.length - i,
                        }}
                    >
                        {author.user ? (
                            <UserHoverCard login={author.user.login}>
                                <a className="flex" href={author.user.url}>
                                    {avatar}
                                </a>
                            </UserHoverCard>
                        ) : (
                            avatar
                        )}
                    </div>
                );
            })}
            {overflow > 0 && (
                <div
                    className="ml-[-8px] flex shrink-0 items-center justify-center rounded-full bg-gray-100 font-medium text-text-tertiary text-xs ring-2 ring-white dark:bg-zinc-700 dark:ring-zinc-950"
                    style={{ width: size, height: size, zIndex: 0 }}
                >
                    +{overflow}
                </div>
            )}
        </div>
    );
}
