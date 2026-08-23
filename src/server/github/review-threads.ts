import { createGraphql, type GQLActor } from "~/server/github-graphql";
import { createOctokit } from "./client";
import { getPullRequest } from "./pulls";

type RawReviewThreadComment = {
    databaseId: number;
    body: string;
    author: GQLActor | null;
    createdAt: string;
    replyTo: { databaseId: number } | null;
};

type RawReviewThreadNode = {
    id: string;
    isResolved: boolean;
    isOutdated: boolean;
    path: string | null;
    resolvedBy: Pick<GQLActor, "login"> | null;
    comments: { nodes: (RawReviewThreadComment | null)[] };
};

export type ReviewThreadData = {
    id: string;
    isResolved: boolean;
    isOutdated: boolean;
    path: string | null;
    resolvedBy: string | null;
    pullRequestId: string;
    comments: Array<{
        id: number;
        body: string;
        author: {
            login: string;
            avatarUrl: string;
            url: string;
        } | null;
        createdAt: string;
        replyToId: number | null;
    }>;
};

type RawReviewThreadSummaryComment = {
    databaseId: number;
    body: string;
    author: GQLActor | null;
};

type RawReviewThreadSummaryNode = {
    id: string;
    isResolved: boolean;
    isOutdated: boolean;
    path: string | null;
    comments: {
        totalCount: number;
        nodes: (RawReviewThreadSummaryComment | null)[];
    };
};

export type ReviewThreadSummary = {
    id: string;
    isResolved: boolean;
    isOutdated: boolean;
    path: string | null;
    commentCount: number;
    root: {
        id: number;
        body: string;
        author: {
            login: string;
            avatarUrl: string;
        } | null;
    } | null;
};

export const getReviewThreads = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
): Promise<ReviewThreadData[]> => {
    const graphql = createGraphql(accessToken);

    const query = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      id
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          path
          resolvedBy {
            login
          }
          comments(first: 100) {
            nodes {
              databaseId
              body
              author {
                login
                avatarUrl
                url
              }
              createdAt
              replyTo {
                databaseId
              }
            }
          }
        }
      }
    }
  }
}`;

    const result = await graphql<{
        repository?: {
            pullRequest?: {
                id: string;
                reviewThreads?: {
                    nodes: (RawReviewThreadNode | null)[];
                };
            } | null;
        } | null;
    }>(query, { owner, repo, number: pullNumber });

    const threadNodes =
        result.repository?.pullRequest?.reviewThreads?.nodes ?? [];

    const pullRequestId = result.repository?.pullRequest?.id ?? "";

    return threadNodes
        .filter((thread): thread is RawReviewThreadNode => thread != null)
        .map((thread) => {
            const comments = (thread.comments?.nodes ?? [])
                .filter((c): c is RawReviewThreadComment => c != null)
                .map((c) => ({
                    id: c.databaseId,
                    body: c.body,
                    author: c.author,
                    createdAt: c.createdAt,
                    replyToId: c.replyTo?.databaseId ?? null,
                }));

            return {
                id: thread.id,
                isResolved: thread.isResolved,
                isOutdated: thread.isOutdated,
                path: thread.path,
                resolvedBy: thread.resolvedBy?.login ?? null,
                pullRequestId,
                comments,
            };
        });
};

export async function getReviewThreadsPage(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    perPage = 50,
    after?: string,
): Promise<{
    threads: ReviewThreadSummary[];
    hasNextPage: boolean;
    endCursor: string | null;
}> {
    const afterVar = after ? ", $after: String!" : "";
    const afterArg = after ? ", after: $after" : "";
    const graphql = createGraphql(accessToken);

    const query = `
query($owner: String!, $repo: String!, $number: Int!, $first: Int!${afterVar}) {
  repository(owner: $owner, name: $repo) {
    pullRequest(number: $number) {
      reviewThreads(first: $first${afterArg}) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          isResolved
          isOutdated
          path
          comments(first: 1) {
            totalCount
            nodes {
              databaseId
              body
              author {
                login
                avatarUrl
              }
            }
          }
        }
      }
    }
  }
}`;

    const result = await graphql<{
        repository?: {
            pullRequest?: {
                reviewThreads?: {
                    pageInfo: {
                        hasNextPage: boolean;
                        endCursor: string | null;
                    };
                    nodes: (RawReviewThreadSummaryNode | null)[];
                };
            } | null;
        } | null;
    }>(query, {
        owner,
        repo,
        number: pullNumber,
        first: perPage,
        ...(after ? { after } : {}),
    });

    const reviewThreads = result.repository?.pullRequest?.reviewThreads;
    const pageInfo = reviewThreads?.pageInfo ?? {
        hasNextPage: false,
        endCursor: null,
    };
    const threadNodes = reviewThreads?.nodes ?? [];

    const threads = threadNodes
        .filter(
            (thread): thread is RawReviewThreadSummaryNode => thread != null,
        )
        .map((thread) => {
            const rootNode =
                thread.comments?.nodes.find(
                    (c): c is RawReviewThreadSummaryComment => c != null,
                ) ?? null;

            return {
                id: thread.id,
                isResolved: thread.isResolved,
                isOutdated: thread.isOutdated,
                path: thread.path,
                commentCount: thread.comments?.totalCount ?? 0,
                root: rootNode
                    ? {
                          id: rootNode.databaseId,
                          body: rootNode.body,
                          author: rootNode.author
                              ? {
                                    login: rootNode.author.login,
                                    avatarUrl: rootNode.author.avatarUrl,
                                }
                              : null,
                      }
                    : null,
            };
        });

    return {
        threads,
        hasNextPage: pageInfo.hasNextPage ?? false,
        endCursor: pageInfo.endCursor ?? null,
    };
}

export const resolveReviewThread = async (
    accessToken: string,
    threadId: string,
): Promise<void> => {
    const graphql = createGraphql(accessToken);

    const query = `
mutation($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread {
      id
      isResolved
    }
  }
}`;

    await graphql<{
        resolveReviewThread: {
            thread: { id: string; isResolved: boolean };
        };
    }>(query, { threadId });
};

export const unresolveReviewThread = async (
    accessToken: string,
    threadId: string,
): Promise<void> => {
    const graphql = createGraphql(accessToken);

    const query = `
mutation($threadId: ID!) {
  unresolveReviewThread(input: { threadId: $threadId }) {
    thread {
      id
      isResolved
    }
  }
}`;

    await graphql<{
        unresolveReviewThread: {
            thread: { id: string; isResolved: boolean };
        };
    }>(query, { threadId });
};

const getFileContentFromBranch = async (
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
    ref: string,
): Promise<{ content: string; sha: string }> => {
    const octokit = createOctokit(accessToken);
    const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
    });

    if (Array.isArray(fileData) || !("content" in fileData)) {
        throw new Error(
            "Expected a single file, got a directory or unexpected response",
        );
    }

    if (fileData.encoding !== "base64") {
        throw new Error(
            `Cannot apply suggestion to ${path}: expected base64 content from the Contents API but got encoding "${fileData.encoding ?? "none"}"`,
        );
    }

    return {
        content: Buffer.from(fileData.content, "base64").toString("utf-8"),
        sha: fileData.sha,
    };
};

const detectDominantEol = (content: string): "\n" | "\r\n" => {
    const crlfCount = content.match(/\r\n/g)?.length ?? 0;
    const lfCount = (content.match(/\n/g)?.length ?? 0) - crlfCount;
    return crlfCount > lfCount ? "\r\n" : "\n";
};

/**
 * Resolve the 0-based line range a code suggestion targets and reject ranges
 * that fall outside the file. `line` is the last replaced line and is
 * required; `startLine` is the first replaced line (defaulting to `line`).
 */
const resolveSuggestionRange = (
    line: number | null | undefined,
    startLine: number | null | undefined,
    totalLines: number,
    path?: string,
): { replaceStart: number; replaceEnd: number } => {
    if (line == null) {
        throw new Error(
            `Cannot apply suggestion: line is required${path ? ` for ${path}` : ""} (file has ${totalLines} lines)`,
        );
    }

    const replaceStart = (startLine ?? line) - 1;
    const replaceEnd = line - 1;

    if (
        replaceStart < 0 ||
        replaceEnd < replaceStart ||
        replaceEnd >= totalLines
    ) {
        throw new Error(
            `Line range ${replaceStart + 1}-${replaceEnd + 1} is out of bounds${path ? ` for ${path}` : ""} (${totalLines} lines)`,
        );
    }

    return { replaceStart, replaceEnd };
};

/**
 * Compute the file content that results from applying a GitHub code
 * suggestion without touching the remote. The targeted range follows the same
 * semantics as `getSuggestionPatch` (startLine through line). A single
 * trailing newline on the suggestion is stripped so suggestion blocks (which
 * end with a newline) don't inject an empty line. The result is joined with
 * the file's dominant EOL, so a mixed-EOL file is normalized.
 */
export const buildSuggestionNewContent = (
    currentContent: string,
    suggestionCode: string,
    line: number | null | undefined,
    startLine: number | null | undefined,
    path?: string,
): string => {
    const allLines = currentContent.split(/\r?\n/);
    const { replaceStart, replaceEnd } = resolveSuggestionRange(
        line,
        startLine,
        allLines.length,
        path,
    );

    const suggestionLines = suggestionCode.replace(/\n$/, "").split("\n");

    return [
        ...allLines.slice(0, replaceStart),
        ...suggestionLines,
        ...allLines.slice(replaceEnd + 1),
    ].join(detectDominantEol(currentContent));
};

export const getSuggestionPatch = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    path: string,
    suggestionCode: string,
    line: number,
    startLine?: number | null,
    contextLines: number = 3,
): Promise<string> => {
    const pr = await getPullRequest(accessToken, owner, repo, pullNumber);
    const headRef = pr.head.ref;

    const { content: currentContent } = await getFileContentFromBranch(
        accessToken,
        owner,
        repo,
        path,
        headRef,
    );

    const allLines = currentContent.split(/\r?\n/);
    const { replaceStart, replaceEnd } = resolveSuggestionRange(
        line,
        startLine,
        allLines.length,
        path,
    );

    const contextStart = Math.max(0, replaceStart - contextLines);
    const contextEnd = Math.min(allLines.length - 1, replaceEnd + contextLines);

    const patchLines: string[] = [
        ...allLines.slice(contextStart, replaceStart).map((l) => ` ${l}`),
        ...allLines.slice(replaceStart, replaceEnd + 1).map((l) => `-${l}`),
    ];

    const suggestionLines = suggestionCode.replace(/\n$/, "").split("\n");
    for (const l of suggestionLines) {
        patchLines.push(`+${l}`);
    }

    patchLines.push(
        ...allLines.slice(replaceEnd + 1, contextEnd + 1).map((l) => ` ${l}`),
    );

    const contextCount =
        replaceStart - contextStart + (contextEnd - replaceEnd);
    const removedCount = replaceEnd - replaceStart + 1;
    const addedCount = suggestionLines.length;

    const oldStart = contextStart + 1;
    const newStart = contextStart + 1;
    const oldCount = contextCount + removedCount;
    const newCount = contextCount + addedCount;

    return `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@\n${patchLines.join("\n")}`;
};

export const applySuggestion = async (
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    path: string,
    suggestionCode: string,
    line?: number | null,
    startLine?: number | null,
): Promise<void> => {
    const octokit = createOctokit(accessToken);

    const pr = await getPullRequest(accessToken, owner, repo, pullNumber);
    const headRef = pr.head.ref;

    const { content: currentContent, sha: fileSha } =
        await getFileContentFromBranch(accessToken, owner, repo, path, headRef);

    const newContent = buildSuggestionNewContent(
        currentContent,
        suggestionCode,
        line,
        startLine,
        path,
    );

    const base64Content = Buffer.from(newContent, "utf-8").toString("base64");

    await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message: `Apply suggestion to ${path}`,
        content: base64Content,
        sha: fileSha,
        branch: headRef,
    });
};
