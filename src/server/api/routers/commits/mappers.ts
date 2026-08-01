import type { StatusContext } from "~/components/ci-status";
import type { CodebergCommitRaw } from "~/server/codeberg";
import type { BranchCommitsResult } from "~/server/github-graphql";
import type { CommitListItem } from "./types";

type GQLCheckNode = {
    __typename?: string;
    state?: string;
    targetUrl?: string | null;
    description?: string | null;
    context?: string;
    name?: string;
    status?: string;
    conclusion?: string | null;
    detailsUrl?: string | null;
    createdAt?: string;
    startedAt?: string;
    completedAt?: string;
};

function isCheckRunNode(
    node: NonNullable<GQLCheckNode>,
): node is GQLCheckNode & { name: string } {
    return "name" in node && typeof node.name === "string";
}

export function mapGQLCommit(
    c: BranchCommitsResult["commits"][number],
): CommitListItem {
    const authorNode = c.authors[0];
    const author = authorNode?.user
        ? { login: authorNode.user.login, avatarUrl: authorNode.user.avatarUrl }
        : null;

    const statusContexts: StatusContext[] = (
        c.statusCheckRollup?.contexts?.nodes ?? []
    ).reduce<StatusContext[]>((acc, node) => {
        if (!node) return acc;
        if (isCheckRunNode(node)) {
            const state = node.conclusion || node.status || "PENDING";
            acc.push({
                name: node.name,
                state,
                description: null,
                url: node.detailsUrl ?? null,
                startedAt: node.startedAt ?? null,
                completedAt: node.completedAt ?? null,
            });
        } else {
            acc.push({
                name: node.context ?? "unknown",
                state: node.state ?? "PENDING",
                description: node.description ?? null,
                url: node.targetUrl ?? null,
                startedAt: node.createdAt ?? null,
                completedAt: null,
            });
        }
        return acc;
    }, []);

    const statusState = c.statusCheckRollup?.state ?? null;

    return {
        sha: c.oid,
        shortSha: c.oid.slice(0, 7),
        message: c.message,
        committedDate: c.committedDate ?? new Date().toISOString(),
        author,
        committerName: authorNode?.name ?? null,
        statusState,
        statusContexts,
        signature: c.signature
            ? {
                  __typename: c.signature.__typename,
                  isValid: c.signature.isValid,
                  state: c.signature.state,
                  keyId:
                      "keyId" in c.signature
                          ? (c.signature as { keyId: string }).keyId
                          : undefined,
              }
            : null,
    };
}

export function mapCodebergCommit(c: CodebergCommitRaw): CommitListItem {
    return {
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message,
        committedDate: c.commit.author.date,
        author: c.author
            ? { login: c.author.login, avatarUrl: c.author.avatar_url }
            : null,
        committerName: c.author?.login ?? c.commit.author.name,
        statusState: null,
        statusContexts: [],
        signature: null,
    };
}
