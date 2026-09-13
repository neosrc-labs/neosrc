import type { ReactNode } from "react";
import { IssueLayout } from "~/app/[owner]/[repo]/issues/[number]/issue-layout";

interface LayoutProps {
    children: ReactNode;
    params: Promise<{
        owner: string;
        repo: string;
        number: string;
    }>;
}

export default function Layout({ children, params }: LayoutProps) {
    return (
        <IssueLayout provider="gh" params={params}>
            {children}
        </IssueLayout>
    );
}
