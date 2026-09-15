import type { RouterOutputs } from "~/trpc/react";

type ContentsData = RouterOutputs["repos"]["getContents"];
type FileCommitsData = RouterOutputs["repos"]["getFileLatestCommits"];
type PathCommitsData = RouterOutputs["repos"]["getPathCommits"];
type FileContentData = RouterOutputs["repos"]["getFileContent"];

/**
 * Last value a browse query rendered, kept per query family. Next remounts a
 * route's page on every navigation, so react-query cannot carry data from one
 * page to the next; a module-level slot can, which is what lets the new page
 * show the previous listing dimmed while its own request is in flight.
 */
function createPreviousValue<T>() {
    let last: { key: string; value: T } | null = null;

    return {
        /** The last value of another key, if there is one. */
        previous(key: string): T | undefined {
            return last !== null && last.key !== key ? last.value : undefined;
        },
        /** Records the value rendered for `key`. */
        remember(key: string, value: T): void {
            last = { key, value };
        },
    };
}

export const contentsPrevious = createPreviousValue<ContentsData>();
export const fileCommitsPrevious = createPreviousValue<FileCommitsData>();
export const pathCommitsPrevious = createPreviousValue<PathCommitsData>();
export const fileContentPrevious = createPreviousValue<FileContentData>();
