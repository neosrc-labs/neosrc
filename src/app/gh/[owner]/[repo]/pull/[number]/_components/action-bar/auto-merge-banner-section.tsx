"use client";

import { Async } from "~/components/async";
import type { PullsGetResponseData } from "~/server/github";
import { AutoMergeBanner } from "./auto-merge-banner";

interface AutoMergeBannerSectionProps {
    pullRequestPromise: Promise<PullsGetResponseData>;
}

export function AutoMergeBannerSection({
    pullRequestPromise,
}: AutoMergeBannerSectionProps) {
    return (
        <Async fallback={null} promise={pullRequestPromise}>
            {(pullRequest) => {
                const hasAutoMerge = (() => {
                    if (!("auto_merge" in pullRequest)) return false;
                    const val = (
                        pullRequest as PullsGetResponseData & {
                            auto_merge: unknown;
                        }
                    ).auto_merge;
                    return (
                        !!val &&
                        typeof val === "object" &&
                        "merge_method" in (val as Record<string, unknown>)
                    );
                })();
                if (!hasAutoMerge) return null;
                if (
                    pullRequest.merged ||
                    pullRequest.state !== "open" ||
                    pullRequest.draft
                )
                    return null;
                return (
                    <div className="mb-3">
                        <AutoMergeBanner pullRequest={pullRequest} />
                    </div>
                );
            }}
        </Async>
    );
}
