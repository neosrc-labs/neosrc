import { notFound, redirect } from "next/navigation";
import {
    codebergAccessToken,
    getSession,
    githubAccessToken,
} from "~/server/auth";
import { getRepo as getCodebergRepo } from "~/server/codeberg";
import { getRepo as getGitHubRepo } from "~/server/github";

async function checkGitHubRepo(token: string, owner: string, repo: string) {
    try {
        await getGitHubRepo(token, owner, repo);
        return true;
    } catch {
        return false;
    }
}

async function checkCodebergRepo(token: string, owner: string, repo: string) {
    const result = await getCodebergRepo(token, owner, repo);
    return result !== null;
}

export default async function FilesRedirectPage({
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
    const session = await getSession();
    if (!session) notFound();

    const [githubToken, codebergToken] = await Promise.all([
        githubAccessToken(),
        codebergAccessToken(),
    ]);

    const [githubExists, codebergExists] = await Promise.all([
        githubToken ? checkGitHubRepo(githubToken, owner, repo) : false,
        codebergToken ? checkCodebergRepo(codebergToken, owner, repo) : false,
    ]);

    const shaPath = sha && sha.length > 0 ? `/${sha.join("/")}` : "";

    if (githubExists)
        redirect(`/gh/${owner}/${repo}/pull/${number}/files${shaPath}`);
    if (codebergExists)
        redirect(
            `https://codeberg.org/${owner}/${repo}/pull/${number}/files${shaPath}`,
        );
    notFound();
}
