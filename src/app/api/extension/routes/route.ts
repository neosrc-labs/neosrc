import { EXTENSION_ROUTE_TABLE } from "~/lib/extension-routes";

/**
 * Route coverage the extension is allowed to redirect, served so a browser that
 * already has the extension can pick up new routes without waiting for a store
 * release. The extension holds a baked copy and only swaps it out when this
 * responds with something it can validate.
 */
export function GET() {
    return Response.json(EXTENSION_ROUTE_TABLE, {
        headers: { "Cache-Control": "public, max-age=3600" },
    });
}
