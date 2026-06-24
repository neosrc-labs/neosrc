import { Undo2 } from "lucide-react";
import Link from "next/link";
import { type PullRequestState, StatusPill } from "~/components/ui/status-pill";

export type RevertedByEntry = {
    number: number;
    title: string;
    url: string;
    owner: string;
    repo: string;
    state: string;
};

export function RevertedBanner({ revert }: { revert: RevertedByEntry }) {
    const href = `/gh/${revert.owner}/${revert.repo}/pull/${revert.number}`;
    const isOpen = revert.state === "OPEN";
    const isMerged = revert.state === "MERGED";

    const pillState: PullRequestState = isMerged
        ? "merged"
        : isOpen
          ? "open"
          : "closed";

    const message = isOpen
        ? "This pull request will be reverted by"
        : isMerged
          ? "This pull request was reverted in"
          : "A revert pull request was closed without merging in";

    return (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/30">
            <div className="flex items-center gap-2">
                <Undo2
                    className="text-amber-600 dark:text-amber-400"
                    size={14}
                />
                <span className="font-medium text-amber-700 text-sm dark:text-amber-300">
                    {message}{" "}
                    <Link
                        className="font-medium underline hover:text-amber-800 dark:hover:text-amber-200"
                        href={href}
                    >
                        #{revert.number}
                    </Link>
                    .
                </span>
            </div>
            <div className="mt-1 ml-6 flex w-fit items-center gap-2">
                <StatusPill state={pillState} />
                <Link
                    className="block truncate text-amber-600 text-xs hover:underline dark:text-amber-400"
                    href={href}
                    title={revert.title}
                >
                    {revert.title}
                </Link>
            </div>
        </div>
    );
}
