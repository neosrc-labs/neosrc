"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface NavItemProps {
  href: string;
  label: string;
  isActive?: boolean;
}

function NavItem({ href, label, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-gray-100 text-gray-900"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      }`}
    >
      {label}
    </Link>
  );
}

interface LeftSidebarProps {
  owner: string;
  repo: string;
  number: string;
  activeTab: "conversation" | "files";
}

export default function LeftSidebar({
  owner,
  repo,
  number,
  activeTab,
}: LeftSidebarProps) {
  const basePath = `/${owner}/${repo}/pull/${number}`;

  return (
    <aside className="border-r border-gray-200 bg-white px-4 py-6">
      <nav className="space-y-1">
        <NavItem
          href={basePath}
          label="Conversation"
          isActive={activeTab === "conversation"}
        />
        <NavItem
          href={`${basePath}/files`}
          label="Files Changed"
          isActive={activeTab === "files"}
        />
      </nav>
    </aside>
  );
}
