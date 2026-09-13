import { notFound, redirect } from "next/navigation";
import { resolveRepoProviders } from "../../_components/repo-redirect";

export default async function IssueRedirectPage({
    params,
}: {
    params: Promise<{ owner: string; repo: string; number: string }>;
}) {
    const { owner, repo, number } = await params;
    const { github, codeberg } = await resolveRepoProviders(owner, repo);

    if (github) redirect(`/gh/${owner}/${repo}/issues/${number}`);
    if (codeberg) redirect(`/cb/${owner}/${repo}/issues/${number}`);
    notFound();
}
