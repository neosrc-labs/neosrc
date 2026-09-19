import { GitPullRequest, LogIn } from "lucide-react";
import { redirect } from "next/navigation";

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
                        <GitPullRequest className="h-8 w-8 text-action-foreground" />
                    </div>
                    <h1 className="text-4xl text-text-primary sm:text-5xl">
                        Review pull requests,
                        <br />
                        faster.
                    </h1>
                    <p className="max-w-lg text-lg text-text-secondary">
                        Neosrc is a refined UX for GitHub that is a drop in
                        replacement for Github.com
                    </p>
                </section>

                <section className="flex flex-col gap-6">
                    <h2 className="text-2xl text-text-primary">
                        How to use Neosrc
                    </h2>
                    <div className="flex flex-col gap-6">
                        <Step number={1} title="Sign in with GitHub">
                            Authenticate using your GitHub account. Neosrc
                            requests read access to your repositories and pull
                            requests.
                        </Step>
                        <Step number={2} title="Navigate to a pull request">
                            Go to{" "}
                            <code className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-sm text-text-primary">
                                /&#123;owner&#125;/&#123;repo&#125;/pull/&#123;number&#125;
                            </code>{" "}
                            in your browser.
                        </Step>
                        <Step number={3} title="Review code">
                            Browse the conversation timeline, read the diff with
                            syntax highlighting, leave inline comments, and
                            submit your review.
                        </Step>
                    </div>
                </section>

                <div className="flex flex-col items-center gap-4">
                    <form>
                        <button
                            className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-action px-6 py-3 font-semibold text-action-foreground transition hover:bg-action-hover"
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
                            <LogIn className="h-4 w-4" />
                            Sign in with GitHub
                        </button>
                    </form>
                    {isCodebergConfigured() && (
                        <form>
                            <button
                                className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-action px-6 py-3 font-semibold text-action-foreground transition hover:bg-action-hover"
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
                                <LogIn className="h-4 w-4" />
                                Sign in with Codeberg
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
}
