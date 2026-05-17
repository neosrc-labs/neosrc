import { Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Async } from "~/components/async";
import { Label as LabelComponent } from "~/components/ui/label";
import { cn } from "~/lib/utils";
import type { Label, PullsGetResponseData } from "~/server/github";
import { api } from "~/trpc/react";
import { FieldSkeleton } from "./metadata-section";

type LabelOperation = { id: number; op: "add" | "remove"; label: Label };

export function LabelsSection({
    pullRequestPromise,
    owner,
    repo,
    number,
}: {
    pullRequestPromise: Promise<PullsGetResponseData>;
    owner: string;
    repo: string;
    number: number;
}) {
    // We use a list of operations made by the user to track the UI state.
    // Instead of trying to sync the state with the server constantly, which is quite difficult,
    // we just take the initial pull request labels and apply the operation log to it.
    // This allows us to optimistically update and handle users adding multiple in quick succession without racing on the server response.
    const [operations, setOperations] = useState<LabelOperation[]>([]);

    // If we reload the pull request we should remove all operations the user made and assume the new pull has the latest data.
    // biome-ignore lint/correctness/useExhaustiveDependencies: when the promise changes we reset the operations
    useEffect(() => {
        setOperations([]);
    }, [pullRequestPromise]);

    const { data: repoLabels } = api.pulls.listLabels.useQuery({ owner, repo });
    const addMutation = api.pulls.addLabel.useMutation();
    const removeMutation = api.pulls.removeLabel.useMutation();

    const labelsData = repoLabels ?? [];
    const handleAdd = (label: Label) => {
        const repoLabel = labelsData.find((l) => l.name === label.name);
        if (!repoLabel) return;

        const id = opId();
        setOperations((prev) => [...prev, { id, op: "add", label }]);
        addMutation.mutate(
            { owner, repo, number, label: label.name },
            {
                onError: () => {
                    setOperations((prev) => prev.filter((op) => op.id === id));
                },
            },
        );
    };

    const handleRemove = (label: Label) => {
        const id = opId();
        setOperations((prev) => [...prev, { id, op: "remove", label }]);
        removeMutation.mutate(
            { owner, repo, number, label: label.name },
            {
                onError: () => {
                    setOperations((prev) => prev.filter((op) => op.id === id));
                },
            },
        );
    };

    return (
        <>
            <div className="flex items-start justify-between">
                <h3 className="font-semibold text-gray-900 text-sm dark:text-zinc-100">
                    Labels
                </h3>
                <Async promise={pullRequestPromise} fallback={null}>
                    {(pullRequest) => (
                        <LabelSectionSettings
                            repoLabels={labelsData}
                            labels={pullRequest.labels}
                            operations={operations}
                            onAddLabel={handleAdd}
                            onRemoveLabel={handleRemove}
                        />
                    )}
                </Async>
            </div>
            <Async
                promise={pullRequestPromise}
                fallback={
                    <div className="mt-2">
                        <FieldSkeleton />
                    </div>
                }
            >
                {(pullRequest) => (
                    <LabelSectionContent
                        labels={pullRequest.labels}
                        operations={operations}
                        onRemoveLabel={handleRemove}
                    />
                )}
            </Async>
        </>
    );
}

function LabelSectionSettings({
    repoLabels,
    labels,
    operations,
    onAddLabel,
    onRemoveLabel,
}: {
    repoLabels: Label[];
    labels: Label[];
    operations: LabelOperation[];
    onAddLabel: (label: Label) => void;
    onRemoveLabel: (label: Label) => void;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // FIXME: ESC should close the popover
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
                setSearch("");
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const displayLabels = applyOperations(labels, operations);
    const currentNames = new Set(displayLabels.map((l) => l.name));
    const sortedLabels = useRef<typeof repoLabels>(null);
    if (open && repoLabels && !sortedLabels.current) {
        sortedLabels.current = [...repoLabels].sort((a, b) => {
            const aApplied = currentNames.has(a.name) ? 0 : 1;
            const bApplied = currentNames.has(b.name) ? 0 : 1;
            return aApplied - bApplied;
        });
    }
    if (!open) {
        sortedLabels.current = null;
    }
    const filteredLabels = (sortedLabels.current ?? repoLabels ?? []).filter(
        (l) => l.name.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                className="cursor-pointer rounded p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
                onClick={() => setOpen(!open)}
                type="button"
                aria-label="Manage labels"
            >
                <Settings size={14} />
            </button>
            {open && (
                <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                    <input
                        autoFocus
                        className="w-full border-gray-200 border-b px-3 py-2 text-sm outline-none placeholder:text-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter labels"
                        value={search}
                    />
                    <ul className="max-h-60 overflow-y-auto py-1">
                        {filteredLabels.length === 0 ? (
                            <li className="px-3 py-2 text-gray-400 text-xs">
                                No labels found
                            </li>
                        ) : (
                            filteredLabels.map((label) => {
                                const isApplied = currentNames.has(label.name);
                                return (
                                    <li
                                        className={cn(
                                            "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-zinc-800",
                                            isApplied &&
                                                "bg-blue-50 dark:bg-blue-950/30",
                                        )}
                                        key={label.name}
                                        onClick={() => {
                                            if (isApplied) {
                                                onRemoveLabel(label);
                                            } else {
                                                onAddLabel(label);
                                            }
                                        }}
                                        role="option"
                                        aria-selected={isApplied}
                                    >
                                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                            <div className="flex items-center gap-2">
                                                <LabelComponent
                                                    color={label.color}
                                                >
                                                    {label.name}
                                                </LabelComponent>
                                                {isApplied && (
                                                    <span className="shrink-0 text-blue-600 text-xs dark:text-blue-400">
                                                        &#10003;
                                                    </span>
                                                )}
                                            </div>
                                            {label.description && (
                                                <span className="truncate text-gray-400 text-xs">
                                                    {label.description}
                                                </span>
                                            )}
                                        </div>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}

function LabelSectionContent({
    labels,
    operations,
    onRemoveLabel,
}: {
    labels: Label[];
    operations: LabelOperation[];
    onRemoveLabel: (label: Label) => void;
}) {
    const displayLabels = applyOperations(labels, operations).sort((a, b) =>
        a.name.localeCompare(b.name),
    );

    if (displayLabels.length === 0) {
        return (
            <p className="text-gray-500 text-sm dark:text-zinc-400">
                No labels
            </p>
        );
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            {displayLabels.map((label) => (
                <div key={label.name}>
                    <LabelComponent color={label.color}>
                        {label.name}
                        <button
                            className="-mr-0.5 ml-0.5 inline-flex h-3 w-3 cursor-pointer items-center justify-center rounded-full text-current text-lg opacity-60 hover:opacity-100"
                            onClick={() => onRemoveLabel(label)}
                            type="button"
                            aria-label={`Remove label ${label.name}`}
                        >
                            &times;
                        </button>
                    </LabelComponent>
                </div>
            ))}
        </div>
    );
}

function applyOperations(
    labels: Label[],
    operations: LabelOperation[],
): Label[] {
    let updatedLabels = [...labels];

    for (const op of operations) {
        if (
            op.op === "add" &&
            !updatedLabels.some((l) => l.name === op.label.name)
        ) {
            updatedLabels.push(op.label);
        }
        if (op.op === "remove") {
            updatedLabels = updatedLabels.filter(
                (l) => l.name !== op.label.name,
            );
        }
    }

    return updatedLabels;
}

function opId() {
    return Math.floor(Math.random() * 10000000);
}
