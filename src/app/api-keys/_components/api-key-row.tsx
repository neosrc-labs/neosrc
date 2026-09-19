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
        <div className="rounded-lg border border-border-subtle p-4">
            <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-text-primary">
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
                    <div className="mt-1 flex items-center gap-3 text-text-tertiary text-xs">
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
                                <span className="text-danger-text">
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
                            className="cursor-pointer rounded px-2 py-1 text-text-secondary text-xs hover:text-text-primary"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirmRevoke}
                            className="cursor-pointer rounded bg-destructive px-2 py-1 text-destructive-foreground text-xs hover:bg-destructive-hover"
                        >
                            {isRevoking ? "..." : "Confirm"}
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onClick={onRevoke}
                        className="cursor-pointer rounded p-1.5 text-text-muted transition-colors hover:bg-danger-surface hover:text-danger-text"
                        title="Revoke key"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                )}
            </div>
        </div>
    );
}
