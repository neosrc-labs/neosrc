"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef } from "react";
import type { GQLReactionNode } from "~/server/github-graphql";
import { api } from "~/trpc/react";
import { TimelineEvent } from "../../../pull/[number]/_components/timeline/event";
import { TimelineSkeleton } from "../../../pull/[number]/_components/timeline/section";
import {
    aggregateEvents,
    filterTimelineEvents,
} from "../../../pull/[number]/_components/timeline/utils";
import {
    canEdit,
    canInteract,
    type PullRequestPermissionContext,
} from "../../../pull/[number]/permissions-utils";
import { IssueCommentForm } from "./issue-comment-form";

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
    const allCommentReactions = useMemo(
        () =>
            data?.pages.reduce<Record<string, GQLReactionNode[]>>(
                (acc, page) => {
                    for (const [id, reactions] of Object.entries(
                        page.commentReactions,
                    )) {
                        acc[id] = reactions;
                    }
                    return acc;
                },
                {} as Record<string, GQLReactionNode[]>,
            ) ?? {},
        [data],
    );

    const searchParams = useSearchParams();
    const timelineRouter = useRouter();
    const timelineEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (searchParams.get("scrollTo") !== "bottom") return;
        if (!data) return;

        const timer = setTimeout(() => {
            timelineEndRef.current?.scrollIntoView({ behavior: "smooth" });
            const params = new URLSearchParams(searchParams.toString());
            params.delete("scrollTo");
            const newParams = params.toString();
            timelineRouter.replace(
                `/gh/${owner}/${repo}/issues/${number}${newParams ? `?${newParams}` : ""}`,
                { scroll: false },
            );
        }, 100);

        return () => clearTimeout(timer);
    }, [searchParams, data, owner, repo, number, timelineRouter]);

    const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
        null,
    );
    const adjustIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
        null,
    );
    const handledHashRef = useRef<string | null>(null);

    useEffect(() => {
        if (!data) return;

        const scrollToHash = () => {
            const hash = window.location.hash;
            if (!hash) return;
            const targetId = hash.slice(1);
            if (!/^(issuecomment|pullrequestreview)-\d+$/.test(targetId)) {
                return;
            }

            if (handledHashRef.current === targetId) return;
            handledHashRef.current = targetId;

            if (adjustIntervalRef.current) {
                clearInterval(adjustIntervalRef.current);
                adjustIntervalRef.current = null;
            }

            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
            }

            scrollIntervalRef.current = setInterval(() => {
                const el = document.getElementById(targetId);
                if (el) {
                    if (scrollIntervalRef.current) {
                        clearInterval(scrollIntervalRef.current);
                        scrollIntervalRef.current = null;
                    }
                    el.classList.add("comment-highlight");

                    const scrollToTarget = () => {
                        const rect = el.getBoundingClientRect();
                        window.scrollTo({
                            top:
                                rect.top +
                                window.scrollY -
                                window.innerHeight * 0.3,
                        });
                    };

                    requestAnimationFrame(() => {
                        requestAnimationFrame(scrollToTarget);
                    });

                    let adjustCount = 0;
                    adjustIntervalRef.current = setInterval(() => {
                        const rect = el.getBoundingClientRect();
                        const drift = rect.top - window.innerHeight * 0.3;
                        if (Math.abs(drift) > 30) {
                            window.scrollBy({
                                top: drift,
                            });
                        }
                        adjustCount++;
                        if (adjustCount >= 15) {
                            if (adjustIntervalRef.current) {
                                clearInterval(adjustIntervalRef.current);
                                adjustIntervalRef.current = null;
                            }
                        }
                    }, 300);
                }
            }, 200);
        };

        scrollToHash();
        window.addEventListener("hashchange", scrollToHash);
        return () => {
            window.removeEventListener("hashchange", scrollToHash);
            if (scrollIntervalRef.current) {
                clearInterval(scrollIntervalRef.current);
                scrollIntervalRef.current = null;
            }
            if (adjustIntervalRef.current) {
                clearInterval(adjustIntervalRef.current);
                adjustIntervalRef.current = null;
            }
        };
    }, [data]);

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
            {wrappers.length === 0 && (
                <p className="text-sm text-text-tertiary">
                    No timeline events yet.
                </p>
            )}

            <div className="relative">
                <div className="absolute top-0 bottom-0 left-6 w-px bg-surface-selected" />

                {wrappers.map((wrapper) => (
                    <TimelineEvent
                        key={
                            wrapper.type === "raw"
                                ? `raw-${wrapper.event.id}`
                                : `label-${wrapper.createdAt}`
                        }
                        wrapper={wrapper}
                        number={number}
                        owner={owner}
                        repo={repo}
                        commentReactions={allCommentReactions}
                        allComments={[]}
                        permissionContext={permissionContext}
                        issueNumber={number}
                    />
                ))}
            </div>

            {isFetchingNextPage && (
                <div className="py-4 text-center">
                    <p className="text-sm text-text-tertiary">
                        Loading more...
                    </p>
                </div>
            )}

            <div ref={timelineEndRef}>
                <IssueCommentForm
                    canClose={
                        issueState === "open" && canEdit(permissionContext)
                    }
                    canReopen={
                        issueState === "closed" && canEdit(permissionContext)
                    }
                    disabled={!canInteract(permissionContext)}
                    number={number}
                    owner={owner}
                    repo={repo}
                />
            </div>
        </div>
    );
}
