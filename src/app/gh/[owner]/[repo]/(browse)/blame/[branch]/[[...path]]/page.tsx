import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepoBlamePage } from "~/components/repo/repo-blame-page";
import { parseRepositoryReference } from "~/utils/provider-url";

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
    searchParams,
}: {
    params: Promise<BlameParams>;
    searchParams: Promise<{ refKind?: string | string[] }>;
}) {
    const { owner, repo, branch, path } = await params;
    const query = await searchParams;
    const reference = parseRepositoryReference(branch, query.refKind);
    if (!reference) notFound();
    return (
        <RepoBlamePage
            provider="gh"
            owner={owner}
            repo={repo}
            reference={reference}
            path={(path ?? []).join("/")}
        />
    );
}
