import type { Metadata } from "next";

export async function generatePRMetadata(
    owner: string,
    repo: string,
    number: string,
): Promise<Metadata> {
    const title = `${owner}/${repo} #${number}`;
    // NOTE: We don't want to load the PR title here since its slow and blocks the page load
    return { title };
}

export async function generateIssueMetadata(
    owner: string,
    repo: string,
    number: string,
): Promise<Metadata> {
    const title = `${owner}/${repo} #${number}`;
    // NOTE: We don't want to load the issue title here since its slow and blocks the page load
    return { title };
}
