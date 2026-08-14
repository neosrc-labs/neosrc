import type { StatusContext } from "~/components/ci-status";
import type { CodebergCommitRaw } from "~/server/codeberg";
import type {
    BranchCommitsResult,
    GQLStatusCheckNode,
} from "~/server/github-graphql";
import type { CommitListItem } from "./types";

function isCheckRunNode(
    node: GQLStatusCheckNode,
): node is GQLStatusCheckNode & { name: string } {
    return "name" in node && typeof node.name === "string";
}

export function mapGQLCommit(
    c: BranchCommitsResult["commits"][number],
): CommitListItem {
    const authorNode = c.authors[0];
    const author = authorNode?.user
        ? {
              login: authorNode.user.login,
              avatarUrl: authorNode.user.avatarUrl,
              url: authorNode.user.url,
          }
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
                  keyId: "keyId" in c.signature ? c.signature.keyId : undefined,
              }
            : null,
    };
}

export function mapCodebergCommit(
    c: CodebergCommitRaw,
    combinedStatus?: {
        state: string;
        statuses: Array<{
            context: string;
            status: string;
            description: string | null;
            target_url: string | null;
            created_at: string;
            updated_at: string;
        }>;
    } | null,
): CommitListItem {
    return {
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message: c.commit.message,
        committedDate: c.commit.author.date,
        author: c.author
            ? {
                  login: c.author.login,
                  avatarUrl: c.author.avatar_url,
                  url: `https://codeberg.org/${c.author.login}`,
              }
            : null,
        committerName: c.author?.login ?? c.commit.author.name,
        statusState:
            combinedStatus?.state != null &&
            (combinedStatus.statuses?.length ?? 0) > 0
                ? combinedStatus.state.toUpperCase()
                : null,
        statusContexts: combinedStatus?.statuses
            ? combinedStatus.statuses.map(
                  (s): StatusContext => ({
                      name: s.context,
                      state:
                          s.status != null ? s.status.toUpperCase() : "PENDING",
                      description: s.description,
                      url: s.target_url?.startsWith("/")
                          ? `https://codeberg.org${s.target_url}`
                          : s.target_url,
                      startedAt: s.created_at,
                      completedAt: s.updated_at,
                  }),
              )
            : [],
        signature: null,
    };
}
