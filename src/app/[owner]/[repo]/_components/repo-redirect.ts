import { notFound } from "next/navigation";
import { env } from "~/env";
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
    return (await getCodebergRepo(token, owner, repo)) !== null;
}

export async function resolveRepoProviders(
    owner: string,
    repo: string,
): Promise<{ github: boolean; codeberg: boolean }> {
    const session = await getSession();
    if (!session && !env.GITHUB_ANONYMOUS_TOKEN) notFound();

    const [githubToken, codebergToken] = await Promise.all([
        githubAccessToken(),
        codebergAccessToken(),
    ]);

    const [github, codeberg] = await Promise.all([
        githubToken ? checkGitHubRepo(githubToken, owner, repo) : false,
        codebergToken ? checkCodebergRepo(codebergToken, owner, repo) : false,
    ]);

    return { github, codeberg };
}
