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
    <aside className="flex h-full flex-col border-r border-gray-200 bg-white px-4 py-6">
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

      <div className="flex-1" />

      <div className="flex-none space-y-2 border-t border-gray-200 pt-6">
        <button
          disabled
          className="w-full rounded-md bg-[#2da44e] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#218838] disabled:opacity-50"
        >
          Approve
        </button>
        <button
          disabled
          className="w-full rounded-md bg-[#cf222e] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#b91c23] disabled:opacity-50"
        >
          Request Changes
        </button>
        <button
          disabled
          className="w-full rounded-md bg-[#8250df] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6e40c9] disabled:opacity-50"
        >
          Merge
        </button>
      </div>
    </aside>
  );
}
