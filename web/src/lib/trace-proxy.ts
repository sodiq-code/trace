/**
 * Shared proxy helper for the Next.js API routes.
 *
 * Strategy: always try the local FastAPI Trace service first (real C2PA
 * stamping/verification via c2pa-python). If it is unreachable (e.g. on a
 * read-only Vercel deployment), fall back to bundled demo data so the
 * public demo keeps working.
 *
 * This keeps every request same-origin (sandbox-safe) and means the same
 * code path works in local dev AND production without NODE_ENV branching.
 */

export const TRACE_PORT = process.env.TRACE_API_PORT || "8000";
export const TRACE_BASE = `http://127.0.0.1:${TRACE_PORT}`;

/** Attempt a JSON fetch from the FastAPI service; return null if unreachable. */
export async function fetchTrace<T>(
  path: string,
  init?: RequestInit,
): Promise<T | null> {
  try {
    const resp = await fetch(`${TRACE_BASE}${path}`, init);
    if (!resp.ok) return null;
    return (await resp.json()) as T;
  } catch {
    return null;
  }
}

/** Attempt a binary fetch (e.g. PDF) from the FastAPI service. */
export async function fetchTraceBuffer(
  path: string,
  init?: RequestInit,
): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  try {
    const resp = await fetch(`${TRACE_BASE}${path}`, init);
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const contentType = resp.headers.get("content-type") || "application/octet-stream";
    return { buffer, contentType };
  } catch {
    return null;
  }
}

/** Forward a multipart FormData POST to the FastAPI stamp endpoint. */
export async function postTraceForm<T>(path: string, form: FormData): Promise<{ data: T; status: number } | null> {
  try {
    const resp = await fetch(`${TRACE_BASE}${path}`, {
      method: "POST",
      body: form,
    });
    const data = (await resp.json()) as T;
    return { data, status: resp.status };
  } catch {
    return null;
  }
}
