"use client";

import {
    BookOpen,
    CircleDot,
    CirclePlay,
    Code2,
    GitPullRequest,
    Settings,
    Table2,
} from "lucide-react";
import Link from "next/link";
import type { ElementType } from "react";
import { useMemo } from "react";
import { cn, formatCount } from "~/lib/utils";
import type { HeaderRepoData } from "./header-client";
import type { PathType } from "./types";

export type Provider = "gh" | "cb";

export interface Tab {
    label: string;
    path: string;
    show: boolean;
    isActive: boolean;
    icon: ElementType;
    count?: number | null;
}

const SKELETON_WIDTHS = [48, 56, 72, 52, 60, 44, 64];

export function RepoNavbar({ tabs }: { tabs: Tab[] }) {
    return (
        <nav aria-label="Repository navigation">
            <div className="flex gap-0 overflow-x-auto px-4 sm:px-6 lg:px-8">
                {tabs.length > 0
                    ? tabs.map((tab) => {
                          const className = cn(
                              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 font-medium text-sm transition-colors",
                              tab.isActive
                                  ? "border-blue-500 text-text-primary"
                                  : "border-transparent text-text-secondary hover:border-gray-300 hover:text-text-primary dark:hover:border-zinc-600 dark:hover:text-zinc-100",
                          );
                          const children = (
                              <>
                                  <tab.icon className="size-4" />
                                  {tab.label}
                                  {tab.count != null && (
                                      <span className="text-text-muted">
                                          {formatCount(tab.count)}
                                      </span>
                                  )}
                              </>
                          );
                          return tab.path.startsWith("/") ? (
                              <Link
                                  key={tab.path}
                                  href={tab.path}
                                  className={className}
                              >
                                  {children}
                              </Link>
                          ) : (
                              <a
                                  key={tab.path}
                                  href={tab.path}
                                  className={className}
                              >
                                  {children}
                              </a>
                          );
                      })
                    : SKELETON_WIDTHS.map((w) => (
                          <div
                              key={`skeleton-${w}`}
                              className="flex items-center border-transparent border-b-2 px-3 py-2"
                              aria-hidden
                          >
                              <div
                                  className="h-5 animate-pulse rounded bg-surface-selected"
                                  style={{ width: `${w}px` }}
                              />
                          </div>
                      ))}
            </div>
        </nav>
    );
}

export function useTabs({
    repoData,
    provider,
    owner,
    repo,
    pathType,
}: {
    repoData: HeaderRepoData | null;
    provider: Provider;
    owner: string | null;
    repo: string | null;
    pathType: PathType | null;
}): Tab[] {
    return useMemo((): Tab[] => {
        if (!repoData || !owner || !repo) return [];

        const allTabs: Tab[] = [
            {
                label: "Code",
                path: `/${provider}/${owner}/${repo}`,
                show: true,
                isActive: pathType === "REPO",
                icon: Code2,
            },
            {
                label: "Issues",
                path: `/${provider}/${owner}/${repo}/issues`,
                show: repoData.hasIssues ?? true,
                isActive: pathType === "ISSUES_LIST",
                icon: CircleDot,
                count: repoData.openIssuesCount,
            },
            {
                label: "Pull Requests",
                path: `/${provider}/${owner}/${repo}/pulls`,
                show: true,
                isActive:
                    pathType === "PULLS_LIST" || pathType === "PULL_REQUEST",
                icon: GitPullRequest,
                count: repoData.openPullRequestsCount,
            },
            {
                label: "Actions",
                path: `https://${domain(provider)}/${owner}/${repo}/actions`,
                show: true,
                isActive: false,
                icon: CirclePlay,
            },
            {
                label: "Projects",
                path: `https://${domain(provider)}/${owner}/${repo}/projects`,
                show: repoData.hasProjects ?? false,
                isActive: false,
                icon: Table2,
            },
            {
                label: "Wiki",
                path: `https://${domain(provider)}/${owner}/${repo}/wiki`,
                show: repoData.hasWiki ?? false,
                isActive: false,
                icon: BookOpen,
            },
            {
                label: "Settings",
                path: `https://${domain(provider)}/${owner}/${repo}/settings`,
                show: repoData.permissions.admin ?? false,
                isActive: false,
                icon: Settings,
            },
        ];

        return allTabs.filter((t) => t.show);
    }, [repoData, provider, owner, repo, pathType]);
}

export function domain(provider: Provider) {
    return provider === "cb" ? "codeberg.org" : "github.com";
}
