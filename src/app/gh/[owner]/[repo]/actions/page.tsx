import type { Metadata } from "next";
import { ActionsList } from "~/components/actions/actions-list";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `Actions - ${owner}/${repo}` };
}

export default async function ActionsPage({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}) {
    const { owner, repo } = await params;

    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <ActionsList provider="gh" owner={owner} repo={repo} />
            </div>
        </main>
    );
}
