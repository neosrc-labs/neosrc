"use client";

import Link from "next/link";
import {
    blameHref,
    blobHref,
    type Provider,
    type RepositoryReference,
} from "~/utils/provider-url";

interface RepoFileTabsProps {
    provider: Provider;
    owner: string;
    repo: string;
    reference: RepositoryReference;
    path: string;
    active: "blob" | "blame";
}

const ACTIVE_CLASS =
    "rounded bg-surface-selected px-2 py-0.5 font-medium text-text-primary";
const INACTIVE_CLASS =
    "rounded px-2 py-0.5 text-text-secondary hover:bg-surface-secondary hover:text-text-primary";

/**
 * Code | Blame switcher of a file page. Links keep the toggle a client-side
 * navigation, so the browse rail and scroll position survive the switch.
 */
export function RepoFileTabs({
    provider,
    owner,
    repo,
    reference,
    path,
    active,
}: RepoFileTabsProps) {
    // Codeberg's API cannot blame, so its file view stays tab-free.
    if (provider !== "gh") return null;

    return (
        <div className="flex items-center rounded-md border border-border p-0.5 text-xs">
            <Link
                href={blobHref(provider, owner, repo, reference, path)}
                aria-current={active === "blob" ? "page" : undefined}
                className={active === "blob" ? ACTIVE_CLASS : INACTIVE_CLASS}
            >
                Code
            </Link>
            <Link
                href={blameHref(provider, owner, repo, reference, path)}
                aria-current={active === "blame" ? "page" : undefined}
                className={active === "blame" ? ACTIVE_CLASS : INACTIVE_CLASS}
            >
                Blame
            </Link>
        </div>
    );
}
