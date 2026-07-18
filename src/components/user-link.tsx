import { UserHoverCard } from "~/components/hovercards/user-hover-card";

export function UserLink({
    actor,
    provider = "gh",
    onClick,
    showUsername = true,
}: {
    actor:
        | {
              __typename?: string;
              login: string;
              avatarUrl: string;
              url?: string;
          }
        | null
        | undefined;
    provider?: "gh" | "cb";
    onClick?: (e: React.MouseEvent) => void;
    showUsername?: boolean;
}) {
    if (!actor) return null;
    const isBot = actor.__typename === "Bot";
    return (
        <UserHoverCard login={actor.login} provider={provider}>
            <a
                className="flex cursor-pointer items-center gap-2"
                href={actor.url}
                onClick={(e) => {
                    if (onClick) {
                        e.preventDefault();
                        onClick(e);
                    }
                }}
            >
                <img
                    src={actor.avatarUrl}
                    alt={actor.login}
                    className="h-5 w-5 shrink-0 rounded-full object-cover"
                />
                {showUsername && (
                    <span className="font-medium text-gray-800 dark:text-zinc-200">
                        {actor.login}
                    </span>
                )}
                {isBot && (
                    <span className="rounded bg-zinc-200 px-1 font-medium text-[10px] text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                        bot
                    </span>
                )}
            </a>
        </UserHoverCard>
    );
}
