"use client";

import { Key, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "~/trpc/react";
import { CreateKeyDialog, ProviderIcon } from "./create-key-dialog";

function PermissionBadge({
    permission,
}: {
    permission: { kind: string; target: string };
}) {
    const colonIndex = permission.target.indexOf(":");
    const provider =
        colonIndex !== -1 ? permission.target.slice(0, colonIndex) : null;
    const name =
        colonIndex !== -1
            ? permission.target.slice(colonIndex + 1)
            : permission.target;
    const prefix = permission.kind === "UPLOAD_REPORT_OWNER" ? "Owner" : "Repo";
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 text-xs dark:bg-blue-900 dark:text-blue-200">
            {prefix}: {provider && <ProviderIcon provider={provider} />} {name}
        </span>
    );
}

export function ApiKeysView() {
    const { data: keys, isLoading } = api.apiKeys.getAll.useQuery();
    const revokeKey = api.apiKeys.revoke.useMutation({
        onSuccess: () => {
            utils.apiKeys.getAll.invalidate();
        },
    });
    const utils = api.useUtils();
    const [showCreate, setShowCreate] = useState(false);
    const [confirmRevoke, setConfirmRevoke] = useState<number | null>(null);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="font-bold text-2xl text-gray-900 dark:text-gray-100">
                        API Keys
                    </h1>
                    <p className="mt-1 text-gray-500 text-sm dark:text-gray-400">
                        Manage API keys for programmatic access.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setShowCreate(true)}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                >
                    <Plus className="h-4 w-4" />
                    New Key
                </button>
            </div>

            {isLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="h-16 animate-pulse rounded-lg bg-gray-100 dark:bg-zinc-800"
                        />
                    ))}
                </div>
            ) : keys?.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border border-gray-300 border-dashed p-12 dark:border-zinc-700">
                    <Key className="h-8 w-8 text-gray-400" />
                    <p className="text-gray-500 text-sm dark:text-gray-400">
                        No API keys yet. Create one to get started.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {keys?.map((key) => (
                        <div
                            key={key.id}
                            className="rounded-lg border border-gray-200 p-4 dark:border-zinc-800"
                        >
                            <div className="flex items-start justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900 text-sm dark:text-gray-100">
                                            {key.name}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                        {key.permissions.map((p) => (
                                            <PermissionBadge
                                                key={`${key.id}-${p.kind}-${p.target}`}
                                                permission={p}
                                            />
                                        ))}
                                    </div>
                                    <div className="mt-1 flex items-center gap-3 text-gray-500 text-xs dark:text-gray-400">
                                        <span>
                                            Created{" "}
                                            {key.createdAt.toLocaleDateString()}
                                        </span>
                                        {key.expirationTimestamp && (
                                            <span>
                                                Expires{" "}
                                                {key.expirationTimestamp.toLocaleDateString()}
                                            </span>
                                        )}
                                        {key.expirationTimestamp &&
                                            new Date(key.expirationTimestamp) <
                                                new Date() && (
                                                <span className="text-red-600 dark:text-red-400">
                                                    Expired
                                                </span>
                                            )}
                                    </div>
                                </div>
                                {confirmRevoke === key.id ? (
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setConfirmRevoke(null)
                                            }
                                            className="cursor-pointer rounded px-2 py-1 text-gray-600 text-xs hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                revokeKey.mutate({
                                                    id: key.id,
                                                });
                                                setConfirmRevoke(null);
                                            }}
                                            className="cursor-pointer rounded bg-red-600 px-2 py-1 text-white text-xs hover:bg-red-700"
                                        >
                                            {revokeKey.isPending
                                                ? "..."
                                                : "Confirm"}
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setConfirmRevoke(key.id)}
                                        className="cursor-pointer rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                                        title="Revoke key"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreateKeyDialog
                open={showCreate}
                onClose={() => setShowCreate(false)}
            />
        </div>
    );
}
