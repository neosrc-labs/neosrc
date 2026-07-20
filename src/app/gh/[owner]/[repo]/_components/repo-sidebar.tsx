import { ActivityIcon, ExternalLinkIcon } from "lucide-react";

interface Contributor {
    login: string;
    avatarUrl: string;
}

interface RepoSidebarProps {
    owner: string;
    repo: string;
    description: string;
    homepage: string | null;
    language: string | null;
    topics: string[];
    license: { spdxId: string | null; name: string; url: string | null } | null;
    createdAt: string;
    contributors: Contributor[];
}

export function RepoSidebar({
    owner,
    repo,
    description,
    homepage,
    language,
    topics,
    license,
    createdAt,
    contributors,
}: RepoSidebarProps) {
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
                    {language && (
                        <div className="flex items-center gap-2 text-sm text-text-secondary">
                            <span
                                className="h-3 w-3 rounded-full"
                                style={{
                                    backgroundColor:
                                        languageColors[language] ?? "#6e7681",
                                }}
                            />
                            {language}
                        </div>
                    )}
                    <a
                        href={`https://github.com/${owner}/${repo}/activity`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary hover:underline"
                    >
                        <ActivityIcon className="h-3.5 w-3.5" />
                        Activity
                    </a>
                    <p className="text-sm text-text-secondary">
                        {getAgeText(createdAt)}
                    </p>
                </div>
            </div>

            {license && (
                <div className="mt-3 border-border border-t pt-3">
                    <h2 className="mb-2 font-semibold text-sm text-text-secondary uppercase">
                        License
                    </h2>
                    <p className="text-sm text-text-primary">
                        {license.spdxId ?? license.name}
                    </p>
                </div>
            )}

            {contributors.length > 0 && (
                <div className="mt-3 border-border border-t pt-3">
                    <h2 className="mb-3 font-semibold text-sm text-text-secondary uppercase">
                        Contributors
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                        {contributors.map((contributor) => (
                            <a
                                key={contributor.login}
                                href={`https://github.com/${contributor.login}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={contributor.login}
                            >
                                <img
                                    src={contributor.avatarUrl}
                                    alt={contributor.login}
                                    className="h-8 w-8 rounded-full"
                                />
                            </a>
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );
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
