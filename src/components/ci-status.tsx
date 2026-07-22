"use client";

import { Check, Circle, CircleX, X } from "lucide-react";
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
    if (
        checks.some(
            (c) =>
                c.state === "IN_PROGRESS" ||
                c.state === "QUEUED" ||
                c.state === "PENDING" ||
                c.state === "EXPECTED",
        )
    ) {
        return "IN_PROGRESS";
    }
    return "SUCCESS";
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
    const totalSec = Math.floor(diffMs / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min > 0) {
        return `${min}m ${sec}s`;
    }
    return `${sec}s`;
}

function statusLabel(state: string): string | null {
    if (state === "SUCCESS") return "passed";
    if (state === "FAILURE") return "failed";
    if (state === "ERROR") return "error";
    if (state === "TIMED_OUT") return "timed out";
    if (state === "CANCELLED") return "cancelled";
    if (state === "SKIPPED") return "skipped";
    if (state === "NEUTRAL") return "neutral";
    if (state === "IN_PROGRESS" || state === "QUEUED") return null;
    return null;
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
    if (
        state === "IN_PROGRESS" ||
        state === "PENDING" ||
        state === "EXPECTED" ||
        state === "QUEUED"
    ) {
        return (
            <span className="check-pending-dot size-2.5 shrink-0 rounded-full" />
        );
    }
    return <Circle className={cn(className, "text-text-muted")} />;
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
                            <span>in {duration}</span>
                        </>
                    )}
                    {!label && !duration && context.description && (
                        <span className="truncate">{context.description}</span>
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
                        pending: 0,
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
                            default:
                                counts.pending++;
                                break;
                        }
                    }
                    const nonOk =
                        counts.failing +
                        counts.cancelled +
                        counts.skipped +
                        counts.pending;
                    const allPassed = nonOk === 0;
                    const parts: string[] = [];
                    if (counts.successful > 0)
                        parts.push(`${counts.successful} successful`);
                    if (counts.failing > 0)
                        parts.push(`${counts.failing} failing`);
                    if (counts.cancelled > 0)
                        parts.push(`${counts.cancelled} cancelled`);
                    if (counts.skipped > 0)
                        parts.push(`${counts.skipped} skipped`);
                    if (counts.pending > 0)
                        parts.push(`${counts.pending} pending`);
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
                                    {allPassed
                                        ? "All checks have passed"
                                        : "Some checks were not successful"}
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
        state: ((item.conclusion ?? item.status) as string).toUpperCase(),
        description: item.description ?? null,
        url: item.html_url ?? item.details_url ?? null,
        startedAt: item.started_at ?? null,
        completedAt: item.completed_at ?? null,
    }));
}
