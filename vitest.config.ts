import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    resolve: {
        tsconfigPaths: true,
        alias: {
            // The marker package throws unless resolved under the react-server
            // condition. Tests run outside an RSC graph, so use its no-op entry.
            "server-only": fileURLToPath(
                new URL("./node_modules/server-only/empty.js", import.meta.url),
            ),
        },
    },
    test: {
        include: ["src/**/*.test.{ts,tsx}"],
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/__tests__/setup.ts"],
    },
});
