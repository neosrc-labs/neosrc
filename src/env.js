import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
    /**
     * Specify your server-side environment variables schema here. This way you can ensure the app
     * isn't built with invalid env vars.
     */
    server: {
        BETTER_AUTH_SECRET: z.string(),
        BETTER_AUTH_URL: z.url(),
        GITHUB_CLIENT_ID: z.string(),
        GITHUB_CLIENT_SECRET: z.string(),
        CODEBERG_CLIENT_ID: z.string(),
        CODEBERG_CLIENT_SECRET: z.string(),
        DATABASE_URL: z.url(),
        DATA_ENCRYPTION_KEY: z.string().length(64).optional(),
        GITHUB_ANONYMOUS_TOKEN: z.string().optional(),
        GITHUB_APP_ID: z.string().optional(),
        GITHUB_APP_PRIVATE_KEY: z.string().optional(),
        GITHUB_APP_SLUG: z.string().optional(),
        REPORTS_OIDC_AUDIENCE: z.url().default("https://neosrc.dev"),
        // Only legal in development: NODE_ENV defaults to "development" when
        // unset, so a production deploy that sets the flag without setting
        // NODE_ENV must fail loudly instead of silently enabling the bypass.
        ALLOW_UNAUTHENTICATED_REPORTS: z
            .string()
            .optional()
            .refine(
                (value) =>
                    value === undefined ||
                    process.env.NODE_ENV === "development",
                "ALLOW_UNAUTHENTICATED_REPORTS may only be set when NODE_ENV=development",
            ),
        NODE_ENV: z
            .enum(["development", "test", "production"])
            .default("development"),
    },

    /**
     * Specify your client-side environment variables schema here. This way you can ensure the app
     * isn't built with invalid env vars. To expose them to the client, prefix them with
     * `NEXT_PUBLIC_`.
     */
    client: {
        // NEXT_PUBLIC_CLIENTVAR: z.string(),
    },

    /**
     * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
     * middlewares) or client-side so we need to destruct manually.
     */
    runtimeEnv: {
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
        CODEBERG_CLIENT_ID: process.env.CODEBERG_CLIENT_ID,
        CODEBERG_CLIENT_SECRET: process.env.CODEBERG_CLIENT_SECRET,
        DATABASE_URL: process.env.DATABASE_URL,
        DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
        GITHUB_ANONYMOUS_TOKEN: process.env.GITHUB_ANONYMOUS_TOKEN,
        GITHUB_APP_ID: process.env.GITHUB_APP_ID,
        GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
        GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG,
        REPORTS_OIDC_AUDIENCE: process.env.REPORTS_OIDC_AUDIENCE,
        ALLOW_UNAUTHENTICATED_REPORTS:
            process.env.ALLOW_UNAUTHENTICATED_REPORTS,
        NODE_ENV: process.env.NODE_ENV,
    },
    /**
     * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
     * useful for Docker builds.
     */
    skipValidation: !!process.env.SKIP_ENV_VALIDATION,
    /**
     * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
     * `SOME_VAR=''` will throw an error.
     */
    emptyStringAsUndefined: true,
});
