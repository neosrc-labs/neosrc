"use client";

import { Check, Link, MoreVertical, SquarePen, Trash2 } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "~/components/ui/popover";

interface CommentMenuProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    children: ReactNode;
}

/**
 * "More options" trigger + popover shared by every comment/review card in the
 * app (review threads, inline diff threads, timeline issue comments and
 * reviews). Contents are supplied by the caller via `children` (menu items).
 */
export function CommentMenu({
    open,
    onOpenChange,
    children,
}: CommentMenuProps) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="More options"
                    className="cursor-pointer rounded p-1 text-text-muted transition-colors hover:bg-surface-tertiary hover:text-text-secondary dark:hover:text-zinc-300"
                >
                    <MoreVertical size={14} />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-44 bg-surface p-1" align="end">
                {children}
            </PopoverContent>
        </Popover>
    );
}

interface CommentMenuItemProps {
    onClick: () => void;
    className?: string;
    children: ReactNode;
}

export function CommentMenuItem({
    onClick,
    className,
    children,
}: CommentMenuItemProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-label transition-colors hover:bg-surface-tertiary ${className ?? ""}`}
        >
            {children}
        </button>
    );
}

/**
 * "Copy link" menu item with transient copied feedback. `anchor` is the
 * fragment (without `#`) to link to, e.g. `issuecomment-123`.
 */
export function useCopyLink(anchor: string) {
    const [copied, setCopied] = useState(false);

    const copy = useCallback(async () => {
        const url = `${window.location.origin}${window.location.pathname}#${anchor}`;
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [anchor]);

    return { copied, copy };
}

interface CopyLinkMenuItemProps {
    anchor: string;
    onClose: () => void;
}

export function CopyLinkMenuItem({ anchor, onClose }: CopyLinkMenuItemProps) {
    const { copied, copy } = useCopyLink(anchor);
    return (
        <CommentMenuItem
            onClick={() => {
                void copy();
                onClose();
            }}
        >
            {copied ? <Check size={14} /> : <Link size={14} />}
            {copied ? "Copied" : "Copy link"}
        </CommentMenuItem>
    );
}

interface EditMenuItemProps {
    onClick: () => void;
    onClose: () => void;
}

export function EditMenuItem({ onClick, onClose }: EditMenuItemProps) {
    return (
        <CommentMenuItem
            onClick={() => {
                onClick();
                onClose();
            }}
        >
            <SquarePen size={14} />
            Edit
        </CommentMenuItem>
    );
}

interface DeleteMenuItemProps {
    onClick: () => void;
    onClose: () => void;
}

export function DeleteMenuItem({ onClick, onClose }: DeleteMenuItemProps) {
    return (
        <CommentMenuItem
            onClick={() => {
                onClick();
                onClose();
            }}
            className="hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
        >
            <Trash2 size={14} />
            Delete comment
        </CommentMenuItem>
    );
}
