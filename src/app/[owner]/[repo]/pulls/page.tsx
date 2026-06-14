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

export default async function PullsRedirectPage({
    params,
}: {
    params: Promise<{ owner: string; repo: string }>;
}) {
    const { owner, repo } = await params;
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

    if (githubExists) redirect(`/gh/${owner}/${repo}/pulls`);
    if (codebergExists) redirect(`/cb/${owner}/${repo}/pulls`);
    notFound();
}
