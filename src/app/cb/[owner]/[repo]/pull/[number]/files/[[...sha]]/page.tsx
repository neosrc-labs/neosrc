import { redirect } from "next/navigation";

export default async function CbFilesPage({
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
    const shaPath = sha && sha.length > 0 ? `/${sha.join("/")}` : "";
    redirect(
        `https://codeberg.org/${owner}/${repo}/pull/${number}/files${shaPath}`,
    );
}
