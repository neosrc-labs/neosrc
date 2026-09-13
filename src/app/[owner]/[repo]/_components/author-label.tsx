"use client";

import Image from "next/image";
import NextLink from "next/link";
import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import type { Provider } from "~/utils/provider-url";

export function AuthorLabel({
    username,
    profileUrl,
    avatarUrl,
    provider = "gh",
}: {
    username: string;
    profileUrl: string;
    avatarUrl: string;
    provider?: Provider;
}) {
    return (
        <UserHoverCard login={username} provider={provider}>
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
