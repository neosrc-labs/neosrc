import { notFound, redirect } from "next/navigation";
import { resolveRepoProviders } from "../../../../_components/repo-redirect";

export default async function ChangesRedirectPage({
    params,
}: {
    params: Promise<{
        owner: string;
        repo: string;
        number: string;
        sha?: string[];
    }>;
}) {
    const { owner, repo, number, sha } = await params;
    const { github, codeberg } = await resolveRepoProviders(owner, repo);

    const shaPath = sha && sha.length > 0 ? `/${sha.join("/")}` : "";

    if (github)
        redirect(`/gh/${owner}/${repo}/pull/${number}/changes${shaPath}`);
    if (codeberg)
        redirect(
            `https://codeberg.org/${owner}/${repo}/pull/${number}/files${shaPath}`,
        );
    notFound();
}
