"use client";

import { Key, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "~/trpc/react";
import { ApiKeyRow } from "./api-key-row";
import { CreateKeyDialog } from "./create-key-dialog";

export function ApiKeysView() {
    const utils = api.useUtils();
    const { data: keys, isLoading } = api.apiKeys.getAll.useQuery();
    const revokeKey = api.apiKeys.revoke.useMutation({
        onSuccess: () => {
            utils.apiKeys.getAll.invalidate();
        },
    });
    const [showCreate, setShowCreate] = useState(false);
    const [confirmRevoke, setConfirmRevoke] = useState<number | null>(null);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-text-primary">API Keys</h1>
                    <p className="mt-1 text-sm text-text-tertiary">
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
                    <Key className="h-8 w-8 text-text-muted" />
                    <p className="text-sm text-text-tertiary">
                        No API keys yet. Create one to get started.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3">
                    {keys?.map((key) => (
                        <ApiKeyRow
                            key={key.id}
                            apiKey={key}
                            showConfirmRevoke={confirmRevoke === key.id}
                            onRevoke={() => setConfirmRevoke(key.id)}
                            onCancelRevoke={() => setConfirmRevoke(null)}
                            onConfirmRevoke={() => {
                                revokeKey.mutate({ id: key.id });
                                setConfirmRevoke(null);
                            }}
                            isRevoking={revokeKey.isPending}
                        />
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
