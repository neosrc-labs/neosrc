import Link from "next/link";
import type * as React from "react";
import { cn } from "~/lib/utils";

interface NavMenuProps extends React.HTMLAttributes<HTMLElement> {}

export function NavMenu({ className, children }: NavMenuProps) {
    return (
        <nav
            className={cn(
                "sticky top-0 z-10 space-y-1 bg-surface pr-4 pb-4",
                className,
            )}
        >
            {children}
        </nav>
    );
}

interface NavItemProps {
    href: string;
    label: string;
    isActive?: boolean;
    count?: React.ReactNode;
}

export function NavItem({ href, label, isActive, count }: NavItemProps) {
    return (
        <Link
            className={`block rounded-md px-3 py-2 font-medium text-sm transition-colors ${
                isActive
                    ? "bg-surface-tertiary text-text-primary"
                    : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary dark:hover:text-zinc-100"
            }`}
            href={href}
        >
            {label}
            {count != null && (
                <span className="ml-1 text-text-muted">({count})</span>
            )}
        </Link>
    );
}
