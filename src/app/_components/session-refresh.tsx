"use client";

import { authClient } from "~/utils/auth-client";

export function SessionRefresh() {
    authClient.useSession();
    return null;
}
