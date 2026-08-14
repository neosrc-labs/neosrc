import type { PullsGetResponseData } from "~/server/github";
import { getConflictedFiles } from "~/server/github";

export function SignedOutNotice() {
    return (
        <div className="px-6 py-8">
            <p className="text-text-secondary">
                Please sign in to view this pull request.
            </p>
        </div>
    );
}

export function buildConflictedFilesPromise(
    accessToken: string,
    owner: string,
    repo: string,
    prPromise: Promise<PullsGetResponseData>,
): Promise<string[]> {
    return prPromise.then(async (pr) => {
        if (pr.mergeable_state === "dirty") {
            return getConflictedFiles(
                accessToken,
                owner,
                repo,
                pr.base.sha,
                pr.head.sha,
            );
        }
        return [];
    });
}
