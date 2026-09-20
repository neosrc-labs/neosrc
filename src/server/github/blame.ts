import { withStaleWhileRevalidate } from "~/server/cache";
import { createGraphql } from "~/server/github/graphql-client";
import {
    type GQLCommitAuthor,
    resolveCommitAuthor,
} from "~/server/github-graphql";

export interface BlameAuthor {
    /** GitHub login when the commit author maps to an account. */
    login: string | null;
    /** Author name recorded on the commit. */
    name: string | null;
    avatarUrl: string | null;
    /** Profile URL when the author maps to an account. */
    url: string | null;
}

export interface BlameCommit {
    /** Commit subject (messageHeadline). */
    message: string;
    committedDate: string | null;
    author: BlameAuthor | null;
}

export interface BlameRange {
    /** First line of the range (1-based). */
    startLine: number;
    /** Last line of the range (inclusive). */
    endLine: number;
    /** Recency the provider reports: 1 (newest) to 10 (oldest). */
    age: number;
    /** Key into `FileBlame.commits`. */
    sha: string;
}

export interface FileBlame {
    commits: Record<string, BlameCommit>;
    ranges: BlameRange[];
}

interface GqlBlameCommit {
    oid: string;
    messageHeadline: string;
    committedDate: string | null;
    authors: { nodes: (GQLCommitAuthor | null)[] };
}

interface GqlBlameRange {
    startingLine: number;
    endingLine: number;
    age: number;
    commit: GqlBlameCommit;
}

const FILE_BLAME_QUERY = `query FileBlame($owner: String!, $repo: String!, $expression: String!, $path: String!) {
  repository(owner: $owner, name: $repo) {
    object(expression: $expression) {
      ... on Commit { ...BlameFields }
      ... on Tag { target { ... on Commit { ...BlameFields } } }
    }
  }
}
fragment BlameFields on Commit {
  blame(path: $path) {
    ranges {
      startingLine
      endingLine
      age
      commit {
        oid
        messageHeadline
        committedDate
        authors(first: 1) {
          nodes { name email avatarUrl user { __typename login avatarUrl url } }
        }
      }
    }
  }
}`;

/**
 * Line-by-line authorship of `path` at `ref`, from GitHub's GraphQL blame.
 * Returns null when the ref is not a commit, or the path has no blame at that
 * ref (e.g. an untracked path or a provider that cannot blame it).
 */
export async function getFileBlame(
    accessToken: string,
    owner: string,
    repo: string,
    ref: string,
    path: string,
): Promise<FileBlame | null> {
    const graphql = createGraphql(accessToken);

    const result = await graphql<{
        repository?: {
            object?: {
                blame?: { ranges?: (GqlBlameRange | null)[] };
            } | null;
        } | null;
    }>(FILE_BLAME_QUERY, {
        owner,
        repo,
        expression: ref,
        path,
    });

    const blame = result.repository?.object?.blame;
    if (!blame) return null;

    const commits: Record<string, BlameCommit> = {};
    const ranges: BlameRange[] = [];

    for (const range of blame.ranges ?? []) {
        if (!range) continue;
        const node = range.commit;
        // GitHub repeats one commit across many ranges; build it once.
        if (!(node.oid in commits)) {
            const commitAuthor = node.authors.nodes[0];
            const author = commitAuthor
                ? resolveCommitAuthor(commitAuthor)
                : null;
            commits[node.oid] = {
                message: node.messageHeadline,
                committedDate: node.committedDate,
                author: author
                    ? {
                          login: author.user?.login ?? null,
                          name: author.name,
                          avatarUrl: author.avatarUrl,
                          url: author.user?.url ?? null,
                      }
                    : null,
            };
        }
        ranges.push({
            startLine: range.startingLine,
            endLine: range.endingLine,
            age: range.age,
            sha: node.oid,
        });
    }

    return { commits, ranges };
}

/** Cached {@link getFileBlame}. Blame moves with every commit, so it is stale
 * far sooner than file content. */
export async function getCachedFileBlame(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
    ref: string,
    path: string,
): Promise<FileBlame | null> {
    return withStaleWhileRevalidate(
        `file-blame:${userId}:${owner}:${repo}:${ref}:${path}`,
        () => getFileBlame(accessToken, owner, repo, ref, path),
        {
            staleAfter: 5 * 60 * 1000,
            deleteAfter: 24 * 60 * 60 * 1000,
        },
    );
}
