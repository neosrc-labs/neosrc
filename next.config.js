/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
    async headers() {
        return [
            {
                source: "/material-icons/:path*",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=604800", // 7 day cache
                    },
                ],
            },
        ];
    },
};

export default config;
