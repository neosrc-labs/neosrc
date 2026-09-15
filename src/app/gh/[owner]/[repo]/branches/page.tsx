import type { Metadata } from "next";
import { ghBranchConfig } from "~/components/branch/branch-list-config";
import { BranchListShared } from "~/components/branch/branch-list-shared";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `Branches - ${owner}/${repo}` };
}

export default async function BranchesPage({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}) {
    const { owner, repo } = await params;

    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <BranchListShared
                    owner={owner}
                    repo={repo}
                    config={ghBranchConfig}
                />
            </div>
        </main>
    );
}
