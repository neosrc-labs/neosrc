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
    // No Codeberg Actions route yet; send those visitors to Codeberg's own page.
    if (codeberg) redirect(`https://codeberg.org/${owner}/${repo}/actions`);
    notFound();
}
