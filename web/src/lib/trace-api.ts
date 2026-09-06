/**
 * Trace API client — typed wrapper around the Trace FastAPI service.
 *
 * Upload strategy (bulletproof, single-origin when possible):
 *  - PREFERRED: the dashboard is served from the SAME origin as the FastAPI
 *    backend (e.g. via the gateway). All calls go to same-origin `/v1/*`.
 *    No CORS, no body-size limit beyond the gateway's 32 MB cap, no cache
 *    issues. This is the architecture the blueprint §28.3 describes.
 *  - FALLBACK: if `NEXT_PUBLIC_TRACE_API_URL` is set (Vercel deployment),
 *    the browser uploads directly to that public backend. This bypasses
 *    Vercel's 4.5 MB Route Handler limit.
 *  - LAST RESORT: same-origin `/api/v1/*` Route Handler (local dev proxy).
 */

export interface StampResponse {
  asset_id: string;
  manifest_id: string;
  file_type: string;
  file_hash: string;
  signed_path: string;
  card_url: string;
  verify_url: string;
  manifest_url: string;
  validation_state: string;
  assertions: { name: string; value: string }[];
  _demo_mode?: boolean;
  _note?: string;
}

export interface VerifyResponse {
  asset_id: string;
  file_hash: string;
  file_type: string;
  created_at: string;
  creator: string;
  manifest: {
    assertions: { name: string; value: string }[];
    claim_chain: unknown[];
    signed_at: string;
    signed_by: string;
    signature_valid: boolean;
    validation_state: string;
  };
  verifications: { verified_at: string; result: string }[];
}

export interface ManifestResponse {
  asset_id: string;
  file_type: string;
  file_hash: string;
  created_at: string;
  file_path: string;
  signed_at: string;
  signed_by: string;
  signature_valid: boolean;
  validation_state: string;
  claim_generator: string;
  assertions: { name: string; value: string }[];
  manifest_json: string;
}

export interface AssetListItem {
  asset_id: string;
  file_type: string;
  file_hash: string;
  created_at: string;
  file_name: string;
  signed_by: string;
}

export interface StatsResponse {
  total_assets: number;
  total_verifications: number;
  compliance_rate: number;
}

/**
 * The API base. Priority:
 *  1. NEXT_PUBLIC_TRACE_API_URL (explicit public backend — Vercel deploys)
 *  2. "" (empty string) → same-origin relative `/v1/*` (when served from
 *     FastAPI itself, e.g. via the gateway).
 *  3. Same-origin `/api/v1/*` Route Handler fallback (local dev).
 *
 * We detect #2 at runtime: if the page is NOT on a vercel.app domain and
 * NEXT_PUBLIC_TRACE_API_URL is unset, assume same-origin /v1/*.
 */
const PUBLIC_BACKEND = process.env.NEXT_PUBLIC_TRACE_API_URL || "";
const IS_VERCEL =
  typeof window !== "undefined" && window.location.hostname.includes("vercel.app");

/** The base for direct backend calls. Empty = use same-origin relative. */
const BACKEND_BASE = PUBLIC_BACKEND || (IS_VERCEL ? "" : "");
/** The gateway port-transform query (if any). */
const PORT_QUERY = PUBLIC_BACKEND.includes("XTransformPort")
  ? PUBLIC_BACKEND.split("?")[1]
  : "";

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail || JSON.stringify(body);
    } catch {
      /* keep statusText */
    }
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Build the full URL for a V1 backend path.
 * - If a public backend is configured, append the path + port-transform query.
 * - Otherwise, return a same-origin relative path ("/v1/stats").
 */
function url(path: string): string {
  if (PUBLIC_BACKEND) {
    const [baseUrl, baseQuery] = PUBLIC_BACKEND.split("?");
    const trimmed = path.replace(/^\/v1/, "");
    const [p, q] = trimmed.split("?");
    const parts: string[] = [];
    if (baseQuery) parts.push(baseQuery);
    if (q) parts.push(q);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    return `${baseUrl}${p}${qs}`;
  }
  // Same-origin relative (works when served from FastAPI via the gateway).
  return path;
}

/** Stamp an uploaded file with a C2PA provenance manifest. */
export async function stampAsset(
  file: File,
  opts: { model?: string; prompt?: string; creator?: string } = {},
): Promise<StampResponse> {
  const form = new FormData();
  form.append("file", file);
  if (opts.model) form.append("model", opts.model);
  if (opts.prompt) form.append("prompt", opts.prompt);
  if (opts.creator) form.append("creator", opts.creator);

  // Try the backend directly (public URL or same-origin /v1).
  try {
    const res = await fetch(url("/v1/stamp"), { method: "POST", body: form });
    if (res.ok) return jsonOrThrow<StampResponse>(res);
    if (res.status === 413) {
      const text = await res.text().catch(() => "");
      if (text.includes("EntityTooLarge") || text.includes("payload size")) {
        throw new Error(
          `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum supported size is 4.5 MB. Please compress the video or use a smaller file.`,
        );
      }
      throw new Error(
        `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum supported size is 4.5 MB.`,
      );
    }
    // Any other error (e.g. 400 invalid format): surface it.
    return jsonOrThrow<StampResponse>(res);
  } catch (err) {
    // Only fall through to the Route Handler on a genuine network failure
    // (TypeError = fetch itself failed, e.g. CORS/DNS). HTTP errors were
    // already handled above and threw.
    if (err instanceof Error && err.message.includes("File too large")) throw err;
    if (!(err instanceof TypeError)) throw err;
  }

  // Last-resort fallback: same-origin Route Handler (local dev only).
  const res = await fetch("/api/v1/stamp", { method: "POST", body: form });
  if (res.status === 413) {
    throw new Error(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum supported size is 4.5 MB. Please compress the video or use a smaller file.`,
    );
  }
  return jsonOrThrow<StampResponse>(res);
}

/** Verify a stamped asset by asset_id. */
export async function verifyAsset(assetId: string): Promise<VerifyResponse> {
  try {
    const res = await fetch(url(`/v1/verify/${assetId}`));
    if (res.ok) return jsonOrThrow<VerifyResponse>(res);
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
  }
  const res = await fetch(`/api/v1/verify/${assetId}`);
  return jsonOrThrow<VerifyResponse>(res);
}

/** Fetch the raw manifest + assertions for the Provenance Card. */
export async function getManifest(assetId: string): Promise<ManifestResponse> {
  try {
    const res = await fetch(url(`/v1/manifest/${assetId}`));
    if (res.ok) return jsonOrThrow<ManifestResponse>(res);
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
  }
  const res = await fetch(`/api/v1/manifest/${assetId}`);
  return jsonOrThrow<ManifestResponse>(res);
}

/** List recently stamped assets (dashboard). */
export async function listAssets(
  limit = 20,
): Promise<{ assets: AssetListItem[]; count: number }> {
  try {
    const res = await fetch(url(`/v1/assets?limit=${limit}`));
    if (res.ok) return jsonOrThrow(res);
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
  }
  const res = await fetch(`/api/v1/assets?limit=${limit}`);
  return jsonOrThrow(res);
}

/** Dashboard summary stats. */
export async function getStats(): Promise<StatsResponse> {
  try {
    const res = await fetch(url(`/v1/stats`));
    if (res.ok) return jsonOrThrow<StatsResponse>(res);
  } catch (err) {
    if (!(err instanceof TypeError)) throw err;
  }
  const res = await fetch(`/api/v1/stats`);
  return jsonOrThrow<StatsResponse>(res);
}
