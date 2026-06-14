import { redirect } from "next/navigation";

export default async function CbPullRequestPage({
    params,
}: {
    params: Promise<{ owner: string; repo: string; number: string }>;
}) {
    const { owner, repo, number } = await params;
    redirect(`https://codeberg.org/${owner}/${repo}/pull/${number}`);
}
