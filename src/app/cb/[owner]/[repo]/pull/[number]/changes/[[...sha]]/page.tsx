import { redirect } from "next/navigation";
import type { PullChangesPageParams } from "~/app/[owner]/[repo]/_components/repo-pages/changes-page-params";

export default async function CbChangesPage({
    params,
}: {
    params: Promise<PullChangesPageParams>;
}) {
    const { owner, repo, number, sha } = await params;
    const shaPath = sha && sha.length > 0 ? `/${sha.join("/")}` : "";
    redirect(
        `https://codeberg.org/${owner}/${repo}/pull/${number}/files${shaPath}`,
    );
}
