import type { Metadata } from "next";
import { cbConfig } from "~/components/pull/pull-request-list-config";
import { PullRequestListShared } from "~/components/pull/pull-request-list-shared";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `Pulls - ${owner}/${repo}` };
}

export default async function PullsPage({
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

    const defaultState: "open" | "closed" =
        state === "closed" ? "closed" : "open";

    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <PullRequestListShared
                    owner={owner}
                    repo={repo}
                    defaultState={defaultState}
                    config={cbConfig}
                />
            </div>
        </main>
    );
}
