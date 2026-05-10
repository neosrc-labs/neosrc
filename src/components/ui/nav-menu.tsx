import Link from "next/link";
import type * as React from "react";
import { cn } from "~/lib/utils";

interface NavMenuProps extends React.HTMLAttributes<HTMLElement> {
}

export function NavMenu({
  className,
  children
}: NavMenuProps) {
  return (
    <nav className={cn("sticky top-0 z-10 space-y-1 bg-white pr-4 pb-4 dark:bg-zinc-950", className)}>
      {children}
    </nav>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  isActive?: boolean;
}

export function NavItem({ href, label, isActive }: NavItemProps) {
  return (
    <Link
      className={`block rounded-md px-3 py-2 font-medium text-sm transition-colors ${isActive
        ? "bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-zinc-100"
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        }`}
      href={href}
    >
      {label}
    </Link>
  );
}
