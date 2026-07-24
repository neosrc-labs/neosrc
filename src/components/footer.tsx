import { GitHubIcon } from "~/components/github-icon";

export function Footer() {
    return (
        <footer className="bg-surface">
            <div className="mx-auto flex max-w-7xl items-center justify-center gap-6 px-6 py-8">
                <span className="text-sm text-text-muted">Neosrc</span>
                <a
                    href="https://neosrc.dev"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text-muted hover:text-text-secondary"
                >
                    neosrc.dev
                </a>
                <a
                    href="https://github.com/neosrc-labs/neosrc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-text-muted hover:text-text-secondary"
                >
                    <GitHubIcon className="size-4" />
                    GitHub
                </a>
            </div>
        </footer>
    );
}
