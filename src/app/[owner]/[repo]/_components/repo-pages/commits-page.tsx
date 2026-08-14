import type { Metadata } from "next";
import { CommitsList } from "~/app/[owner]/[repo]/commits/_components/commits-list";
import type { CommitsListConfig } from "~/app/[owner]/[repo]/commits/_components/commits-list-config";

export interface CommitsPageProps {
    params: Promise<{ owner: string; repo: string; branch: string }>;
}

export async function generateCommitsMetadata({
    params,
}: CommitsPageProps): Promise<Metadata> {
    const { owner, repo, branch } = await params;
    return { title: `Commits - ${owner}/${repo}/${branch}` };
}

export async function CommitsPage({
    params,
    config,
}: CommitsPageProps & { config: CommitsListConfig }) {
    const { owner, repo, branch } = await params;
    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <CommitsList
                    owner={owner}
                    repo={repo}
                    branch={branch}
                    config={config}
                />
            </div>
        </main>
    );
}
