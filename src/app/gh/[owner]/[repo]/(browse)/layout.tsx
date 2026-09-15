import type { ReactNode } from "react";
import { RepoBrowseShell } from "~/components/repo/repo-browse-shell";

/**
 * Shell of the GitHub file and directory routes. Owning the rail here keeps it
 * mounted, with its expansion and scroll, across tree/blob navigation.
 */
export default async function BrowseLayout({
    children,
    params,
}: {
    children: ReactNode;
    params: Promise<{ owner: string; repo: string }>;
}) {
    const { owner, repo } = await params;
    return (
        <RepoBrowseShell provider="gh" owner={owner} repo={repo}>
            {children}
        </RepoBrowseShell>
    );
}
