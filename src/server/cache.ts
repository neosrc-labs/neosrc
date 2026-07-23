import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "./db";
import { cache as cacheTable } from "./db/schema";

export interface CacheOptions {
    staleAfter: number;
    deleteAfter?: number;
}

export async function withStaleWhileRevalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions,
): Promise<T> {
    const now = new Date();

    try {
        const [cached] = await db
            .select()
            .from(cacheTable)
            .where(eq(cacheTable.key, key))
            .limit(1);

        if (cached) {
            if (cached.deleteAt && now >= cached.deleteAt) {
                const fresh = await fetcher();
                await persistCache(key, fresh, options);
                return fresh;
            }

            if (now < cached.staleAt) {
                return cached.value as T;
            }

            after(() => revalidate(key, fetcher, options));
            return cached.value as T;
        }
    } catch {
        // DB error — fall through to fetcher
    }

    const fresh = await fetcher();
    try {
        await persistCache(key, fresh, options);
    } catch {
        // Swallow — cache write failure shouldn't break the response
    }
    return fresh;
}

async function persistCache<T>(
    key: string,
    value: T,
    options: CacheOptions,
): Promise<void> {
    const now = new Date();
    const staleAt = new Date(now.getTime() + options.staleAfter);
    const deleteAt = options.deleteAfter
        ? new Date(now.getTime() + options.deleteAfter)
        : null;

    await db
        .insert(cacheTable)
        .values({ key, value, staleAt, deleteAt })
        .onConflictDoUpdate({
            target: cacheTable.key,
            set: { value, staleAt, deleteAt, updatedAt: now },
        });
}

export async function readCache<T>(key: string): Promise<T | null> {
    try {
        const [cached] = await db
            .select()
            .from(cacheTable)
            .where(eq(cacheTable.key, key))
            .limit(1);

        if (cached && (!cached.deleteAt || new Date() < cached.deleteAt)) {
            return cached.value as T;
        }
    } catch {
        // DB error — return null
    }
    return null;
}

async function revalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions,
): Promise<void> {
    try {
        const fresh = await fetcher();
        await persistCache(key, fresh, options);
    } catch {
        // Background revalidation failed — stale data remains, try again next time
    }
}

export function prCacheKey(
    owner: string,
    repo: string,
    number: number,
): string {
    return `pr:${owner}:${repo}:${number}`;
}

export function repoHeaderDataCacheKey(
    provider: "gh" | "cb",
    owner: string,
    repo: string,
): string {
    return `${provider}:repo-header:${owner}:${repo}`;
}

export function repoIssuePullCountsCacheKey(
    provider: "gh" | "cb",
    owner: string,
    repo: string,
): string {
    return `${provider}:counts:${owner}:${repo}`;
}

export function repoLanguagesCacheKey(owner: string, repo: string): string {
    return `gh:langs:${owner}:${repo}`;
}

export function repoContributorsCacheKey(owner: string, repo: string): string {
    return `gh:contributors:${owner}:${repo}`;
}

export function repoDocFilesCacheKey(
    owner: string,
    repo: string,
    ref?: string,
): string {
    return `gh:doc-files:${owner}:${repo}${ref ? `:${ref}` : ""}`;
}

export function repoStarredCacheKey(
    userId: string,
    owner: string,
    repo: string,
): string {
    return `gh:starred:${userId}:${owner}:${repo}`;
}

export function repoSubscriptionCacheKey(
    userId: string,
    owner: string,
    repo: string,
): string {
    return `gh:subscription:${userId}:${owner}:${repo}`;
}

export async function deleteCache(key: string): Promise<void> {
    try {
        await db.delete(cacheTable).where(eq(cacheTable.key, key));
    } catch {
        // Swallow — cache delete failure shouldn't break the request
    }
}
