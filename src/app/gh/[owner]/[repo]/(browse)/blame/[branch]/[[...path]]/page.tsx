import type { Metadata } from "next";
import { RepoBlamePage } from "~/components/repo/repo-blame-page";

interface BlameParams {
    owner: string;
    repo: string;
    branch: string;
    path?: string[];
}

export async function generateMetadata({
    params,
}: {
    params: Promise<BlameParams>;
}): Promise<Metadata> {
    const { owner, repo, branch, path } = await params;
    const name = path?.at(-1) ?? repo;
    return { title: `Blame of ${name} at ${branch} - ${owner}/${repo}` };
}

export default async function BlamePage({
    params,
}: {
    params: Promise<BlameParams>;
}) {
    const { owner, repo, branch, path } = await params;

    return (
        <RepoBlamePage
            provider="gh"
            owner={owner}
            repo={repo}
            selectedRef={branch}
            path={(path ?? []).join("/")}
        />
    );
}
