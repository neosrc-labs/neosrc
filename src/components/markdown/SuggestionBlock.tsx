"use client";

import { Check, Code2 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "~/trpc/react";

interface SuggestionBlockProps {
    code: string;
    owner: string;
    repo: string;
    pullNumber?: number;
    path?: string;
    line?: number | null;
    startLine?: number | null;
    resolveThreadId?: string;
}

function DiffSnippet({ patch }: { patch: string }) {
    const parsed = useMemo(() => {
        const lines = patch.split("\n");
        const hunkHeader = lines[0] ?? "";
        const contentLines = lines.slice(1);
        const match = hunkHeader.match(/^@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
        let oldNum = match?.[1] ? Number(match[1]) : 0;
        let newNum = match?.[3] ? Number(match[3]) : 0;

        const rows = contentLines.map((line) => {
            const prefix = line.charAt(0);
            const text = line.slice(1);
            let type: "ctx" | "del" | "ins";
            let oldN: number | null;
            let newN: number | null;

            if (prefix === "-") {
                type = "del";
                oldN = oldNum++;
                newN = null;
            } else if (prefix === "+") {
                type = "ins";
                oldN = null;
                newN = newNum++;
            } else {
                type = "ctx";
                oldN = oldNum++;
                newN = newNum++;
            }

            return { type, text, oldN, newN };
        });

        const changedRows = rows.filter((r) => r.type !== "ctx");
        return { rows: changedRows };
    }, [patch]);

    return (
        <div className="overflow-x-auto">
            <table
                className="w-full table-fixed border-collapse font-mono text-[10px] leading-[14px]"
                style={{ margin: 0, borderSpacing: 0 }}
            >
                <tbody>
                    {parsed.rows.map((row) => {
                        const isDel = row.type === "del";
                        return (
                            <tr
                                key={`${row.oldN ?? ""}-${row.newN ?? ""}-${row.text}`}
                                className={
                                    isDel
                                        ? "bg-red-50 dark:bg-red-950"
                                        : "bg-green-50 dark:bg-green-950"
                                }
                            >
                                <td className="w-9 select-none pr-1 text-right text-text-muted">
                                    {row.oldN ?? ""}
                                </td>
                                <td className="w-9 select-none pr-1 text-right text-text-muted">
                                    {row.newN ?? ""}
                                </td>
                                <td
                                    className={`pl-2 ${isDel ? "text-red-800 dark:text-red-300" : "text-green-900 dark:text-green-200"}`}
                                >
                                    <div className="flex">
                                        <span className="w-4 flex-shrink-0 select-none">
                                            {isDel ? "-" : "+"}
                                        </span>
                                        <span className="whitespace-pre-wrap break-all">
                                            {row.text}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

export function SuggestionBlock({
    code,
    owner,
    repo,
    pullNumber,
    path,
    line,
    startLine,
    resolveThreadId,
}: SuggestionBlockProps) {
    const [applied, setApplied] = useState(false);
    const utils = api.useUtils();

    const hasFileContext = pullNumber != null && path != null && line != null;

    const { data: patchData } = api.reviewComments.suggestionPatch.useQuery(
        {
            owner,
            repo,
            number: pullNumber ?? 0,
            path: path ?? "",
            suggestionCode: code,
            line: line ?? 0,
            startLine: startLine ?? null,
        },
        {
            enabled: hasFileContext,
            staleTime: 60_000,
        },
    );

    const resolveMutation = api.reviewComments.resolveThread.useMutation({
        onSuccess: () => {
            utils.reviewComments.threads.invalidate();
            utils.reviewComments.list.invalidate({
                owner,
                repo,
                number: pullNumber ?? 0,
            });
        },
    });

    const handleResolve = () => {
        if (!resolveThreadId) return;
        resolveMutation.mutate(
            { threadId: resolveThreadId, resolve: true },
            {
                onSettled: () => {
                    setApplied(true);
                },
            },
        );
    };

    const applyMutation = api.reviewComments.applySuggestion.useMutation({
        onSuccess: () => {
            if (resolveThreadId) {
                handleResolve();
            } else {
                setApplied(true);
            }
        },
    });

    const isPending = applyMutation.isPending || resolveMutation.isPending;

    const handleApply = () => {
        if (
            pullNumber == null ||
            path == null ||
            line == null ||
            isPending ||
            applied
        )
            return;
        applyMutation.mutate({
            owner,
            repo,
            number: pullNumber,
            path: path,
            suggestionCode: code,
            line: line ?? undefined,
            startLine: startLine ?? undefined,
        });
    };

    const showApplyButton = hasFileContext;

    const patch = patchData?.patch;

    return (
        <div className="my-2 max-w-3xl overflow-hidden rounded-lg border border-border">
            <div className="flex items-center justify-between border-border border-b bg-surface-secondary px-2 py-1">
                <span className="flex items-center gap-1.5 font-medium text-text-secondary text-xs">
                    <Code2 size={14} />
                    Suggested changes
                </span>
                {showApplyButton && (
                    <button
                        type="button"
                        onClick={handleApply}
                        disabled={isPending || applied}
                        className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 font-medium text-xs transition-colors ${
                            applied
                                ? "border-gray-300 bg-surface-selected text-text-tertiary dark:border-zinc-600"
                                : "border-gray-300 bg-white text-text-label hover:bg-surface-tertiary dark:border-zinc-600 dark:hover:bg-zinc-700"
                        }`}
                    >
                        {applied ? (
                            <>
                                <Check size={12} />
                                Applied
                            </>
                        ) : isPending ? (
                            "Applying..."
                        ) : (
                            "Apply suggestion"
                        )}
                    </button>
                )}
            </div>
            {patch ? (
                <DiffSnippet patch={patch} />
            ) : (
                <div className="overflow-x-auto bg-zinc-50 p-2 font-mono text-[10px] dark:bg-zinc-900">
                    {code || "No code"}
                </div>
            )}
        </div>
    );
}
