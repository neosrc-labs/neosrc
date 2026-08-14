import type { Metadata } from "next";
import { IssueList } from "~/app/[owner]/[repo]/issues/_components/issue-list";

export interface IssuesPageProps {
    params: Promise<{ owner: string; repo: string }>;
    searchParams: Promise<{
        state?: string;
        q?: string;
        sort?: string;
        order?: string;
    }>;
}

export async function generateIssuesMetadata({
    params,
}: IssuesPageProps): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `Issues - ${owner}/${repo}` };
}

export async function IssuesPage({
    params,
    searchParams,
    provider,
}: IssuesPageProps & { provider: "gh" | "cb" }) {
    const { owner, repo } = await params;
    const { state } = await searchParams;

    const defaultState: "open" | "closed" = state === "closed" ? state : "open";

    return (
        <main className="min-h-[calc(100svh-var(--header-height))] min-w-0 border-border-subtle border-r bg-surface">
            <div className="mx-auto max-w-7xl px-6 py-8">
                <IssueList
                    provider={provider}
                    owner={owner}
                    repo={repo}
                    defaultState={defaultState}
                />
            </div>
        </main>
    );
}
