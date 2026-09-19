"use client";

import Link from "next/link";
import type { Provider } from "~/utils/provider-url";

/** Shown when a tree or blob URL names a path the repo does not contain. */
export function RepoPathNotFound({
    provider,
    owner,
    repo,
    selectedRef,
}: {
    provider: Provider;
    owner: string;
    repo: string;
    selectedRef: string;
}) {
    return (
        <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <p className="font-medium text-base text-text-primary">
                This path does not exist in {selectedRef}.
            </p>
            <Link
                href={`/${provider}/${owner}/${repo}`}
                className="text-link text-sm hover:text-link-hover hover:underline"
            >
                Back to the repository
            </Link>
        </div>
    );
}
