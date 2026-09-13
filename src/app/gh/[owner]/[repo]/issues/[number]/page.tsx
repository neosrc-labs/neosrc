import type { Metadata } from "next";
import { IssueDetailPage } from "~/app/[owner]/[repo]/issues/[number]/issue-detail-page";
import { generateIssueMetadata } from "~/server/metadata";

interface PageProps {
    params: Promise<{
        owner: string;
        repo: string;
        number: string;
    }>;
}

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { owner, repo, number } = await params;
    return generateIssueMetadata(owner, repo, number);
}

export default function IssuePage({ params }: PageProps) {
    return <IssueDetailPage provider="gh" params={params} />;
}
