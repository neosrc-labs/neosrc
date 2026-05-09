"use client";

import {
	Building2,
	CalendarDays,
	Link as LinkIcon,
	MapPin,
} from "lucide-react";
import type { ReactNode } from "react";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "~/components/ui/hover-card";
import type { UsersGetByUsernameResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { formatRelativeTime } from "~/utils";

function UserHoverCardContent({ login }: { login: string }) {
	const { data, isLoading } = api.users.getByUsername.useQuery(
		{ username: login },
		{ staleTime: 5 * 60 * 1000 },
	);

	if (isLoading) {
		return (
			<div className="flex items-start gap-3 p-4">
				<div className="h-16 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-zinc-700" />
				<div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-zinc-700" />
			</div>
		);
	}

	const user = data?.user as UsersGetByUsernameResponseData | undefined;
	if (!user) return null;

	return (
		<div>
			<div className="flex items-start gap-4 border-gray-200 border-b p-4 dark:border-zinc-800">
				<img
					alt={user.login}
					className="h-16 w-16 rounded-full"
					src={user.avatar_url}
				/>
				<div className="min-w-0">
					<div className="flex flex-wrap items-baseline gap-x-2">
						{user.name && (
							<span className="font-semibold text-base text-gray-900 dark:text-gray-100">
								{user.name}
							</span>
						)}
						<span className="text-gray-500 text-sm dark:text-gray-400">
							{user.login}
						</span>
					</div>
					{user.bio && (
						<p className="mt-1 text-gray-600 text-xs leading-relaxed dark:text-gray-400">
							{user.bio}
						</p>
					)}
				</div>
			</div>
			<div className="flex flex-col gap-1.5 p-4 pt-3">
				{user.company && (
					<div className="flex items-center gap-2 text-gray-600 text-xs dark:text-gray-400">
						<Building2 className="h-3.5 w-3.5 shrink-0" />
						<span>{user.company}</span>
					</div>
				)}
				{user.location && (
					<div className="flex items-center gap-2 text-gray-600 text-xs dark:text-gray-400">
						<MapPin className="h-3.5 w-3.5 shrink-0" />
						<span>{user.location}</span>
					</div>
				)}
				{user.blog && (
					<div className="flex items-center gap-2 text-gray-600 text-xs dark:text-gray-400">
						<LinkIcon className="h-3.5 w-3.5 shrink-0" />
						<a
							className="truncate text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400"
							href={
								user.blog.startsWith("http")
									? user.blog
									: `https://${user.blog}`
							}
							rel="noreferrer"
							target="_blank"
						>
							{user.blog.replace(/^https?:\/\//, "")}
						</a>
					</div>
				)}
				{user.twitter_username && (
					<div className="flex items-center gap-2 text-gray-600 text-xs dark:text-gray-400">
						<svg
							aria-label="Twitter"
							className="h-3.5 w-3.5 shrink-0"
							fill="currentColor"
							viewBox="0 0 24 24"
						>
							<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
						</svg>
						<span>@{user.twitter_username}</span>
					</div>
				)}
				{user.created_at && (
					<div className="flex items-center gap-2 text-gray-600 text-xs dark:text-gray-400">
						<CalendarDays className="h-3.5 w-3.5 shrink-0" />
						<span>Joined {formatRelativeTime(user.created_at)}</span>
					</div>
				)}
				<div className="mt-0.5 flex items-center gap-3 text-gray-600 text-xs dark:text-gray-400">
					<span>
						<strong className="font-semibold text-gray-900 dark:text-gray-100">
							{user.followers}
						</strong>{" "}
						followers
					</span>
					<span>
						<strong className="font-semibold text-gray-900 dark:text-gray-100">
							{user.following}
						</strong>{" "}
						following
					</span>
				</div>
			</div>
		</div>
	);
}

interface UserHoverCardProps {
	login: string;
	children: ReactNode;
}

export function UserHoverCard({ login, children }: UserHoverCardProps) {
	return (
		<HoverCard>
			<HoverCardTrigger asChild>{children}</HoverCardTrigger>
			<HoverCardContent className="w-80 bg-white p-0 dark:bg-zinc-950">
				<UserHoverCardContent login={login} />
			</HoverCardContent>
		</HoverCard>
	);
}
