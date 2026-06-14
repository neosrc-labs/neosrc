"use client";

import { useCallback, useState } from "react";
import { authClient } from "~/lib/auth-client";

export function AccountManager({
    githubUsername,
    codebergUsername,
}: {
    githubUsername: string | null;
    codebergUsername: string | null;
}) {
    const [providers, setProviders] = useState([
        {
            providerId: "github",
            label: "GitHub",
            username: githubUsername,
        },
        {
            providerId: "codeberg",
            label: "Codeberg",
            username: codebergUsername,
        },
    ]);
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleLink = useCallback(async (providerId: string) => {
        setLoading(providerId);
        setError(null);

        try {
            if (providerId === "github") {
                const { error } = await authClient.linkSocial({
                    provider: "github",
                    callbackURL: "/",
                });
                if (error) setError(error.message ?? "Failed to link GitHub");
            } else if (providerId === "codeberg") {
                const { error } = await authClient.oauth2.link({
                    providerId: "codeberg",
                    callbackURL: "/",
                });
                if (error) setError(error.message ?? "Failed to link Codeberg");
            }
        } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to link account");
        } finally {
            setLoading(null);
        }
    }, []);

    const handleUnlink = useCallback(async (providerId: string) => {
        setLoading(providerId);
        setError(null);

        try {
            const { error } = await authClient.unlinkAccount({
                providerId,
            });
            if (error) {
                setError(error.message ?? "Failed to unlink account");
                return;
            }

            setProviders((prev) =>
                prev.map((p) =>
                    p.providerId === providerId ? { ...p, username: null } : p,
                ),
            );
        } catch (e) {
            setError(
                e instanceof Error ? e.message : "Failed to unlink account",
            );
        } finally {
            setLoading(null);
        }
    }, []);

    const onlyOneLinked = providers.filter((p) => p.username).length <= 1;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="grid grid-cols-2 gap-3">
                {providers.map((provider) => (
                    <div
                        key={provider.providerId}
                        className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 dark:border-zinc-800"
                    >
                        <span className="font-medium text-gray-700 text-sm dark:text-gray-300">
                            {provider.label}
                        </span>
                        {provider.username ? (
                            <>
                                <span className="text-gray-500 text-xs dark:text-gray-400">
                                    @{provider.username}
                                </span>
                                <button
                                    type="button"
                                    disabled={
                                        loading === provider.providerId ||
                                        onlyOneLinked
                                    }
                                    onClick={() =>
                                        handleUnlink(provider.providerId)
                                    }
                                    className="cursor-pointer rounded-md border border-red-300 px-3 py-1 text-red-600 text-xs transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                                    title={
                                        onlyOneLinked
                                            ? "Cannot unlink your only sign-in method"
                                            : undefined
                                    }
                                >
                                    {loading === provider.providerId
                                        ? "Unlinking..."
                                        : "Unlink"}
                                </button>
                            </>
                        ) : (
                            <button
                                type="button"
                                disabled={loading === provider.providerId}
                                onClick={() => handleLink(provider.providerId)}
                                className="cursor-pointer rounded-md border border-gray-300 px-3 py-1 text-gray-700 text-xs transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
                            >
                                {loading === provider.providerId
                                    ? "Linking..."
                                    : "Link"}
                            </button>
                        )}
                    </div>
                ))}
            </div>
            {error && (
                <p className="text-red-600 text-xs dark:text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
}
