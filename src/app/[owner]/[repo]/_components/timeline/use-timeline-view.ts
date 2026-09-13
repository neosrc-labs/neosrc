import { useRouter, useSearchParams } from "next/navigation";
import { type RefObject, useEffect, useMemo, useRef } from "react";
import type { GQLReactionNode } from "~/server/github-graphql";

/**
 * Merges per-page comment reaction maps from an infinite timeline query
 * into a single lookup keyed by `comment:<id>` / `review:<id>`.
 */
export function useMergedCommentReactions(
    data:
        | {
              pages: {
                  commentReactions: Record<string, GQLReactionNode[]>;
              }[];
          }
        | undefined,
): Record<string, GQLReactionNode[]> {
    return useMemo(
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
                {},
            ) ?? {},
        [data],
    );
}

/**
 * Scrolls to the timeline end when `?scrollTo=bottom` is present, then
 * drops the param via `basePath` so refreshes stay put.
 */
export function useTimelineBottomScroll(
    data: unknown,
    basePath: string,
): RefObject<HTMLDivElement | null> {
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
                `${basePath}${newParams ? `?${newParams}` : ""}`,
                { scroll: false },
            );
        }, 100);

        return () => clearTimeout(timer);
    }, [searchParams, data, basePath, timelineRouter]);

    return timelineEndRef;
}

/**
 * Deep-links to `#issuecomment-<id>` timeline anchors: scrolls the target
 * into view on load and hash changes, with follow-up adjustments while
 * images and markdown settle.
 */
export function useTimelineHashScroll(data: unknown): void {
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
}
