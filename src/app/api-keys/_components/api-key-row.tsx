"use client";

import { Trash2 } from "lucide-react";
import { PermissionBadge } from "./create-key-dialog";

interface ApiKeyRowProps {
    apiKey: {
        id: number;
        name: string;
        createdAt: Date;
        expirationTimestamp: Date | null;
        permissions: { kind: string; target: string }[];
    };
    showConfirmRevoke: boolean;
    onRevoke: () => void;
    onCancelRevoke: () => void;
    onConfirmRevoke: () => void;
    isRevoking: boolean;
}

export function ApiKeyRow({
    apiKey,
    showConfirmRevoke,
    onRevoke,
    onCancelRevoke,
    onConfirmRevoke,
    isRevoking,
}: ApiKeyRowProps) {
    return (
        <div className="rounded-lg border border-gray-200 p-4 dark:border-zinc-800">
            <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 text-sm dark:text-gray-100">
                            {apiKey.name}
                        </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        {apiKey.permissions.map((p) => (
                            <PermissionBadge
                                key={`${apiKey.id}-${p.kind}-${p.target}`}
                                permission={p}
                            />
                        ))}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-gray-500 text-xs dark:text-gray-400">
                        <span>
                            Created {apiKey.createdAt.toLocaleDateString()}
                        </span>
                        {apiKey.expirationTimestamp && (
                            <span>
                                Expires{" "}
                                {apiKey.expirationTimestamp.toLocaleDateString()}
                            </span>
                        )}
                        {apiKey.expirationTimestamp &&
                            new Date(apiKey.expirationTimestamp) <
                                new Date() && (
                                <span className="text-red-600 dark:text-red-400">
                                    Expired
                                </span>
                            )}
                    </div>
                </div>
                {showConfirmRevoke ? (
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onCancelRevoke}
                            className="cursor-pointer rounded px-2 py-1 text-gray-600 text-xs hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirmRevoke}
                            className="cursor-pointer rounded bg-red-600 px-2 py-1 text-white text-xs hover:bg-red-700"
                        >
                            {isRevoking ? "..." : "Confirm"}
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onRevoke}
                        className="cursor-pointer rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950 dark:hover:text-red-400"
                        title="Revoke key"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
