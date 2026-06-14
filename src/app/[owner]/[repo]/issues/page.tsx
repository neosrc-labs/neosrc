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
    return (await getCodebergRepo(token, owner, repo)) !== null;
}

export default async function IssuesRedirectPage({
    params,
    searchParams,
}: {
    params: Promise<{ owner: string; repo: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const { owner, repo } = await params;
    const sp = await searchParams;
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
        if (value) qs.set(key, String(value));
    }
    const qString = qs.toString();

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

    if (githubExists)
        redirect(`/gh/${owner}/${repo}/issues${qString ? `?${qString}` : ""}`);
    if (codebergExists)
        redirect(`/cb/${owner}/${repo}/issues${qString ? `?${qString}` : ""}`);
    notFound();
}
