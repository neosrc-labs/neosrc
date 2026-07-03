export interface ConventionalParts {
    type: string;
    scope: string | null;
    breaking: boolean;
    description: string;
}

export interface ParsedCommit {
    subject: string;
    body: string;
    conventional: ConventionalParts | null;
}

export const CONVENTIONAL_COMMIT_TYPES = [
    "feat",
    "fix",
    "perf",
    "refactor",
    "revert",
    "docs",
    "style",
    "test",
    "build",
    "ci",
    "chore",
] as const;

const SUBJECT_RE =
    /^(?<type>[a-zA-Z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?:\s*(?<description>.+)$/;

const BREAKING_FOOTER_RE =
    /^(BREAKING CHANGE|BREAKING-CHANGE):\s*(?<summary>.+)$/im;

export function parseCommitMessage(message: string): ParsedCommit {
    if (!message) {
        return { subject: "", body: "", conventional: null };
    }

    const newlineIdx = message.indexOf("\n");
    const subject = newlineIdx === -1 ? message : message.slice(0, newlineIdx);
    const body = newlineIdx === -1 ? "" : message.slice(newlineIdx + 1).trim();

    const match = SUBJECT_RE.exec(subject);
    if (!match?.groups) {
        return { subject, body, conventional: null };
    }

    const { type, scope, breaking, description } = match.groups;
    if (!type || description === undefined) {
        return { subject, body, conventional: null };
    }

    const hasBreakingBang = breaking === "!";
    const hasBreakingFooter = BREAKING_FOOTER_RE.test(body);

    return {
        subject,
        body,
        conventional: {
            type: type.toLowerCase(),
            scope: scope ?? null,
            breaking: hasBreakingBang || hasBreakingFooter,
            description,
        },
    };
}
