import type { IssueStateReason } from "~/server/api/routers/issues/types";
import { cn } from "~/utils/helpers";

type IssueState = "open" | "closed";

type IssueStatusPillProps = {
    state: IssueState;
    stateReason: IssueStateReason | null;
};

export function issueStateIconColor(
    state: IssueState,
    stateReason: IssueStateReason | null,
) {
    if (state === "open") return "text-state-issue-open";
    if (stateReason === "not_planned" || stateReason === "duplicate") {
        return "text-state-issue-inactive";
    }
    return "text-state-issue-completed";
}

export function issueStateLabel(
    state: IssueState,
    stateReason: IssueStateReason | null,
) {
    if (state === "open") return "Open issue";
    if (stateReason === "not_planned") return "Issue closed as not planned";
    if (stateReason === "duplicate") return "Issue closed as duplicate";
    return "Closed issue";
}

export function IssueStatusPill({ state, stateReason }: IssueStatusPillProps) {
    if (state === "open") {
        return (
            <Pill
                className="bg-state-issue-open"
                icon={
                    <IssueStateIcon
                        aria-hidden="true"
                        state={state}
                        stateReason={stateReason}
                    />
                }
            >
                Open
            </Pill>
        );
    }

    if (stateReason === "not_planned" || stateReason === "duplicate") {
        return (
            <Pill
                className="bg-state-issue-inactive"
                icon={
                    <IssueStateIcon
                        aria-hidden="true"
                        state={state}
                        stateReason={stateReason}
                    />
                }
            >
                Closed as{" "}
                {stateReason === "duplicate" ? "duplicate" : "not planned"}
            </Pill>
        );
    }

    return (
        <Pill
            className="bg-state-issue-completed"
            icon={
                <IssueStateIcon
                    aria-hidden="true"
                    state={state}
                    stateReason={stateReason}
                />
            }
        >
            Closed
        </Pill>
    );
}

function Pill({
    children,
    className,
    icon,
}: {
    children: React.ReactNode;
    className: string;
    icon: React.ReactNode;
}) {
    return (
        <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 font-semibold text-sm text-white leading-4 ${className}`}
        >
            {icon}
            {children}
        </span>
    );
}

type IssueStateIconProps = React.ComponentProps<"svg"> & {
    state: IssueState;
    stateReason: IssueStateReason | null;
};

export function IssueStateIcon({
    state,
    stateReason,
    className,
    ...props
}: IssueStateIconProps) {
    if (state === "open") {
        return (
            <svg
                className={cn("size-4 shrink-0 fill-current", className)}
                viewBox="0 0 16 16"
                {...props}
            >
                <title>{issueStateLabel(state, stateReason)}</title>
                <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
            </svg>
        );
    }

    if (stateReason === "not_planned" || stateReason === "duplicate") {
        return (
            <svg
                className={cn("size-4 shrink-0 fill-current", className)}
                viewBox="0 0 16 16"
                {...props}
            >
                <title>{issueStateLabel(state, stateReason)}</title>
                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm9.78-2.22-5.5 5.5a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734l5.5-5.5a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z" />
            </svg>
        );
    }

    return (
        <svg
            className={cn("size-4 shrink-0 fill-current", className)}
            viewBox="0 0 16 16"
            {...props}
        >
            <title>{issueStateLabel(state, stateReason)}</title>
            <path d="M11.28 6.78a.75.75 0 0 0-1.06-1.06L7.25 8.69 5.78 7.22a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.06 0l3.5-3.5Z" />
            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0Zm-1.5 0a6.5 6.5 0 1 0-13 0 6.5 6.5 0 0 0 13 0Z" />
        </svg>
    );
}
