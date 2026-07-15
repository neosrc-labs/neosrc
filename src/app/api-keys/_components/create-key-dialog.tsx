"use client";

import { Check, Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { SearchableDropdown } from "~/components/ui/searchable-dropdown";
import { parseTarget } from "~/lib/utils";
import { api } from "~/trpc/react";

type PermissionKind = "UPLOAD_REPORT_OWNER" | "UPLOAD_REPORT_REPO";

interface ClientPermission {
    id: string;
    kind: PermissionKind;
    target: string;
}

let permIdCounter = 0;
function newPermId(): string {
    return `perm-${++permIdCounter}`;
}

export function PermissionBadge({
    permission,
}: {
    permission: { kind: string; target: string };
}) {
    const { provider, name } = parseTarget(permission.target);
    const prefix = permission.kind === "UPLOAD_REPORT_OWNER" ? "Owner" : "Repo";
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-800 text-xs dark:bg-blue-900 dark:text-blue-200">
            {prefix}: {provider && <ProviderIcon provider={provider} />} {name}
        </span>
    );
}

function ProviderIcon({ provider }: { provider: string }) {
    if (provider === "codeberg") {
        return (
            <img
                src="/logo-codeberg.svg"
                alt=""
                className="size-4 invert-[.5] dark:invert-[.6]"
                aria-hidden="true"
            />
        );
    }
    return (
        <svg
            viewBox="0 0 24 24"
            className="size-4 fill-current text-text-tertiary"
            aria-hidden="true"
        >
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
    );
}

function CopyButton({ text }: { text: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = useCallback(async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [text]);

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="inline-flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-text-tertiary text-xs transition-colors hover:bg-surface-tertiary hover:text-text-label dark:hover:text-zinc-200"
        >
            {copied ? (
                <Check className="h-3 w-3" />
            ) : (
                <Copy className="h-3 w-3" />
            )}
            {copied ? "Copied" : "Copy"}
        </button>
    );
}

interface CreateKeyDialogProps {
    open: boolean;
    onClose: () => void;
    onCreated?: () => void;
}

export function CreateKeyDialog({
    open,
    onClose,
    onCreated,
}: CreateKeyDialogProps) {
    const utils = api.useUtils();
    const createKey = api.apiKeys.create.useMutation({
        onSuccess: () => {
            utils.apiKeys.getAll.invalidate();
        },
    });

    const { data: allRepos = [] } = api.repos.getAllMyRepos.useQuery(
        undefined,
        { enabled: open },
    );

    const [name, setName] = useState("");
    const [permissions, setPermissions] = useState<ClientPermission[]>([
        { id: newPermId(), kind: "UPLOAD_REPORT_OWNER", target: "" },
    ]);
    const [expiration, setExpiration] = useState("");
    const [createdKey, setCreatedKey] = useState<string | null>(null);
    const [showKey, setShowKey] = useState(false);

    if (!open) return null;

    const handleAddPermission = () => {
        setPermissions([
            ...permissions,
            { id: newPermId(), kind: "UPLOAD_REPORT_OWNER", target: "" },
        ]);
    };

    const handleRemovePermission = (id: string) => {
        setPermissions(permissions.filter((p) => p.id !== id));
    };

    const handlePermissionKindChange = (id: string, kind: string) => {
        const updated = permissions.map((p) =>
            p.id === id ? { id, kind: kind as PermissionKind, target: "" } : p,
        );
        setPermissions(updated);
    };

    const handlePermissionTargetChange = (id: string, target: string) => {
        const updated = permissions.map((p) =>
            p.id === id ? { ...p, target } : p,
        );
        setPermissions(updated);
    };

    const handleSubmit = async () => {
        const result = await createKey.mutateAsync({
            name,
            permissions: permissions.map((p) => {
                if (p.kind === "UPLOAD_REPORT_OWNER") {
                    return { kind: "UPLOAD_REPORT_OWNER" as const };
                }
                return {
                    kind: "UPLOAD_REPORT_REPO" as const,
                    target: p.target.trim(),
                };
            }),
            expirationTimestamp: expiration
                ? new Date(expiration).toISOString()
                : null,
        });
        setCreatedKey(result.rawKey);
    };

    const handleDone = () => {
        setCreatedKey(null);
        setName("");
        setPermissions([
            { id: newPermId(), kind: "UPLOAD_REPORT_OWNER", target: "" },
        ]);
        setExpiration("");
        setShowKey(false);
        onCreated?.();
        onClose();
    };

    if (createdKey) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                <div className="mx-4 w-full max-w-lg rounded-lg bg-surface-elevated p-6 shadow-xl">
                    <h2 className="mb-4 text-text-primary">API Key Created</h2>
                    <p className="mb-2 text-sm text-text-secondary">
                        Make sure to copy your API key now. You won&apos;t be
                        able to see it again.
                    </p>
                    <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface-secondary p-3">
                        <code className="flex-1 break-all font-mono text-sm text-text-primary">
                            {showKey ? createdKey : "••••••••••••••••"}
                        </code>
                        <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="cursor-pointer p-1 text-text-tertiary hover:text-text-label dark:hover:text-zinc-200"
                            aria-label={showKey ? "Hide key" : "Show key"}
                        >
                            {showKey ? (
                                <EyeOff className="h-4 w-4" />
                            ) : (
                                <Eye className="h-4 w-4" />
                            )}
                        </button>
                        <CopyButton text={createdKey} />
                    </div>
                    <button
                        type="button"
                        onClick={handleDone}
                        className="w-full cursor-pointer rounded-lg bg-gray-900 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-gray-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                        Done
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface-elevated p-6 shadow-xl">
                <h2 className="mb-4 text-text-primary">Create API Key</h2>

                <div className="mb-4">
                    <label
                        htmlFor="key-name"
                        className="mb-1 block font-medium text-sm text-text-label"
                    >
                        Name
                    </label>
                    <input
                        id="key-name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="My API Key"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-text-primary placeholder-gray-400 focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:placeholder-zinc-500"
                    />
                </div>

                <div className="mb-4">
                    <fieldset>
                        <legend className="mb-1 block font-medium text-sm text-text-label">
                            Permissions
                        </legend>
                        <div className="flex flex-col gap-2">
                            {permissions.map((perm) => (
                                <div
                                    key={perm.id}
                                    className="flex items-center gap-2"
                                >
                                    <select
                                        id={`${perm.id}-kind`}
                                        value={perm.kind}
                                        onChange={(e) =>
                                            handlePermissionKindChange(
                                                perm.id,
                                                e.target.value,
                                            )
                                        }
                                        className="rounded-lg border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                                    >
                                        <option value="UPLOAD_REPORT_OWNER">
                                            Upload Report (Owner)
                                        </option>
                                        <option value="UPLOAD_REPORT_REPO">
                                            Upload Report (Repo)
                                        </option>
                                    </select>
                                    {perm.kind === "UPLOAD_REPORT_OWNER" ? (
                                        <span className="flex-1 text-sm text-text-tertiary">
                                            All linked providers
                                        </span>
                                    ) : (
                                        <div className="flex-1">
                                            <SearchableDropdown<{
                                                provider: string;
                                                owner: string;
                                                name: string;
                                                fullName: string;
                                            }>
                                                items={allRepos}
                                                isSelected={(item) =>
                                                    perm.target ===
                                                    `${item.provider}:${item.fullName}`
                                                }
                                                onSelect={(item) =>
                                                    handlePermissionTargetChange(
                                                        perm.id,
                                                        `${item.provider}:${item.fullName}`,
                                                    )
                                                }
                                                keyFn={(item) =>
                                                    `${item.provider}:${item.fullName}`
                                                }
                                                searchFn={(item, query) =>
                                                    item.fullName
                                                        .toLowerCase()
                                                        .includes(
                                                            query.toLowerCase(),
                                                        ) ||
                                                    item.provider
                                                        .toLowerCase()
                                                        .includes(
                                                            query.toLowerCase(),
                                                        )
                                                }
                                                renderItem={(item) => (
                                                    <span className="flex items-center gap-1.5 text-sm text-text-primary">
                                                        <ProviderIcon
                                                            provider={
                                                                item.provider
                                                            }
                                                        />
                                                        {item.fullName}
                                                    </span>
                                                )}
                                                placeholder="Search repos..."
                                                emptyText="No repos found"
                                                ariaLabel="Select a repository"
                                                trigger={
                                                    <div className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-3 text-sm text-text-primary hover:border-gray-400 dark:border-zinc-700 dark:hover:border-zinc-600">
                                                        {perm.target ? (
                                                            <span className="flex items-center gap-1.5 text-sm text-text-primary">
                                                                <ProviderIcon
                                                                    provider={
                                                                        perm.target.split(
                                                                            ":",
                                                                        )[0] ??
                                                                        ""
                                                                    }
                                                                />
                                                                {perm.target.split(
                                                                    ":",
                                                                )[1] ??
                                                                    perm.target}
                                                            </span>
                                                        ) : (
                                                            <span className="text-text-muted">
                                                                Select a repo...
                                                            </span>
                                                        )}
                                                    </div>
                                                }
                                                closeOnSelect
                                            />
                                        </div>
                                    )}
                                    {permissions.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemovePermission(perm.id)
                                            }
                                            className="cursor-pointer p-1 text-text-muted hover:text-red-500"
                                            aria-label="Remove permission"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={handleAddPermission}
                            className="mt-2 cursor-pointer text-blue-600 text-sm hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                            + Add permission
                        </button>
                    </fieldset>
                </div>

                <div className="mb-6">
                    <label
                        htmlFor="key-expiration"
                        className="mb-1 block font-medium text-sm text-text-label"
                    >
                        Expiration (optional)
                    </label>
                    <input
                        id="key-expiration"
                        type="datetime-local"
                        value={expiration}
                        onChange={(e) => setExpiration(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 cursor-pointer rounded-lg border border-gray-300 px-4 py-2 font-medium text-sm text-text-label transition-colors hover:bg-surface-tertiary dark:border-zinc-700"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={
                            !name ||
                            permissions.some(
                                (p) =>
                                    p.kind === "UPLOAD_REPORT_REPO" &&
                                    !p.target,
                            ) ||
                            createKey.isPending
                        }
                        className="flex-1 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-600"
                    >
                        {createKey.isPending ? "Creating..." : "Create"}
                    </button>
                </div>
                {createKey.error && (
                    <p className="mt-2 text-red-600 text-xs dark:text-red-400">
                        {createKey.error.message}
                    </p>
                )}
            </div>
        </div>
    );
}
