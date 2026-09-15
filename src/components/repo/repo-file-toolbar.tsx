"use client";

import { CopyIcon, DownloadIcon } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { CopyButton } from "~/components/ui/copy-button";

interface RepoFileToolbarProps {
    /** View switcher (Code | Blame) shown before the meta label. */
    tabs?: ReactNode;
    /** Left of the actions, e.g. "12 lines". */
    meta: ReactNode;
    /** Right-aligned file actions. */
    actions: ReactNode;
}

/** Bar above a file body: view tabs, a meta label, and file actions. */
export function RepoFileToolbar({ tabs, meta, actions }: RepoFileToolbarProps) {
    return (
        <div className="flex min-h-10 items-center justify-between border-border border-b bg-surface-elevated px-4 py-1.5">
            <div className="flex items-center gap-2">
                {tabs}
                <span className="text-text-tertiary text-xs">{meta}</span>
            </div>
            <div className="flex items-center gap-1">{actions}</div>
        </div>
    );
}

/** Copy, download and raw-view actions of a file body. */
export function RepoFileActions({
    name,
    content,
    rawHref,
}: {
    name: string;
    content: string | null;
    rawHref: string;
}) {
    return (
        <>
            {content !== null && (
                <CopyButton
                    text={content}
                    title="Copy raw contents"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-text-secondary text-xs hover:bg-surface-secondary hover:text-text-primary"
                >
                    {(copied) => (
                        <>
                            <CopyIcon className="h-3.5 w-3.5" />
                            {copied ? "Copied" : "Copy raw"}
                        </>
                    )}
                </CopyButton>
            )}
            {content !== null && (
                <DownloadButton name={name} content={content} />
            )}
            <a
                href={rawHref}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-text-secondary text-xs hover:bg-surface-secondary hover:text-text-primary"
            >
                <DownloadIcon className="h-3.5 w-3.5" />
                Raw
            </a>
        </>
    );
}

function DownloadButton({ name, content }: { name: string; content: string }) {
    const [href, setHref] = useState<string | null>(null);

    useEffect(() => {
        const url = URL.createObjectURL(new Blob([content]));
        setHref(url);
        return () => URL.revokeObjectURL(url);
    }, [content]);

    return (
        <a
            href={href ?? undefined}
            download={name}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-text-secondary text-xs hover:bg-surface-secondary hover:text-text-primary"
        >
            <DownloadIcon className="h-3.5 w-3.5" />
            Download
        </a>
    );
}
