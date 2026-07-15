"use client";

import { Building2, Globe, Lock, Users } from "lucide-react";
import type { ReactNode } from "react";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
import type { TeamGetByNameResponseData } from "~/server/github";
import { api } from "~/trpc/react";

interface TeamHoverCardProps {
    org: string;
    teamSlug: string;
    children: ReactNode;
}

export function TeamHoverCard({ org, teamSlug, children }: TeamHoverCardProps) {
    const { data, isLoading } = api.users.getByTeamSlug.useQuery(
        { org, teamSlug },
        { staleTime: 5 * 60 * 1000 },
    );

    const team = data?.team as TeamGetByNameResponseData | undefined;

    if (isLoading || !team) return <>{children}</>;

    return (
        <HoverCard>
            <HoverCardTrigger asChild>{children}</HoverCardTrigger>
            <HoverCardContent className="w-80 bg-white p-0 dark:bg-zinc-950">
                <div>
                    <div className="flex items-start gap-4 border-gray-200 border-b p-4 dark:border-zinc-800">
                        <img
                            alt={team.organization.login}
                            className="h-16 w-16 rounded-full"
                            src={team.organization.avatar_url}
                        />
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                                <span className="font-semibold text-base text-text-primary">
                                    {team.name}
                                </span>
                                <span className="text-sm text-text-tertiary">
                                    @{org}/{team.slug}
                                </span>
                            </div>
                            {team.description && (
                                <p className="mt-1 text-text-secondary text-xs leading-relaxed">
                                    {team.description}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5 p-4 pt-3">
                        {team.privacy && (
                            <div className="flex items-center gap-2 text-text-secondary text-xs">
                                {team.privacy === "closed" ? (
                                    <Lock className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                    <Globe className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span className="capitalize">
                                    {team.privacy}
                                </span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-text-secondary text-xs">
                            <Users className="h-3.5 w-3.5 shrink-0" />
                            <span>
                                <strong className="font-semibold text-text-primary">
                                    {team.members_count}
                                </strong>{" "}
                                members
                            </span>
                        </div>
                        {team.repos_count > 0 && (
                            <div className="flex items-center gap-2 text-text-secondary text-xs">
                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                <span>
                                    <strong className="font-semibold text-text-primary">
                                        {team.repos_count}
                                    </strong>{" "}
                                    repositories
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </HoverCardContent>
        </HoverCard>
    );
}
