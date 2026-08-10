import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "~/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
declare global {
    var dbConn: postgres.Sql | undefined;
}

const conn = globalThis.dbConn ?? postgres(env.DATABASE_URL);
if (env.NODE_ENV !== "production") globalThis.dbConn = conn;

export const db = drizzle(conn, { schema });
