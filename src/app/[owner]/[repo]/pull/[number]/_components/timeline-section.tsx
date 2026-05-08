"use client";

import { useInView } from "react-intersection-observer";
import { api } from "~/trpc/react";
import { CommentForm } from "./comment-form";
import { TimelineEvent } from "./timeline-event";

interface TimelineSectionProps {
	owner: string;
	repo: string;
	number: number;
}

export function TimelineSection({ owner, repo, number }: TimelineSectionProps) {
	const { ref, inView } = useInView();

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		api.timeline.list.useInfiniteQuery(
			{ owner, repo, number, limit: 30 },
			{
				getNextPageParam: (lastPage) => lastPage.nextCursor,
			},
		);

	if (inView && hasNextPage && !isFetchingNextPage) {
		fetchNextPage();
	}

	if (isLoading) {
		return (
			<div className="py-4 text-gray-500 text-sm dark:text-gray-400">
				Loading timeline...
			</div>
		);
	}

	const allEvents = data?.pages.flatMap((page) => page.events) ?? [];
	const filteredEvents = allEvents.filter((event) => {
		if (["mentioned", "subscribed"].includes(event.event)) {
			return false;
		}
		return true;
	});

	console.log({ filteredEvents });

	return (
		<div className="mt-4 border-gray-200 border-t pt-6 dark:border-gray-700">
			<h2 className="mb-4 font-semibold text-gray-900 text-lg dark:text-gray-100">
				Timeline
			</h2>

			{filteredEvents.length === 0 && (
				<p className="text-gray-500 text-sm dark:text-gray-400">
					No timeline events yet.
				</p>
			)}

			<div className="relative">
				<div className="absolute top-0 bottom-0 left-6 w-px bg-gray-200 dark:bg-gray-700" />

				{filteredEvents.map((event, index) => (
					<TimelineEvent
						event={event}
						key={`${event.id}-${index}`}
						owner={owner}
						repo={repo}
					/>
				))}
			</div>

			<CommentForm number={number} owner={owner} repo={repo} />

			<div className="py-4 text-center" ref={ref}>
				{isFetchingNextPage && (
					<p className="text-gray-500 text-sm dark:text-gray-400">
						Loading more...
					</p>
				)}
				{!hasNextPage && filteredEvents.length > 0 && (
					<p className="text-gray-400 text-sm dark:text-gray-500">
						No more events
					</p>
				)}
			</div>
		</div>
	);
}
