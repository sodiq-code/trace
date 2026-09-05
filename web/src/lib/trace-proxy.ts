/**
 * Shared proxy helper for the Next.js API routes.
 *
 * Strategy (per blueprint §28.3 — Python service on a public host, Next.js on
 * Vercel):
 *
 *  1. LOCAL DEV: proxy to the local FastAPI service (127.0.0.1:8000) for real
 *     C2PA stamping via c2pa-python.
 *  2. PRODUCTION (Vercel): proxy to the PUBLIC Trace backend URL set in the
 *     `TRACE_PUBLIC_API_URL` environment variable (the FastAPI service exposed
 *     through the gateway with `?XTransformPort=8000`). This gives the
 *     Vercel dashboard REAL cryptographic stamping — not demo data.
 *  3. FALLBACK: if neither backend is reachable, return null so the calling
 *     route can fall back to bundled demo data (keeps the page from 500ing if
 *     the backend is briefly down).
 *
 * Every browser request stays same-origin (/api/v1/* → Next.js route →
 * backend), so there are no absolute URLs in client code and no CORS issues
 * for the browser.
 */

/** Local FastAPI base (dev only). */
const TRACE_PORT = process.env.TRACE_API_PORT || "8000";
const LOCAL_BASE = `http://127.0.0.1:${TRACE_PORT}`;

/**
 * Public Trace backend URL (production). Set this as a Vercel env var
 * `TRACE_PUBLIC_API_URL`. Must already include the gateway's
 * `?XTransformPort=8000` query if the backend sits behind a port-transform
 * gateway. Example:
 *   TRACE_PUBLIC_API_URL=https://host.example/v1?XTransformPort=8000
 *
 * When set, all backend calls are appended to this base. When unset, the
 * proxy tries the local service first, then falls back to demo data.
 */
const PUBLIC_BASE = process.env.TRACE_PUBLIC_API_URL || "";

/**
 * Resolve the absolute backend URL for a given V1 path.
 *
 * - In production (PUBLIC_BASE set): returns `${PUBLIC_BASE}${path}`.
 *   PUBLIC_BASE already contains the gateway port-transform query, so we
 *   append the path and preserve any other query params via `&`.
 * - In local dev: returns `http://127.0.0.1:8000${path}`.
 */
function resolveBackendUrl(path: string): string {
  if (PUBLIC_BASE) {
    // PUBLIC_BASE looks like "https://host/v1?XTransformPort=8000".
    // path looks like "/v1/stats" or "/v1/stamp". Normalize: strip any
    // leading "/v1" from path since PUBLIC_BASE already ends with /v1.
    const trimmed = path.replace(/^\/v1/, "");
    const sep = PUBLIC_BASE.includes("?") ? "&" : "?";
    // If path has its own query (e.g. /v1/assets?limit=20), merge.
    const [p, q] = trimmed.split("?");
    const url = `${PUBLIC_BASE}${p}${sep}${PUBLIC_BASE.includes("?") ? "" : ""}${q ? q : ""}`;
    // The above is convoluted; simpler: PUBLIC_BASE already has the
    // port-transform query, so just append path-without-/v1 and any query.
    return mergeQuery(PUBLIC_BASE, p, q);
  }
  return `${LOCAL_BASE}${path}`;
}

/** Merge a base (with query) + a path + optional extra query into one URL. */
function mergeQuery(base: string, path: string, extraQuery?: string): string {
  const [baseUrl, baseQuery] = base.split("?");
  const parts: string[] = [];
  if (baseQuery) parts.push(baseQuery);
  if (extraQuery) parts.push(extraQuery);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return `${baseUrl}${path}${qs}`;
}

/** Attempt a JSON fetch from the Trace backend; return null if unreachable. */
export async function fetchTrace<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  const url = resolveBackendUrl(path);
  try {
    const resp = await fetch(url, init);
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

/** Attempt a binary fetch (e.g. PDF) from the Trace backend. */
export async function fetchTraceBuffer(
  path: string,
  init?: RequestInit,
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const url = resolveBackendUrl(path);
  try {
    const resp = await fetch(url, init);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    return { buffer, contentType };
  } catch {
    return null;
  }
}

/** Forward a multipart FormData POST to the Trace stamp endpoint. */
export async function postTraceForm<T>(
  path: string,
  form: FormData,
): Promise<{ data: T; status: number } | null> {
  const url = resolveBackendUrl(path);
  try {
    const resp = await fetch(url, {
      method: "POST",
      body: form,
    });
    const data = (await resp.json()) as T;
    return { data, status: resp.status };
  } catch {
    return null;
  }
}
