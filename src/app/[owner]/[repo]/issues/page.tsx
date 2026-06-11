import type { Metadata } from "next";
import { IssueList } from "./_components/issue-list";

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

    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-gray-200 border-r bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <IssueList
                    owner={owner}
                    repo={repo}
                    defaultState={defaultState}
                />
            </div>
        </main>
    );
}
