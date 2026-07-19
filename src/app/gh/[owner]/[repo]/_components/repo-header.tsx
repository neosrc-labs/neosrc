import { EyeIcon, GitForkIcon, StarIcon } from "lucide-react";

interface RepoHeaderProps {
    owner: string;
    repo: string;
    ownerAvatarUrl: string | null;
    isPrivate: boolean;
    stars: number;
    forks: number;
    watchers: number;
}

export function RepoHeader({
    owner,
    repo,
    ownerAvatarUrl,
    isPrivate,
    stars,
    forks,
    watchers,
}: RepoHeaderProps) {
    return (
        <div>
            <div className="flex flex-wrap items-center gap-4">
                {ownerAvatarUrl && (
                    <img
                        src={ownerAvatarUrl}
                        alt=""
                        className="h-8 w-8 rounded-full"
                    />
                )}
                <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-text-primary text-xl">
                        <span className="text-text-tertiary">{owner}</span>
                        <span className="text-text-tertiary"> / </span>
                        <span className="font-semibold">{repo}</span>
                    </h1>
                    <span className="inline-flex items-center rounded-full border border-border px-2.5 py-0.5 font-medium text-text-tertiary text-xs">
                        {isPrivate ? "Private" : "Public"}
                    </span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <a
                        href={`https://github.com/${owner}/${repo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-text-secondary text-xs transition hover:bg-surface-secondary"
                    >
                        <EyeIcon className="h-3.5 w-3.5" />
                        <span className="font-semibold text-text-primary">
                            {formatCount(watchers)}
                        </span>
                        <span>Watchers</span>
                    </a>
                    <a
                        href={`https://github.com/${owner}/${repo}/fork`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-text-secondary text-xs transition hover:bg-surface-secondary"
                    >
                        <GitForkIcon className="h-3.5 w-3.5" />
                        <span className="font-semibold text-text-primary">
                            {formatCount(forks)}
                        </span>
                        <span>Forks</span>
                    </a>
                    <a
                        href={`https://github.com/${owner}/${repo}/stargazers`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-text-secondary text-xs transition hover:bg-surface-secondary"
                    >
                        <StarIcon className="h-3.5 w-3.5" />
                        <span className="font-semibold text-text-primary">
                            {formatCount(stars)}
                        </span>
                        <span>Stars</span>
                    </a>
                </div>
            </div>
        </div>
    );
}

function formatCount(count: number): string {
    if (count >= 1000) {
        return `${(count / 1000).toFixed(1)}k`;
    }
    return String(count);
}
