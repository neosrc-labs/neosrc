import type { Metadata } from "next";
import { IssueList } from "~/components/issue/issue-list";
import { api, HydrateClient } from "~/trpc/server";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `Issues - ${owner}/${repo}` };
}

export default async function IssuesPage({
    params,
    searchParams,
}: {
    params: Promise<{ owner: string; repo: string }>;
    searchParams: Promise<{
        state?: string;
        q?: string;
        sort?: string;
        order?: string;
    }>;
}) {
    const { owner, repo } = await params;
    const { state } = await searchParams;

    const defaultState: "open" | "closed" = state === "closed" ? state : "open";

    await api.issues.pinned.prefetch({ provider: "gh", owner, repo });

    return (
        <HydrateClient>
            <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
                <div className="mx-auto max-w-7xl px-6 py-8">
                    <IssueList
                        provider="gh"
                        owner={owner}
                        repo={repo}
                        defaultState={defaultState}
                    />
                </div>
            </main>
        </HydrateClient>
    );
}
