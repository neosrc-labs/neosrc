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
import { cn } from "~/lib/utils";

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
 * Collects failures from the action row so they render in a single row below
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
        <div
            className={cn(
                "flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 dark:border-red-500/20 dark:bg-red-500/10",
                className,
            )}
            role="alert"
        >
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
            <div className="min-w-0 space-y-1">
                {[...errors].map(([key, message]) => (
                    <p
                        key={key}
                        className="break-words font-medium text-red-700 text-sm dark:text-red-300"
                    >
                        {message}
                    </p>
                ))}
            </div>
        </div>
    );
}
