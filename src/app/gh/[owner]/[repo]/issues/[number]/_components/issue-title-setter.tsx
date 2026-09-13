"use client";

import { useEffect } from "react";
import type { IssueGetResponseData } from "~/server/github";

export function IssueTitleSetter({
    owner,
    repo,
    number,
    issuePromise,
}: {
    owner: string;
    repo: string;
    number: number;
    issuePromise: Promise<IssueGetResponseData>;
}) {
    // biome-ignore lint/correctness/useExhaustiveDependencies: promise is stable across renders
    useEffect(() => {
        issuePromise.then((issue) => {
            document.title = `${issue.title} - ${owner}/${repo} #${number}`;
        });
    }, []);
    return null;
}
