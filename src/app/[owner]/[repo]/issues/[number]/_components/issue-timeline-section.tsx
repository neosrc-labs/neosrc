"use client";

import { useEffect, useMemo } from "react";
import { CommentForm } from "~/app/[owner]/[repo]/_components/comment-form";
import {
    canEdit,
    type PullRequestPermissionContext,
} from "~/app/[owner]/[repo]/_components/permissions-utils";
import { TimelineEventList } from "~/app/[owner]/[repo]/_components/timeline/event";
import { TimelineSkeleton } from "~/app/[owner]/[repo]/_components/timeline/section";
import {
    useMergedCommentReactions,
    useTimelineBottomScroll,
    useTimelineHashScroll,
} from "~/app/[owner]/[repo]/_components/timeline/use-timeline-view";
import {
    aggregateEvents,
    filterTimelineEvents,
} from "~/app/[owner]/[repo]/_components/timeline/utils";
import { TIMELINE_PAGE_SIZE } from "~/lib/timeline-constants";
import { api } from "~/trpc/react";
import type { Provider } from "~/utils/provider-url";

export { TimelineSkeleton };

interface IssueTimelineSectionProps {
    provider: Provider;
    owner: string;
    repo: string;
    number: number;
    permissionContext: PullRequestPermissionContext;
    issueState: "open" | "closed";
}

export function IssueTimelineSection({
    provider,
    owner,
    repo,
    number,
    permissionContext,
    issueState,
}: IssueTimelineSectionProps) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        api.issues.timeline.useInfiniteQuery(
            {
                provider,
                owner,
                repo,
                issueNumber: number,
                limit: TIMELINE_PAGE_SIZE,
            },
            {
                getNextPageParam: (lastPage) => lastPage.nextCursor,
            },
        );

    useEffect(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    const allEvents = useMemo(
        () => data?.pages.flatMap((page) => page.events) ?? [],
        [data],
    );
    const allCommentReactions = useMergedCommentReactions(data);

    const timelineEndRef = useTimelineBottomScroll(
        data,
        `/${provider}/${owner}/${repo}/issues/${number}`,
    );
    useTimelineHashScroll(data);

    if (isLoading) {
        return (
            <div className="mt-5">
                <TimelineSkeleton />
            </div>
        );
    }

    const filteredEvents = filterTimelineEvents(allEvents);
    const wrappers = aggregateEvents(filteredEvents);

    return (
        <div className="mt-5">
            <TimelineEventList
                wrappers={wrappers}
                provider={provider}
                number={number}
                owner={owner}
                repo={repo}
                commentReactions={allCommentReactions}
                allComments={[]}
                permissionContext={permissionContext}
                issueNumber={number}
                isFetchingNextPage={isFetchingNextPage}
            />

            <div ref={timelineEndRef}>
                <CommentForm
                    canClose={
                        issueState === "open" && canEdit(permissionContext)
                    }
                    canReopen={
                        issueState === "closed" && canEdit(permissionContext)
                    }
                    permissionContext={permissionContext}
                    kind="issue"
                    provider={provider}
                    number={number}
                    owner={owner}
                    repo={repo}
                />
            </div>
        </div>
    );
}
