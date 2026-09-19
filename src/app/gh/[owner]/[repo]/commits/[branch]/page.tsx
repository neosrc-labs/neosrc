import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CommitsList } from "~/components/commit/commits-list";
import { ghConfig } from "~/components/commit/commits-list-config";
import { parseRepositoryReference } from "~/utils/provider-url";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ owner: string; repo: string; branch: string }>;
}): Promise<Metadata> {
    const { owner, repo, branch } = await params;
    return { title: `Commits - ${owner}/${repo}/${branch}` };
}

export default async function CommitsPage({
    params,
    searchParams,
}: {
    params: Promise<{ owner: string; repo: string; branch: string }>;
    searchParams: Promise<{ refKind?: string | string[] }>;
}) {
    const { owner, repo, branch } = await params;
    const query = await searchParams;
    const reference = parseRepositoryReference(branch, query.refKind);
    if (!reference) notFound();
    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <CommitsList
                    owner={owner}
                    repo={repo}
                    reference={reference}
                    config={ghConfig}
                />
            </div>
        </main>
    );
}
