import type { Metadata } from "next";
import { PullRequestList } from "./pull-request-list";

export interface PullsPageProps {
    params: Promise<{ owner: string; repo: string }>;
    searchParams: Promise<{
        state?: string;
        q?: string;
        sort?: string;
        order?: string;
    }>;
}

export async function generatePullsMetadata({
    params,
}: PullsPageProps): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `Pulls - ${owner}/${repo}` };
}

export async function PullsPage({
    params,
    searchParams,
    provider,
}: PullsPageProps & { provider: "gh" | "cb" }) {
    const { owner, repo } = await params;
    const { state } = await searchParams;

    const defaultState: "open" | "closed" | "merged" =
        state === "closed" || state === "merged" ? state : "open";

    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <PullRequestList
                    owner={owner}
                    repo={repo}
                    defaultState={defaultState}
                    provider={provider}
                />
            </div>
        </main>
    );
}
