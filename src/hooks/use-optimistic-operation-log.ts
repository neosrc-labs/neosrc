import { useCallback, useEffect, useState } from "react";
import { opId } from "~/utils/helpers";

/** Tracks optimistic operations and removes failed or stale entries. */
export function useOptimisticOperationLog<TOperation extends { id: number }>(
    resetKey: unknown,
) {
    const [operations, setOperations] = useState<TOperation[]>([]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: a new source payload invalidates the operation log
    useEffect(() => {
        setOperations([]);
    }, [resetKey]);

    const begin = useCallback((create: (id: number) => TOperation) => {
        const id = opId();
        const operation = create(id);
        setOperations((current) => [...current, operation]);
        return () => {
            setOperations((current) =>
                current.filter((candidate) => candidate.id !== id),
            );
        };
    }, []);

    return { operations, begin };
}
