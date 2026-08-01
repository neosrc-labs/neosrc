"use client";

import { ExternalLink, LogIn, TriangleAlert } from "lucide-react";
import { useParams } from "next/navigation";

export function RepoNotFound({ signedIn = false }: { signedIn?: boolean }) {
    const params = useParams<{ owner: string; repo: string }>();
    const owner = params?.owner ?? "";
    const repo = params?.repo ?? "";

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
            <TriangleAlert className="size-12 text-amber-500" />
            <h1 className="font-semibold text-text-primary text-xl">
                Repository not found
            </h1>
            <p className="max-w-sm text-sm text-text-tertiary leading-relaxed">
                <span className="font-medium text-text-secondary">
                    {owner}/{repo}
                </span>{" "}
                could not be found on GitHub or Codeberg.
                {!signedIn
                    ? " It may be private -- sign in to check if you have access."
                    : " It may be private, deleted, or you may have typed the wrong name."}
            </p>
            {!signedIn ? (
                <a
                    href="/api/auth/signin"
                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                    <LogIn className="size-3.5" />
                    Sign in
                </a>
            ) : (
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <a
                        href={`https://github.com/${owner}/${repo}`}
                        rel="noreferrer"
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-md bg-surface-elevated px-4 py-2 font-medium text-sm text-text-secondary shadow-sm ring-1 ring-border-subtle transition-colors hover:bg-surface-tertiary hover:text-text-primary"
                    >
                        View on GitHub
                        <ExternalLink className="size-3.5" />
                    </a>
                    <a
                        href={`https://codeberg.org/${owner}/${repo}`}
                        rel="noreferrer"
                        target="_blank"
                        className="inline-flex items-center gap-1.5 rounded-md bg-surface-elevated px-4 py-2 font-medium text-sm text-text-secondary shadow-sm ring-1 ring-border-subtle transition-colors hover:bg-surface-tertiary hover:text-text-primary"
                    >
                        View on Codeberg
                        <ExternalLink className="size-3.5" />
                    </a>
                </div>
            )}
        </div>
    );
}
