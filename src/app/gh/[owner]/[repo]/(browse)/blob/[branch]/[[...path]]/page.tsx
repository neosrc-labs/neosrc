import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RepoBlobPage } from "~/components/repo/repo-blob-page";
import { parseRepositoryReference } from "~/utils/provider-url";

interface BlobParams {
    owner: string;
    repo: string;
    branch: string;
    path?: string[];
}

export async function generateMetadata({
    params,
}: {
    params: Promise<BlobParams>;
}): Promise<Metadata> {
    const { owner, repo, branch, path } = await params;
    const name = path?.at(-1) ?? repo;
    return { title: `${name} at ${branch} - ${owner}/${repo}` };
}

export default async function BlobPage({
    params,
    searchParams,
}: {
    params: Promise<BlobParams>;
    searchParams: Promise<{ refKind?: string | string[] }>;
}) {
    const { owner, repo, branch, path } = await params;
    const query = await searchParams;
    const reference = parseRepositoryReference(branch, query.refKind);
    if (!reference) notFound();
    return (
        <RepoBlobPage
            provider="gh"
            owner={owner}
            repo={repo}
            reference={reference}
            path={(path ?? []).join("/")}
        />
    );
}
