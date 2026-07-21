"use client";

import {
    ActivityIcon,
    BookOpenIcon,
    Check,
    Circle,
    ExternalLinkIcon,
    HandshakeIcon,
    Loader2,
    ScaleIcon,
    TagIcon,
    UsersIcon,
    X,
} from "lucide-react";

import { UserHoverCard } from "~/components/hovercards/user-hover-card";
import { cn } from "~/lib/utils";
import { formatRelativeTime } from "~/utils";
import type { DocFileName } from "./repo-code-page";

interface Contributor {
    login: string;
    avatarUrl: string;
}

interface Deployment {
    id: number;
    environment: string;
    state: string;
    createdAt: string;
}

interface Release {
    name: string;
    tagName: string;
    createdAt: string;
    htmlUrl: string;
}

interface RepoSidebarProps {
    owner: string;
    repo: string;
    description: string;
    homepage: string | null;
    topics: string[];
    createdAt: string;
    contributors: Contributor[];
    docFileNames: DocFileName[];
    languages: Record<string, number>;
    deployments: Deployment[];
    latestRelease: Release | null;
}

export function RepoSidebar({
    owner,
    repo,
    description,
    homepage,
    topics,
    createdAt,
    contributors,
    docFileNames,
    languages,
    deployments,
    latestRelease,
}: RepoSidebarProps) {
    const licenseFiles = docFileNames.filter(
        (f) => getDocFileHashName(f.name) === "license",
    );
    const otherFiles = docFileNames.filter(
        (f) => getDocFileHashName(f.name) !== "license",
    );
    const firstLicense = licenseFiles[0];

    const allLangEntries = Object.entries(languages)
        .filter(([, bytes]) => bytes > 0)
        .sort(([, a], [, b]) => b - a);
    const langTotal = allLangEntries.reduce((sum, [, b]) => sum + b, 0);
    const langEntries =
        allLangEntries.length > 6 &&
        allLangEntries[6] &&
        (allLangEntries[6][1] / langTotal) * 100 < 1
            ? allLangEntries.slice(0, 6)
            : allLangEntries;

    return (
        <aside className="w-72 shrink-0">
            <div>
                <h2 className="mb-3 font-semibold text-sm text-text-secondary uppercase">
                    About
                </h2>

                {description && (
                    <p className="mb-3 text-sm text-text-primary leading-relaxed">
                        {description}
                    </p>
                )}

                {homepage && (
                    <a
                        href={homepage}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-3 inline-flex items-center gap-1.5 text-blue-600 text-sm hover:underline"
                    >
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                        {homepage.replace(/^https?:\/\//, "")}
                    </a>
                )}

                {topics.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                        {topics.map((topic) => (
                            <span
                                key={topic}
                                className="inline-block rounded-full bg-blue-500/10 px-2.5 py-0.5 text-blue-600 text-xs"
                            >
                                {topic}
                            </span>
                        ))}
                    </div>
                )}

                <div className="space-y-1.5">
                    {otherFiles.map((file) => {
                        const hashName = getDocFileHashName(file.name);
                        const Icon =
                            hashName === "code-of-conduct"
                                ? HandshakeIcon
                                : hashName === "contributing"
                                  ? UsersIcon
                                  : BookOpenIcon;
                        return (
                            <a
                                key={file.path}
                                href={`#${hashName}`}
                                className="flex items-start gap-1.5 text-sm text-text-secondary hover:text-text-primary hover:underline"
                            >
                                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{file.displayName}</span>
                            </a>
                        );
                    })}
                    {firstLicense && (
                        <a
                            href={`#${getDocFileHashName(firstLicense.name)}`}
                            className="flex items-start gap-1.5 text-sm text-text-secondary hover:text-text-primary hover:underline"
                        >
                            <ScaleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>
                                {firstLicense.displayName}
                                {licenseFiles.length > 1 &&
                                    ` and ${licenseFiles.length - 1} other license${licenseFiles.length - 1 === 1 ? "" : "s"} found`}
                            </span>
                        </a>
                    )}
                    <a
                        href={`https://github.com/${owner}/${repo}/activity`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-1.5 text-sm text-text-secondary hover:text-text-primary hover:underline"
                    >
                        <ActivityIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Activity
                    </a>
                    <p className="text-sm text-text-secondary">
                        {getAgeText(createdAt)}
                    </p>
                </div>
            </div>

            {latestRelease && (
                <div className="mt-3 border-border border-t pt-3">
                    <a
                        href={`https://github.com/${owner}/${repo}/releases`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sm text-text-secondary uppercase hover:text-text-primary hover:underline"
                    >
                        Releases
                    </a>
                    <div className="mt-3">
                        <a
                            href={latestRelease.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm hover:underline"
                        >
                            <div className="flex items-center gap-1.5">
                                <TagIcon className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                                <span className="truncate font-semibold text-text-primary">
                                    {latestRelease.name}
                                </span>
                                <span className="inline-block shrink-0 rounded-full bg-green-500/10 px-2 py-0.5 text-green-600 text-xs no-underline">
                                    Latest
                                </span>
                            </div>
                            <p
                                className="ml-5 text-text-tertiary text-xs"
                                title={new Date(
                                    latestRelease.createdAt,
                                ).toLocaleString()}
                            >
                                {formatRelativeTime(latestRelease.createdAt)}
                            </p>
                        </a>
                    </div>
                </div>
            )}

            {deployments.length > 0 && (
                <div className="mt-3 border-border border-t pt-3">
                    <a
                        href={`https://github.com/${owner}/${repo}/deployments`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sm text-text-secondary uppercase hover:text-text-primary hover:underline"
                    >
                        Deployments
                    </a>
                    <div className="mt-3 space-y-2">
                        {deployments.map((deployment) => (
                            <a
                                key={deployment.id}
                                href={`https://github.com/${owner}/${repo}/deployments/${deployment.environment}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-sm hover:underline"
                            >
                                <DeployStatusIcon
                                    state={deployment.state}
                                    className="h-3.5 w-3.5 shrink-0"
                                />
                                <span className="flex-1 font-semibold text-text-primary">
                                    {deployment.environment}
                                </span>
                                <span
                                    className="shrink-0 text-text-tertiary text-xs"
                                    title={new Date(
                                        deployment.createdAt,
                                    ).toLocaleString()}
                                >
                                    {formatRelativeTime(deployment.createdAt)}
                                </span>
                            </a>
                        ))}
                    </div>
                </div>
            )}

            {contributors.length > 0 && (
                <div className="mt-3 border-border border-t pt-3">
                    <a
                        href={`https://github.com/${owner}/${repo}/graphs/contributors`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sm text-text-secondary uppercase hover:text-text-primary hover:underline"
                    >
                        Contributors
                    </a>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                        {contributors.map((contributor) => (
                            <UserHoverCard
                                key={contributor.login}
                                login={contributor.login}
                            >
                                <a
                                    href={`https://github.com/${contributor.login}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <img
                                        src={contributor.avatarUrl}
                                        alt={contributor.login}
                                        className="h-8 w-8 rounded-full"
                                    />
                                </a>
                            </UserHoverCard>
                        ))}
                    </div>
                </div>
            )}

            {langEntries.length > 0 && (
                <div className="mt-3 border-border border-t pt-3">
                    <h2 className="mb-3 flex items-center gap-1.5 font-semibold text-sm text-text-secondary uppercase">
                        Languages
                    </h2>
                    <div className="flex h-2 overflow-hidden rounded-full">
                        {langEntries.map(([name, bytes]) => (
                            <span
                                key={name}
                                className="h-full"
                                style={{
                                    width: `${((bytes / langTotal) * 100).toFixed(1)}%`,
                                    backgroundColor:
                                        languageColors[name] ?? hashColor(name),
                                }}
                            />
                        ))}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {langEntries.map(([name, bytes]) => (
                            <span
                                key={name}
                                className="flex items-center gap-1 text-text-secondary text-xs"
                            >
                                <span
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{
                                        backgroundColor:
                                            languageColors[name] ??
                                            hashColor(name),
                                    }}
                                />
                                <span className="font-semibold text-text-primary">
                                    {name}
                                </span>{" "}
                                {((bytes / langTotal) * 100).toFixed(1)}%
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );
}

function DeployStatusIcon({
    state,
    className,
}: {
    state: string;
    className?: string;
}) {
    if (state === "success") {
        return <Check className={cn(className, "text-green-600")} />;
    }
    if (state === "failure" || state === "error") {
        return <X className={cn(className, "text-red-600")} />;
    }
    if (state === "in_progress" || state === "pending" || state === "queued") {
        return <Loader2 className={cn(className, "text-amber-500")} />;
    }
    return <Circle className={cn(className, "text-text-muted")} />;
}

function getDocFileHashName(name: string): string {
    if (/^readme/i.test(name)) return "readme";
    if (/^contributing/i.test(name)) return "contributing";
    if (/^code_of_conduct/i.test(name)) return "code-of-conduct";
    if (/^(licen[cs]e|copying)/i.test(name)) return "license";
    return name.toLowerCase().replace(/\.[^.]+$/, "");
}

function hashColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${hash % 360}, 55%, 55%)`;
}

function getAgeText(createdAt: string): string {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 30) return `${diffDays} days old`;
    if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? "s" : ""} old`;
    }
    const years = Math.floor(diffDays / 365);
    return `${years} year${years > 1 ? "s" : ""} old`;
}

const languageColors: Record<string, string> = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    Python: "#3572A5",
    Rust: "#dea584",
    Go: "#00ADD8",
    Java: "#b07219",
    Ruby: "#701516",
    C: "#555555",
    "C++": "#f34b7d",
    "C#": "#178600",
    HTML: "#e34c26",
    CSS: "#563d7c",
    SCSS: "#c6538c",
    Shell: "#89e051",
    PHP: "#4F5D95",
    Swift: "#F05138",
    Kotlin: "#A97BFF",
    Dart: "#00B4AB",
    Lua: "#000080",
    Haskell: "#5e5086",
    Elixir: "#6e4a7e",
    Clojure: "#db5855",
    Erlang: "#B83998",
    R: "#198CE7",
    Scala: "#c22d40",
    Julia: "#a270ba",
    Perl: "#0298c3",
    Zig: "#ec915c",
    Vue: "#41b883",
    Svelte: "#ff3e00",
    Markdown: "#083fa1",
    MDX: "#083fa1",
    Dockerfile: "#384d54",
    Makefile: "#427819",
    Nix: "#7e7eff",
    JSON: "#292929",
    YAML: "#cb171e",
    TOML: "#9c4221",
    XML: "#0060ac",
    JSONC: "#292929",
    JSON5: "#292929",
    Less: "#1d365d",
    Sass: "#c6538c",
    Stylus: "#ff6347",
    Nim: "#ffc200",
    OCaml: "#3be133",
};

export function RepoSidebarSkeleton() {
    return (
        <aside className="w-72 shrink-0">
            <div>
                <div className="mb-4 h-4 w-16 animate-pulse rounded bg-surface-secondary" />
                <div className="space-y-2">
                    <div className="h-3 w-full animate-pulse rounded bg-surface-secondary" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-surface-secondary" />
                </div>
            </div>
        </aside>
    );
}
