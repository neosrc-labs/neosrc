"use client";

import Image from "next/image";
import NextLink from "next/link";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";

export function AuthorLabel({
    username,
    profileUrl,
    avatarUrl,
}: {
    username: string;
    profileUrl: string;
    avatarUrl: string;
}) {
    return (
        <UserHoverCard login={username}>
            <NextLink className="flex items-center gap-2" href={profileUrl}>
                {avatarUrl ? (
                    <Image
                        alt={username}
                        className="h-5 w-5 rounded-full"
                        src={avatarUrl}
                        width={20}
                        height={20}
                    />
                ) : null}
                {username}{" "}
            </NextLink>
        </UserHoverCard>
    );
}
