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
  checks?: Array<{
    name: string;
    conclusion: string | null;
    status: string;
    html_url?: string;
  }>;
}

export default function LeftSidebar({
  owner,
  repo,
  number,
  activeTab,
  checks,
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

      {/* Checks Section */}
      <div className="mt-6 border-t border-gray-200 pt-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Checks</h3>
        {checks && checks.length > 0 ? (
          <div className="space-y-2">
            {checks.map((check, idx) => (
              <a
                key={idx}
                href={check.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-gray-50"
              >
                <span className="text-sm">
                  {check.conclusion === "success" ? (
                    <span className="text-green-600">✓</span>
                  ) : check.conclusion === "failure" ? (
                    <span className="text-red-600">✗</span>
                  ) : check.status === "in_progress" ? (
                    <span className="text-gray-400">⏳</span>
                  ) : (
                    <span className="text-gray-400">○</span>
                  )}
                </span>
                <span className="truncate text-sm text-gray-700">
                  {check.name}
                </span>
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No checks</p>
        )}
      </div>

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
