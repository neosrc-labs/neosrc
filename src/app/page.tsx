import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, getSession } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
    const session = await getSession();

    return (
        <HydrateClient>
            <main className="flex h-[calc(100svh-var(--header-height))] flex-col items-center justify-center bg-gradient-to-b from-white to-black text-white dark:from-zinc-800">
                <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
                    <h1 className="font-extrabold text-5xl tracking-tight sm:text-[5rem]">
                        Neosrc
                    </h1>
                    <div className="flex flex-col items-center gap-2">
                        <div className="flex flex-col items-center justify-center gap-4">
                            <p className="text-center text-2xl text-white">
                                {session && (
                                    <span>
                                        Logged in as {session.user?.name}
                                    </span>
                                )}
                            </p>
                            {!session ? (
                                <form>
                                    <button
                                        className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
                                        formAction={async () => {
                                            "use server";
                                            const res = await auth.api.signInSocial({
                                                body: {
                                                    provider: "github",
                                                    callbackURL: "/",
                                                },
                                            });
                                            if (!res.url) {
                                                throw new Error("No URL returned from signInSocial");
                                            }
                                            redirect(res.url);
                                        }}
                                    >
                                        Sign in with Github
                                    </button>
                                </form>
                            ) : (
                                <form>
                                    <button
                                        className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
                                        formAction={async () => {
                                            "use server";
                                            await auth.api.signOut({
                                                headers: await headers(),
                                            });
                                            redirect("/");
                                        }}
                                    >
                                        Sign out
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </HydrateClient>
    );
}
