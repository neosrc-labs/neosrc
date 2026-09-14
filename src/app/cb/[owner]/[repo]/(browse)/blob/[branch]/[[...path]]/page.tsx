import type { Metadata } from "next";
import { RepoBlobPage } from "~/app/[owner]/[repo]/_components/repo-blob-page";

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

export default async function CodebergBlobPage({
    params,
}: {
    params: Promise<BlobParams>;
}) {
    const { owner, repo, branch, path } = await params;

    return (
        <RepoBlobPage
            provider="cb"
            owner={owner}
            repo={repo}
            selectedRef={branch}
            path={(path ?? []).join("/")}
        />
    );
}
