import { PullRequestList } from "./_components/pull-request-list";

export default async function PullsPage({
    params,
    searchParams,
}: {
    params: Promise<{ owner: string; repo: string }>;
    searchParams: Promise<{ state?: string }>;
}) {
    const { owner, repo } = await params;
    const { state } = await searchParams;

    const defaultState =
        state === "closed" || state === "merged" ? state : "open";

    return (
        <main className="min-h-screen min-w-0 border-gray-200 border-r bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mx-auto max-w-4xl px-6 py-8">
                <PullRequestList
                    owner={owner}
                    repo={repo}
                    defaultState={defaultState}
                />
            </div>
        </main>
    );
}
