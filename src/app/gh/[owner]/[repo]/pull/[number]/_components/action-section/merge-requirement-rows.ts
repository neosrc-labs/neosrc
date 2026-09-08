import type { CheckRun, MergeRequirements } from "~/server/github";
import type { PullRequestMergeState } from "~/server/github-graphql";

export type MergeRequirementStatus = "passing" | "failing" | "pending";

export type MergeRequirementRow = {
    key: string;
    label: string;
    status: MergeRequirementStatus;
    url?: string | null;
    /** Set only on the `approvals` and `conversations` rows. */
    counts?: { actual: number; required: number };
};

/** CheckRun conclusions that leave a required check unsatisfied. */
const FAILING_CONCLUSIONS: Record<string, true> = {
    action_required: true,
    cancelled: true,
    failure: true,
    stale: true,
    startup_failure: true,
    timed_out: true,
};

const normalizeCheckName = (name: string) => name.trim().toLowerCase();

function checkRunStatus(match: CheckRun | undefined): MergeRequirementStatus {
    // A required check that has never reported is still outstanding.
    if (!match) return "pending";
    if (match.conclusion && FAILING_CONCLUSIONS[match.conclusion]) {
        return "failing";
    }
    if (match.status !== "completed") return "pending";
    return "passing";
}

/**
 * Expands the merge requirements GitHub reports into one row per gate, in the
 * order they are shown in the merge box. Rows whose requirement is not
 * configured are omitted entirely, as are rows whose state cannot be known
 * (a missing `mergeState` means unresolved threads and branch freshness are
 * unknowable, and guessing would show a false pass).
 */
export function buildMergeRequirementRows({
    requirements,
    mergeState,
    checkRuns,
    approvalCount,
    changesRequestedCount,
}: {
    requirements: MergeRequirements | null | undefined;
    mergeState: PullRequestMergeState | null | undefined;
    checkRuns: CheckRun[];
    approvalCount: number;
    changesRequestedCount: number;
}): MergeRequirementRow[] {
    const rows: MergeRequirementRow[] = [];
    if (!requirements) return rows;

    const requiredApprovals = requirements.requiredApprovingReviewCount;
    if (requiredApprovals > 0) {
        rows.push({
            key: "approvals",
            label: `${approvalCount} of ${requiredApprovals} approving reviews`,
            status: approvalCount >= requiredApprovals ? "passing" : "pending",
            counts: { actual: approvalCount, required: requiredApprovals },
        });
    }

    if (changesRequestedCount > 0) {
        rows.push({
            key: "changes-requested",
            label: `${changesRequestedCount} review${
                changesRequestedCount === 1 ? "" : "s"
            } requesting changes`,
            status: "failing",
            counts: { actual: changesRequestedCount, required: 0 },
        });
    }

    const reviewApproved = mergeState?.reviewDecision === "APPROVED";

    if (requirements.requiresCodeOwnerReview) {
        rows.push({
            key: "code-owners",
            label: "Code owner review required",
            status: reviewApproved ? "passing" : "pending",
        });
    }

    if (requirements.requiresLastPushApproval) {
        rows.push({
            key: "last-push-approval",
            label: "Latest push must be approved by someone else",
            status: reviewApproved ? "passing" : "pending",
        });
    }

    if (requirements.requiresConversationResolution && mergeState) {
        const unresolved = mergeState.unresolvedThreadCount;
        rows.push({
            key: "conversations",
            label:
                unresolved > 0
                    ? `${unresolved} unresolved conversation${
                          unresolved === 1 ? "" : "s"
                      }`
                    : "All conversations resolved",
            status: unresolved > 0 ? "failing" : "passing",
            counts: { actual: unresolved, required: 0 },
        });
    }

    if (requirements.requiresUpToDateBranch && mergeState) {
        const behind = mergeState.mergeStateStatus === "BEHIND";
        rows.push({
            key: "up-to-date",
            label: behind
                ? "This branch is out of date with the base branch"
                : "Branch is up to date",
            status: behind ? "failing" : "passing",
        });
    }

    // GraphQL `isRequired` is authoritative about which contexts gate this
    // PR, so its rows win. Names it did not report still come from the
    // ruleset/protection list so the requirement stays visible when the
    // GraphQL read was unavailable.
    const emitted = new Set<string>();
    for (const check of mergeState?.requiredChecks ?? []) {
        emitted.add(normalizeCheckName(check.name));
        rows.push({
            key: `check:${check.name}`,
            label: check.name,
            status:
                check.status === "success"
                    ? "passing"
                    : check.status === "failure"
                      ? "failing"
                      : "pending",
            url: check.url,
        });
    }

    for (const name of requirements.requiredChecks) {
        const normalized = normalizeCheckName(name);
        if (emitted.has(normalized)) continue;
        emitted.add(normalized);
        const match = checkRuns.find(
            (run) => normalizeCheckName(run.name) === normalized,
        );
        rows.push({
            key: `check:${name}`,
            label: name,
            status: checkRunStatus(match),
            url: match?.html_url ?? match?.details_url ?? null,
        });
    }

    return rows;
}

/**
 * Condenses the rows into the one-line merge pill text. Reads the rows only,
 * so the pill and the popover can never disagree.
 */
export function summarizeMergeRequirements(
    rows: MergeRequirementRow[],
    pendingReviewerCount: number,
): string[] {
    const byKey = (key: string) => rows.find((row) => row.key === key);
    const parts: string[] = [];

    const approvals = byKey("approvals");
    if (approvals?.counts && approvals.status !== "passing") {
        parts.push(
            `${approvals.counts.actual}/${approvals.counts.required} approvals`,
        );
    }

    const changesRequested = byKey("changes-requested");
    if (changesRequested?.counts) {
        const count = changesRequested.counts.actual;
        parts.push(`${count} change${count === 1 ? "" : "s"} requested`);
    }

    if (pendingReviewerCount > 0) {
        parts.push(`${pendingReviewerCount} pending`);
    }

    const codeOwners = byKey("code-owners");
    if (codeOwners && codeOwners.status !== "passing") {
        parts.push("Code owner review");
    }

    const lastPush = byKey("last-push-approval");
    if (lastPush && lastPush.status !== "passing") {
        parts.push("Last push approval");
    }

    const conversations = byKey("conversations");
    if (conversations?.status === "failing" && conversations.counts) {
        parts.push(`${conversations.counts.actual} unresolved`);
    }

    if (byKey("up-to-date")?.status === "failing") {
        parts.push("Out of date");
    }

    let failingChecks = 0;
    let pendingChecks = 0;
    for (const row of rows) {
        if (!row.key.startsWith("check:")) continue;
        if (row.status === "failing") failingChecks++;
        if (row.status === "pending") pendingChecks++;
    }
    if (failingChecks > 0) {
        parts.push(
            `${failingChecks} check${failingChecks === 1 ? "" : "s"} failing`,
        );
    }
    if (pendingChecks > 0) {
        parts.push(
            `${pendingChecks} check${pendingChecks === 1 ? "" : "s"} pending`,
        );
    }

    return parts;
}
