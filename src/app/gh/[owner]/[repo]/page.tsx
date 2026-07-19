import type { Metadata } from "next";
import { HydrateClient } from "~/trpc/server";
import { RepoCodePage } from "./_components/repo-code-page";

export async function generateMetadata({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
    const { owner, repo } = await params;
    return { title: `${owner}/${repo}` };
}

export default async function CodePage({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}) {
    const { owner, repo } = await params;

    return (
        <HydrateClient>
            <RepoCodePage owner={owner} repo={repo} />
        </HydrateClient>
    );
}
