// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useOptimisticOperationLog } from "./use-optimistic-operation-log";

type Operation = { id: number; value: string };

describe("useOptimisticOperationLog", () => {
    it("rolls back only the failed operation", () => {
        const { result } = renderHook(() =>
            useOptimisticOperationLog<Operation>("payload-a"),
        );
        let rollbackFirst = () => {};
        act(() => {
            rollbackFirst = result.current.begin((id) => ({
                id,
                value: "first",
            }));
            result.current.begin((id) => ({ id, value: "second" }));
        });

        act(rollbackFirst);

        expect(
            result.current.operations.map((operation) => operation.value),
        ).toEqual(["second"]);
    });

    it("clears operations when the source payload changes", () => {
        const { result, rerender } = renderHook(
            ({ payload }) => useOptimisticOperationLog<Operation>(payload),
            { initialProps: { payload: "payload-a" } },
        );
        act(() => {
            result.current.begin((id) => ({ id, value: "pending" }));
        });

        rerender({ payload: "payload-b" });

        expect(result.current.operations).toEqual([]);
    });
});
