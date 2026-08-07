import pino from "pino";

const isServer = typeof window === "undefined";
const isDev = process.env.NODE_ENV !== "production";

export const log = pino({
    level: process.env.NEXT_PUBLIC_LOG_LEVEL || "info",
    ...(isServer && isDev
        ? {
              transport: {
                  target: "pino-pretty",
                  options: {
                      colorize: true,
                  },
              },
          }
        : {}),
});
