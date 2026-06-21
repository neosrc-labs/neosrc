import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { generateApiKey } from "~/server/api-keys";
import { getCodebergToken, getGitHubToken } from "~/server/auth";
import { getUserRepos as getCodebergUserRepos } from "~/server/codeberg";
import { apiKey, apiKeyPermission, betterAuthUser } from "~/server/db/schema";
import { getUserRepos as getGitHubUserRepos } from "~/server/github";

const permissionSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("UPLOAD_REPORT_OWNER"),
    }),
    z.object({
        kind: z.literal("UPLOAD_REPORT_REPO"),
        target: z.string().min(1),
    }),
]);

export const apiKeysRouter = createTRPCRouter({
    getAll: protectedProcedure.query(async ({ ctx }) => {
        const keys = await ctx.db
            .select()
            .from(apiKey)
            .where(eq(apiKey.owner, ctx.session.user.id))
            .orderBy(desc(apiKey.createdAt));

        const keyIds = keys.map((k) => k.id);

        const permissions =
            keyIds.length > 0
                ? await ctx.db
                      .select()
                      .from(apiKeyPermission)
                      .where(
                          keyIds.length === 1
                              ? // @ts-expect-error - checked length above
                                eq(apiKeyPermission.apiKeyId, keyIds[0])
                              : inArray(apiKeyPermission.apiKeyId, keyIds),
                      )
                : [];

        const permissionsByKeyId = new Map<
            number,
            (typeof apiKeyPermission.$inferSelect)[]
        >();
        for (const p of permissions) {
            const list = permissionsByKeyId.get(p.apiKeyId);
            if (list) {
                list.push(p);
            } else {
                permissionsByKeyId.set(p.apiKeyId, [p]);
            }
        }

        return keys.map((k) => ({
            id: k.id,
            name: k.name,
            prefix: k.hash.slice(0, 8),
            createdAt: k.createdAt,
            updatedAt: k.updatedAt,
            expirationTimestamp: k.expirationTimestamp,
            permissions: permissionsByKeyId.get(k.id) ?? [],
        }));
    }),

    create: protectedProcedure
        .input(
            z.object({
                name: z.string().min(1).max(255),
                permissions: z.array(permissionSchema).min(1),
                expirationTimestamp: z
                    .string()
                    .datetime()
                    .nullable()
                    .optional(),
            }),
        )
        .mutation(async ({ ctx, input }) => {
            const [user] = await ctx.db
                .select({
                    githubUsername: betterAuthUser.githubUsername,
                    codebergUsername: betterAuthUser.codebergUsername,
                })
                .from(betterAuthUser)
                .where(eq(betterAuthUser.id, ctx.session.user.id))
                .limit(1);

            if (!user) {
                throw new Error("User not found");
            }

            const linkedProviders: { provider: string; username: string }[] =
                [];
            if (user.githubUsername) {
                linkedProviders.push({
                    provider: "github",
                    username: user.githubUsername,
                });
            }
            if (user.codebergUsername) {
                linkedProviders.push({
                    provider: "codeberg",
                    username: user.codebergUsername,
                });
            }

            if (linkedProviders.length === 0) {
                throw new Error(
                    "No linked accounts found. Link GitHub or Codeberg first.",
                );
            }

            const repoTargets = input.permissions.filter(
                (p) => p.kind === "UPLOAD_REPORT_REPO",
            );

            if (repoTargets.length > 0) {
                const repoProviderCache = new Map<string, Set<string>>();

                const getRepoSet = async (provider: string) => {
                    const cached = repoProviderCache.get(provider);
                    if (cached) return cached;

                    const repos =
                        provider === "github"
                            ? await getGitHubUserRepos(
                                  await getGitHubToken(
                                      ctx.db,
                                      ctx.session.user.id,
                                  ),
                              )
                            : await getCodebergUserRepos(
                                  await getCodebergToken(
                                      ctx.db,
                                      ctx.session.user.id,
                                  ),
                              );

                    const set = new Set(repos.map((r) => r.fullName));
                    repoProviderCache.set(provider, set);
                    return set;
                };

                for (const rt of repoTargets) {
                    const colonIndex = rt.target.indexOf(":");
                    if (colonIndex === -1) {
                        throw new Error(
                            `Invalid repo target "${rt.target}" - must be prefixed with "github:" or "codeberg:"`,
                        );
                    }
                    const rtProvider = rt.target.slice(0, colonIndex);
                    const rtName = rt.target.slice(colonIndex + 1);

                    const validRepos = await getRepoSet(rtProvider);
                    if (!validRepos.has(rtName)) {
                        throw new Error(
                            `Repository "${rtName}" not found or not owned by you on ${rtProvider}`,
                        );
                    }
                }
            }

            const { rawKey, hash } = await generateApiKey();

            const [inserted] = await ctx.db
                .insert(apiKey)
                .values({
                    name: input.name,
                    hash,
                    owner: ctx.session.user.id,
                    expirationTimestamp: input.expirationTimestamp
                        ? new Date(input.expirationTimestamp)
                        : null,
                })
                .returning();

            if (!inserted) {
                throw new Error("Failed to create API key");
            }

            const dbPermissions: (typeof apiKeyPermission.$inferInsert)[] = [];

            for (const perm of input.permissions) {
                if (perm.kind === "UPLOAD_REPORT_OWNER") {
                    for (const lp of linkedProviders) {
                        dbPermissions.push({
                            kind: "UPLOAD_REPORT_OWNER",
                            apiKeyId: inserted.id,
                            target: `${lp.provider}:${lp.username}`,
                        });
                    }
                } else {
                    dbPermissions.push({
                        kind: "UPLOAD_REPORT_REPO",
                        apiKeyId: inserted.id,
                        target: perm.target,
                    });
                }
            }

            if (dbPermissions.length > 0) {
                await ctx.db.insert(apiKeyPermission).values(dbPermissions);
            }

            return { rawKey, key: inserted };
        }),

    revoke: protectedProcedure
        .input(z.object({ id: z.number() }))
        .mutation(async ({ ctx, input }) => {
            const [key] = await ctx.db
                .select()
                .from(apiKey)
                .where(
                    and(
                        eq(apiKey.id, input.id),
                        eq(apiKey.owner, ctx.session.user.id),
                    ),
                )
                .limit(1);

            if (!key) {
                throw new Error("API key not found");
            }

            await ctx.db.delete(apiKey).where(eq(apiKey.id, input.id));

            return { success: true };
        }),
});
