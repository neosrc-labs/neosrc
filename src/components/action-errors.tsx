"use client";

import { AlertTriangle } from "lucide-react";
import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { cn } from "~/utils/helpers";

type ReportActionError = (key: string, message: string | null) => void;

interface ActionErrorContextValue {
    errors: ReadonlyMap<string, string>;
    report: ReportActionError;
    /** True while a pinned host owns the error row. */
    pinned: boolean;
    setPinned: (pinned: boolean) => void;
}

const ActionErrorContext = createContext<ActionErrorContextValue | null>(null);

/**
 * Collects failures from an action area so they render in a single row below
 * the buttons instead of squeezing between them.
 */
export function ActionErrorProvider({ children }: { children: ReactNode }) {
    const [errors, setErrors] = useState<ReadonlyMap<string, string>>(
        () => new Map(),
    );
    const [pinned, setPinned] = useState(false);

    const report = useCallback<ReportActionError>((key, message) => {
        setErrors((prev) => {
            if (message === null) {
                if (!prev.has(key)) return prev;
                const next = new Map(prev);
                next.delete(key);
                return next;
            }
            if (prev.get(key) === message) return prev;
            const next = new Map(prev);
            next.set(key, message);
            return next;
        });
    }, []);

    const value = useMemo(
        () => ({ errors, report, pinned, setPinned }),
        [errors, report, pinned],
    );

    return (
        <ActionErrorContext.Provider value={value}>
            {children}
        </ActionErrorContext.Provider>
    );
}

/** Mirrors `message` into the nearest provider while it is non-null. */
export function useActionError(key: string, message: string | null) {
    const report = useContext(ActionErrorContext)?.report;

    useEffect(() => {
        if (!report) return;
        report(key, message);
        return () => report(key, null);
    }, [report, key, message]);
}

/** Claims the error row for this host while `pinned` holds. */
export function useActionErrorPinned(pinned: boolean) {
    const setPinned = useContext(ActionErrorContext)?.setPinned;

    useEffect(() => {
        if (!setPinned) return;
        setPinned(pinned);
        return () => setPinned(false);
    }, [setPinned, pinned]);
}

export function ActionErrorBanner({
    pinned = false,
    className,
}: {
    /** Renders only while the action bar is pinned to the viewport. */
    pinned?: boolean;
    className?: string;
}) {
    const context = useContext(ActionErrorContext);
    const errors = context?.errors;
    if (!context || !errors || errors.size === 0) return null;
    // Static and pinned hosts both mount; only the active one renders.
    if (context.pinned !== pinned) return null;

    return (
        <ActionErrorRow className={className} messages={[...errors.values()]} />
    );
}

/** Banner row for callers that own their failures outright. */
export function ActionErrorRow({
    messages,
    className,
}: {
    messages: Array<string | null | undefined>;
    className?: string;
}) {
    const visible = [
        ...new Set(messages.filter((message): message is string => !!message)),
    ];
    if (visible.length === 0) return null;

    return (
        <div
            className={cn(
                "flex items-start gap-3 rounded-lg border border-danger-border bg-danger-surface px-4 py-2.5",
                className,
            )}
            role="alert"
        >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger-text" />
            <div className="min-w-0 space-y-1">
                {visible.map((message) => (
                    <p
                        key={message}
                        className="break-words font-medium text-danger-text text-sm"
                    >
                        {message}
                    </p>
                ))}
            </div>
        </div>
    );
}
