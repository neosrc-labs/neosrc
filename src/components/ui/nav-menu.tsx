import Link from "next/link";
import type * as React from "react";
import { cn } from "~/lib/utils";

interface NavMenuProps extends React.HTMLAttributes<HTMLElement> {}

export function NavMenu({ className, children }: NavMenuProps) {
    return (
        <nav
            className={cn(
                "sticky top-0 z-10 space-y-1 bg-white pr-4 pb-4 dark:bg-zinc-950",
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
                    ? "bg-gray-100 text-text-primary dark:bg-zinc-800"
                    : "text-text-secondary hover:bg-gray-50 hover:text-text-primary dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
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
