"use client";

import { Check, Circle, CircleSlash, CircleX, X } from "lucide-react";
import { formatDurationMs } from "~/components/hovercards/hover-card-shared";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "~/components/ui/hover-card";
import { cn } from "~/lib/utils";

export interface StatusContext {
    name: string;
    state: string;
    description: string | null;
    url: string | null;
    startedAt: string | null;
    completedAt: string | null;
}

// States that mean work is actively executing, versus states that mean work is
// only waiting for a runner. Kept separate so the UI can tell the two apart.
const RUNNING_STATES = new Set(["IN_PROGRESS"]);
const QUEUED_STATES = new Set(["QUEUED", "PENDING", "EXPECTED"]);

export function computeStatusState(
    checks: Array<{ state: string }>,
): string | null {
    if (checks.length === 0) return null;
    if (
        checks.some(
            (c) =>
                c.state === "FAILURE" ||
                c.state === "ERROR" ||
                c.state === "TIMED_OUT",
        )
    ) {
        return "FAILURE";
    }
    if (checks.some((c) => RUNNING_STATES.has(c.state))) {
        return "IN_PROGRESS";
    }
    if (checks.some((c) => QUEUED_STATES.has(c.state))) {
        return "QUEUED";
    }
    return "SUCCESS";
}

/** Canonical check state for a check run's status/conclusion pair. */
export function checkRunState(
    status: string,
    conclusion: string | null,
): string {
    return (conclusion ?? status).toUpperCase();
}

/** Headline for a checks hover card, keyed off the rolled-up state. */
export function statusHeadline(state: string | null): string {
    if (state === "SUCCESS") return "All checks have passed";
    if (state === "IN_PROGRESS") return "Some checks are still running";
    if (state === "QUEUED") return "Some checks are waiting to start";
    return "Some checks were not successful";
}

function formatDuration(
    startedAt: string,
    completedAt?: string | null,
): string | null {
    const start = new Date(startedAt).getTime();
    if (Number.isNaN(start)) return null;
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    if (Number.isNaN(end)) return null;
    const diffMs = end - start;
    if (diffMs < 1000) return null;
    return formatDurationMs(diffMs);
}

function statusLabel(state: string): string | null {
    if (state === "SUCCESS") return "passed";
    if (state === "FAILURE") return "failed";
    if (state === "ERROR") return "error";
    if (state === "TIMED_OUT") return "timed out";
    if (state === "CANCELLED") return "cancelled";
    if (state === "SKIPPED") return "skipped";
    if (state === "NEUTRAL") return "neutral";
    if (state === "IN_PROGRESS") return "running";
    if (state === "QUEUED" || state === "PENDING" || state === "EXPECTED") {
        return "queued";
    }
    return null;
}

// Running work: a spinning amber arc around a solid centre dot. The dot keeps
// the app's pending-dot language and stops a row of spinners reading as noise;
// the arc adds the motion that a bare dot lacks.
function RunningCheckIcon({ className }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={cn(
                className,
                "animate-spin text-yellow-500 motion-reduce:animate-none",
            )}
        >
            <circle cx="12" cy="12" r="3.5" fill="currentColor" />
            <circle
                cx="12"
                cy="12"
                r="9"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="42 15"
            />
        </svg>
    );
}

/**
 * Queued work: a muted static dot. Same footprint as the running icon so a
 * check flipping between the two states never shifts the row.
 */
export function CheckQueuedIcon({ className }: { className?: string }) {
    return (
        <span className={cn(className, "flex items-center justify-center")}>
            <span className="check-pending-dot size-2.5 shrink-0 rounded-full" />
        </span>
    );
}

export function StatusCheckIcon({
    state,
    className,
}: {
    state: string;
    className?: string;
}) {
    if (state === "SUCCESS") {
        return <Check className={cn(className, "text-green-600")} />;
    }
    if (state === "FAILURE" || state === "ERROR" || state === "TIMED_OUT") {
        return <X className={cn(className, "text-red-600")} />;
    }
    if (state === "CANCELLED") {
        return <CircleX className={cn(className, "text-text-muted")} />;
    }
    if (state === "SKIPPED") {
        return <CircleSlash className={cn(className, "text-text-muted")} />;
    }
    if (state === "IN_PROGRESS") {
        return <RunningCheckIcon className={className} />;
    }
    if (state === "QUEUED" || state === "PENDING" || state === "EXPECTED") {
        return <CheckQueuedIcon className={className} />;
    }
    return <Circle className={cn(className, "text-text-muted")} />;
}

/**
 * Icon for a check run's status/conclusion pair, the shape servers send for
 * GitHub check runs and Codeberg/status API contexts.
 */
export function CheckRunIcon({
    status,
    conclusion,
    className,
}: {
    status: string;
    conclusion: string | null;
    className?: string;
}) {
    return (
        <StatusCheckIcon
            state={checkRunState(status, conclusion)}
            className={className}
        />
    );
}

export function StatusContextRow({ context }: { context: StatusContext }) {
    const linkProps = context.url
        ? { href: context.url, target: "_blank", rel: "noreferrer" }
        : {};

    const duration =
        context.startedAt &&
        formatDuration(context.startedAt, context.completedAt);
    const label = statusLabel(context.state);

    return (
        <a
            {...linkProps}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface-tertiary"
        >
            <StatusCheckIcon
                state={context.state}
                className="size-3.5 shrink-0"
            />
            <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-text-primary">
                    {context.name}
                </div>
                <div className="flex items-center gap-1 text-text-tertiary">
                    {label && <span className="capitalize">{label}</span>}
                    {duration && (
                        <>
                            {label && <span>&middot;</span>}
                            <span>
                                {context.completedAt
                                    ? `in ${duration}`
                                    : `for ${duration}`}
                            </span>
                        </>
                    )}
                    {!duration && context.description && (
                        <>
                            {label && <span>&middot;</span>}
                            <span className="truncate">
                                {context.description}
                            </span>
                        </>
                    )}
                </div>
            </div>
        </a>
    );
}

export function StatusChecksHoverCard({
    contexts,
    className,
}: {
    contexts: StatusContext[];
    className?: string;
}) {
    const rollup = computeStatusState(contexts);
    if (!rollup) return null;

    return (
        <HoverCard openDelay={200}>
            <HoverCardTrigger asChild>
                <button
                    type="button"
                    className="flex cursor-pointer items-center"
                    tabIndex={-1}
                >
                    <StatusCheckIcon
                        state={rollup}
                        className={cn("size-4", className)}
                    />
                </button>
            </HoverCardTrigger>
            <HoverCardContent
                align="start"
                side="bottom"
                className="w-72 bg-surface p-0"
            >
                {(() => {
                    const counts = {
                        successful: 0,
                        failing: 0,
                        cancelled: 0,
                        skipped: 0,
                        running: 0,
                        queued: 0,
                    };
                    for (const ctx of contexts) {
                        switch (ctx.state) {
                            case "SUCCESS":
                                counts.successful++;
                                break;
                            case "FAILURE":
                            case "ERROR":
                            case "TIMED_OUT":
                                counts.failing++;
                                break;
                            case "CANCELLED":
                                counts.cancelled++;
                                break;
                            case "SKIPPED":
                                counts.skipped++;
                                break;
                            case "IN_PROGRESS":
                                counts.running++;
                                break;
                            default:
                                counts.queued++;
                                break;
                        }
                    }
                    const parts: string[] = [];
                    if (counts.successful > 0)
                        parts.push(`${counts.successful} successful`);
                    if (counts.failing > 0)
                        parts.push(`${counts.failing} failing`);
                    if (counts.cancelled > 0)
                        parts.push(`${counts.cancelled} cancelled`);
                    if (counts.skipped > 0)
                        parts.push(`${counts.skipped} skipped`);
                    if (counts.running > 0)
                        parts.push(`${counts.running} in progress`);
                    if (counts.queued > 0)
                        parts.push(`${counts.queued} queued`);
                    const summary =
                        parts.length > 1
                            ? parts.slice(0, -1).join(", ") +
                              ", and " +
                              parts[parts.length - 1]
                            : parts[0];
                    return (
                        <>
                            <div className="border-border-subtle border-b px-3 py-2">
                                <div className="font-medium text-xs">
                                    {statusHeadline(rollup)}
                                </div>
                                {summary && (
                                    <div className="mt-0.5 text-[11px] text-text-tertiary">
                                        {summary}
                                    </div>
                                )}
                            </div>
                            <div className="max-h-80 space-y-1.5 overflow-y-auto p-3">
                                {contexts.map((ctx) => (
                                    <StatusContextRow
                                        key={ctx.name}
                                        context={ctx}
                                    />
                                ))}
                            </div>
                        </>
                    );
                })()}
            </HoverCardContent>
        </HoverCard>
    );
}

export function mapChecksListToStatusContexts(
    items: Array<{
        name: string;
        conclusion: string | null;
        status: string;
        description?: string | null;
        html_url?: string;
        details_url?: string | null;
        started_at?: string | null;
        completed_at?: string | null;
    }>,
): StatusContext[] {
    return items.map((item) => ({
        name: item.name,
        state: checkRunState(item.status, item.conclusion),
        description: item.description ?? null,
        url: item.html_url ?? item.details_url ?? null,
        startedAt: item.started_at ?? null,
        completedAt: item.completed_at ?? null,
    }));
}
