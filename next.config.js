/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import { setDefaultResultOrder } from "node:dns";
import "./src/env.js";
import net from "node:net";

// This is due to some weird IPv6 issues with Codeberg.
net.setDefaultAutoSelectFamily(false);
// TODO: I think this could probably be removed
setDefaultResultOrder("ipv4first");

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
