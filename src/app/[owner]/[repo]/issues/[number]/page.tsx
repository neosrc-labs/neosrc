import { notFound, redirect } from "next/navigation";
import { resolveRepoProviders } from "../../_components/repo-redirect";

export default async function IssueRedirectPage({
    params,
}: {
    params: Promise<{ owner: string; repo: string; number: string }>;
}) {
    const { owner, repo, number } = await params;
    const { github, codeberg } = await resolveRepoProviders(owner, repo);

    if (github)
        redirect(`https://github.com/${owner}/${repo}/issues/${number}`);
    if (codeberg)
        redirect(`https://codeberg.org/${owner}/${repo}/issues/${number}`);
    notFound();
}
