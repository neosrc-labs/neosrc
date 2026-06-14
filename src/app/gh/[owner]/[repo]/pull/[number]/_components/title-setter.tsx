"use client";

import { useEffect } from "react";
import type { PullsGetResponseData } from "~/server/github";

export function PullRequestTitleSetter({
    pullRequestPromise,
}: {
    pullRequestPromise: Promise<PullsGetResponseData>;
}) {
    useEffect(() => {
        pullRequestPromise.then((pr) => {
            document.title = `${pr.title} - ${pr.base.repo.full_name} #${pr.number}`;
        });
    }, [pullRequestPromise]);
    return null;
}
