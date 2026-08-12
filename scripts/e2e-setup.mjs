// e2e:setup companion: applies what drizzle-kit push cannot express from
// schema.ts. The unique index on mv_user_repo_permissions is required by
// REFRESH MATERIALIZED VIEW CONCURRENTLY (the permission sync refreshes the
// view this way); it only exists in migration 0013, which push does not run.
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);

try {
    await sql.unsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS mv_user_repo_permissions_user_id_repo_id_idx
        ON mv_user_repo_permissions USING btree (user_id, repo_id)
    `);
    console.log("e2e setup: mv_user_repo_permissions unique index ensured");
} finally {
    await sql.end();
}
