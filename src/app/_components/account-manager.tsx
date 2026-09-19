"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { authClient } from "~/utils/auth-client";

export type LinkedAccount = {
    accountId: string;
    providerId: "github" | "codeberg";
    username: string | null;
    connectionStatus: "active" | "reauth_required";
};

type ProviderId = LinkedAccount["providerId"];

const PROVIDERS: { providerId: ProviderId; label: string }[] = [
    { providerId: "github", label: "GitHub" },
    { providerId: "codeberg", label: "Codeberg" },
];

export function AccountManager({
    accounts: initialAccounts,
    codebergEnabled,
}: {
    accounts: LinkedAccount[];
    codebergEnabled: boolean;
}) {
    const [accounts, setAccounts] = useState(initialAccounts);
    const [loading, setLoading] = useState<ProviderId | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const providers = useMemo(
        () =>
            PROVIDERS.filter(
                ({ providerId }) =>
                    providerId !== "codeberg" ||
                    codebergEnabled ||
                    accounts.some(
                        (account) => account.providerId === "codeberg",
                    ),
            ),
        [accounts, codebergEnabled],
    );

    const handleLink = useCallback(async (providerId: ProviderId) => {
        setLoading(providerId);
        setError(null);

        try {
            const result =
                providerId === "github"
                    ? await authClient.linkSocial({
                          provider: "github",
                          callbackURL: "/profile?account=linked",
                          errorCallbackURL: "/profile?authError=link",
                      })
                    : await authClient.oauth2.link({
                          providerId: "codeberg",
                          callbackURL: "/profile?account=linked",
                          errorCallbackURL: "/profile?authError=link",
                      });
            if (result.error) {
                setError(
                    result.error.message ??
                        `Failed to link ${providerId === "github" ? "GitHub" : "Codeberg"}`,
                );
            }
        } catch (cause) {
            setError(
                cause instanceof Error
                    ? cause.message
                    : "Failed to link account",
            );
        } finally {
            setLoading(null);
        }
    }, []);

    const handleUnlink = useCallback(
        async (account: LinkedAccount) => {
            setLoading(account.providerId);
            setError(null);

            try {
                const { error } = await authClient.unlinkAccount({
                    providerId: account.providerId,
                    accountId: account.accountId,
                });
                if (error) {
                    setError(error.message ?? "Failed to unlink account");
                    return;
                }

                setAccounts((current) =>
                    current.filter(
                        ({ providerId }) => providerId !== account.providerId,
                    ),
                );
                router.refresh();
            } catch (cause) {
                setError(
                    cause instanceof Error
                        ? cause.message
                        : "Failed to unlink account",
                );
            } finally {
                setLoading(null);
            }
        },
        [router],
    );

    const onlyOneLinked =
        accounts.filter(({ connectionStatus }) => connectionStatus === "active")
            .length <= 1;

    return (
        <div className="flex flex-col items-center gap-3">
            <div className="grid grid-cols-2 gap-3">
                {providers.map((provider) => {
                    const account = accounts.find(
                        ({ providerId }) => providerId === provider.providerId,
                    );

                    return (
                        <div
                            key={provider.providerId}
                            className="flex flex-col items-center gap-2 rounded-lg border border-border-subtle px-4 py-3"
                        >
                            <span className="font-medium text-sm text-text-label">
                                {provider.label}
                            </span>
                            {account?.connectionStatus === "active" ? (
                                <>
                                    <span className="text-text-tertiary text-xs">
                                        {account.username
                                            ? `@${account.username}`
                                            : "Connected"}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={
                                            loading !== null || onlyOneLinked
                                        }
                                        onClick={() => handleUnlink(account)}
                                        className="cursor-pointer rounded-md border border-danger-border px-3 py-1 text-danger-text text-xs transition-colors hover:bg-danger-surface disabled:cursor-not-allowed disabled:opacity-40"
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
                                <>
                                    {account && (
                                        <span className="text-warning-text text-xs">
                                            Reconnect required
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        disabled={loading !== null}
                                        onClick={() =>
                                            handleLink(provider.providerId)
                                        }
                                        className="cursor-pointer rounded-md border border-border px-3 py-1 text-text-label text-xs transition-colors hover:bg-surface-tertiary disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {loading === provider.providerId
                                            ? account
                                                ? "Reconnecting..."
                                                : "Linking..."
                                            : account
                                              ? "Reconnect"
                                              : "Link"}
                                    </button>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
            {error && <p className="text-danger-text text-xs">{error}</p>}
        </div>
    );
}
