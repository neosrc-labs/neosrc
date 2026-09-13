"use client";

import { useEffect, useMemo } from "react";
import { api } from "~/trpc/react";
import { CommentForm } from "../../../pull/[number]/_components/comment-form";
import { TimelineEventList } from "../../../pull/[number]/_components/timeline/event";
import { TimelineSkeleton } from "../../../pull/[number]/_components/timeline/section";
import {
    useMergedCommentReactions,
    useTimelineBottomScroll,
    useTimelineHashScroll,
} from "../../../pull/[number]/_components/timeline/use-timeline-view";
import {
    aggregateEvents,
    filterTimelineEvents,
} from "../../../pull/[number]/_components/timeline/utils";
import {
    canEdit,
    type PullRequestPermissionContext,
} from "../../../pull/[number]/permissions-utils";

export { TimelineSkeleton };

interface IssueTimelineSectionProps {
    owner: string;
    repo: string;
    number: number;
    permissionContext: PullRequestPermissionContext;
    issueState: "open" | "closed";
}

export function IssueTimelineSection({
    owner,
    repo,
    number,
    permissionContext,
    issueState,
}: IssueTimelineSectionProps) {
    const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
        api.issues.timeline.useInfiniteQuery(
            { owner, repo, issueNumber: number, limit: 100 },
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
        `/gh/${owner}/${repo}/issues/${number}`,
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
                    number={number}
                    owner={owner}
                    repo={repo}
                />
            </div>
        </div>
    );
}
