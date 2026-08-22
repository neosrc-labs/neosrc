import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { getGitHubToken, isAnonymousToken } from "~/server/auth";
import {
    getRepoCollaboratorPermissions,
    getUserRepoPermission,
} from "~/server/github";
import {
    type GQLMergeQueueEntry,
    type GQLTimelineEvent,
    getPullRequestTimelineGraphQL,
} from "~/server/github-graphql";

export type TimelineResult = {
    events: GQLTimelineEvent[];
    nextCursor: string | undefined;
    commentReactions: Record<
        string,
        {
            databaseId: number;
            content: string;
            createdAt: string;
            user: { login: string } | null;
        }[]
    >;
    currentUserLogin: string | undefined;
    mergeQueueEntry: GQLMergeQueueEntry;
};

export const timelineRouter = createTRPCRouter({
    list: protectedProcedure
        .input(
            z.object({
                owner: z.string(),
                repo: z.string(),
                number: z.number(),
                limit: z.number().min(1).max(100).default(30),
                cursor: z.string().optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const accessToken = await getGitHubToken(
                ctx.db,
                ctx.session?.user?.id,
            );

            const result = await getPullRequestTimelineGraphQL(
                accessToken,
                input.owner,
                input.repo,
                input.number,
                input.limit,
                input.cursor,
            );

            const events = isAnonymousToken(accessToken)
                ? result.events
                : await attachApprovalAuthorPermissions(
                      accessToken,
                      ctx.session?.user?.id ?? "anonymous",
                      input.owner,
                      input.repo,
                      result.events,
                  );

            if (isAnonymousToken(accessToken)) {
                result.currentUserLogin = undefined;
            }

            return {
                events,
                nextCursor: result.hasMore ? result.endCursor : undefined,
                commentReactions: result.commentReactions,
                currentUserLogin: result.currentUserLogin,
                mergeQueueEntry: result.mergeQueueEntry,
            } satisfies TimelineResult;
        }),
});

type RepoPermission = "admin" | "write" | "read" | "none";

/**
 * Show a green approval check only for reviewers with write access;
 * approvals from read-only or non-collaborator reviewers get a gray check.
 * Resolves each approved review author's repo permission and attaches it to
 * the event. Prefers a single batched collaborators lookup; falls back to
 * per-user lookups when the viewer cannot list collaborators.
 */
async function attachApprovalAuthorPermissions(
    accessToken: string,
    userId: string,
    owner: string,
    repo: string,
    events: GQLTimelineEvent[],
): Promise<GQLTimelineEvent[]> {
    const authorLogins = new Set<string>();
    for (const event of events) {
        if (
            event.__typename === "PullRequestReview" &&
            event.state === "APPROVED" &&
            event.author?.login
        ) {
            authorLogins.add(event.author.login);
        }
    }
    if (authorLogins.size === 0) {
        return events;
    }

    const permissionByLogin = new Map<string, RepoPermission>();

    const collaboratorPermissions = await getRepoCollaboratorPermissions(
        accessToken,
        userId,
        owner,
        repo,
    );
    if (collaboratorPermissions) {
        // Everyone with any access is in the list; anyone absent has none.
        for (const login of authorLogins) {
            permissionByLogin.set(
                login,
                collaboratorPermissions[login] ?? "none",
            );
        }
    } else {
        // Viewer cannot list collaborators: resolve per reviewer. A 404
        // (non-collaborator) resolves to "none" and is cached, so repeated
        // page loads stop hitting the API.
        const permissions = await Promise.all(
            [...authorLogins].map(async (login) => {
                try {
                    const permission = await getUserRepoPermission(
                        accessToken,
                        owner,
                        repo,
                        login,
                        login,
                    );
                    return [login, permission] as const;
                } catch {
                    // Transient API failure: leave the permission unset so the
                    // client keeps the green check rather than guessing.
                    return [login, undefined] as const;
                }
            }),
        );
        for (const [login, permission] of permissions) {
            if (permission) {
                permissionByLogin.set(login, permission);
            }
        }
    }

    return events.map((event) => {
        if (
            event.__typename !== "PullRequestReview" ||
            event.state !== "APPROVED" ||
            !event.author?.login
        ) {
            return event;
        }
        const permission = permissionByLogin.get(event.author.login);
        return permission ? { ...event, authorPermission: permission } : event;
    });
}
