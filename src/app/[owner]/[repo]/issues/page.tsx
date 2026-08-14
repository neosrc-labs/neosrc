import { notFound, redirect } from "next/navigation";
import { resolveRepoProviders } from "../_components/repo-redirect";

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

    const { github, codeberg } = await resolveRepoProviders(owner, repo);

    if (github)
        redirect(`/gh/${owner}/${repo}/issues${qString ? `?${qString}` : ""}`);
    if (codeberg)
        redirect(`/cb/${owner}/${repo}/issues${qString ? `?${qString}` : ""}`);
    notFound();
}
