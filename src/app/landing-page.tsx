import { GitFork } from "lucide-react";
import { redirect } from "next/navigation";

import { CodebergIcon, GitHubIcon } from "~/components/icons";
import { Button } from "~/components/ui/button";
import { auth, isCodebergConfigured } from "~/server/auth";

function Step({
    number,
    title,
    children,
}: {
    number: number | string;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex gap-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-action font-semibold text-action-foreground text-sm">
                {number}
            </div>
            <div>
                <h3 className="text-text-primary">{title}</h3>
                <p className="mt-1 text-text-secondary">{children}</p>
            </div>
        </div>
    );
}

export function LandingPage({ authError }: { authError: string | null }) {
    return (
        <main className="mx-auto min-h-[calc(100svh-var(--header-height))] max-w-3xl px-6 py-16">
            <div className="flex flex-col gap-16">
                {authError && (
                    <p
                        className="rounded-md border border-danger-border bg-danger-surface px-4 py-3 text-danger-text text-sm"
                        role="alert"
                    >
                        {authError === "account_not_linked"
                            ? "An account already uses this email. Sign in with the provider you used originally, then connect GitHub from your profile."
                            : "Sign-in failed. Try again, or verify the provider connection settings."}
                    </p>
                )}
                <section className="flex flex-col items-center gap-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-action">
                        <GitFork className="h-8 w-8 text-action-foreground" />
                    </div>
                    <h1 className="text-4xl text-text-primary sm:text-5xl">
                        A unified UI
                        <br />
                        for Git forges.
                    </h1>
                    <p className="max-w-lg text-lg text-text-secondary">
                        Browse repositories, follow issues, and review pull
                        requests across GitHub and Codeberg in one consistent
                        interface. Your projects stay on the forge you choose.
                    </p>
                </section>

                <section className="flex flex-col gap-6">
                    <h2 className="text-2xl text-text-primary">
                        How to use Neosrc
                    </h2>
                    <div className="flex flex-col gap-6">
                        <Step number={1} title="Connect your accounts">
                            Sign in with GitHub or Codeberg, then link another
                            account from your profile to bring your work
                            together.
                        </Step>
                        <Step number={2} title="Explore your repositories">
                            Browse code and commit history, catch up on issues,
                            and open pull requests with the same familiar layout
                            across forges.
                        </Step>
                        <Step number={3} title="Keep up with your projects">
                            See recent issues and pull requests from your linked
                            accounts on your dashboard, then jump into a
                            discussion or code review.
                        </Step>
                    </div>
                </section>

                <div className="flex w-full max-w-xl flex-col justify-center gap-3 self-center sm:flex-row">
                    <form className="flex-1">
                        <Button
                            variant="outline"
                            className="h-12 w-full gap-3 rounded-xl px-5 text-text-primary shadow-xs"
                            type="submit"
                            formAction={async () => {
                                "use server";
                                const res = await auth.api.signInSocial({
                                    body: {
                                        provider: "github",
                                        callbackURL: "/onboarding",
                                        errorCallbackURL: "/?authError=sign-in",
                                    },
                                });
                                if (!res.url) {
                                    throw new Error(
                                        "No URL returned from signInSocial",
                                    );
                                }
                                redirect(res.url);
                            }}
                        >
                            <GitHubIcon className="size-5" />
                            Sign in with GitHub
                        </Button>
                    </form>
                    {isCodebergConfigured() && (
                        <form className="flex-1">
                            <Button
                                variant="outline"
                                className="h-12 w-full gap-3 rounded-xl px-5 text-text-primary shadow-xs"
                                type="submit"
                                formAction={async () => {
                                    "use server";
                                    const res = await auth.api.signInWithOAuth2(
                                        {
                                            body: {
                                                providerId: "codeberg",
                                                callbackURL: "/onboarding",
                                                errorCallbackURL:
                                                    "/?authError=sign-in",
                                            },
                                        },
                                    );
                                    if (!res.url) {
                                        throw new Error(
                                            "No URL returned from signInWithOAuth2",
                                        );
                                    }
                                    redirect(res.url);
                                }}
                            >
                                <CodebergIcon className="size-5 shrink-0" />
                                Sign in with Codeberg
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
}
