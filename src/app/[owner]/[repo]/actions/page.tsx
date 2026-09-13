import { notFound, redirect } from "next/navigation";
import { resolveRepoProviders } from "../_components/repo-redirect";

export default async function ActionsRedirectPage({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}) {
    const { owner, repo } = await params;
    const { github, codeberg } = await resolveRepoProviders(owner, repo);

    if (github) redirect(`/gh/${owner}/${repo}/actions`);
    if (codeberg) redirect(`/cb/${owner}/${repo}/actions`);
    notFound();
}
