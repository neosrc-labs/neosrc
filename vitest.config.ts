import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    resolve: {
        tsconfigPaths: true,
    },
    test: {
        include: ["src/**/*.test.{ts,tsx}"],
        environment: "jsdom",
        globals: true,
        setupFiles: ["./src/__tests__/setup.ts"],
    },
});
