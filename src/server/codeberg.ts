import { cache } from "react";

const CODEBERG_API = "https://codeberg.org";

export type CodebergUser = {
    id: number;
    login: string;
    username: string;
    full_name: string;
    email: string;
    avatar_url: string;
};

export const getUser = cache(async (accessToken: string) => {
    const res = await fetch(`${CODEBERG_API}/api/v1/user`, {
        headers: {
            Authorization: `token ${accessToken}`,
            Accept: "application/json",
        },
    });
    if (!res.ok) return null;
    return res.json() as Promise<CodebergUser>;
});
