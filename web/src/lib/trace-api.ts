/**
 * Trace API client — typed wrapper around the Trace FastAPI service.
 *
 * Upload strategy:
 *  - LOCAL DEV: the browser calls same-origin `/api/v1/*`. Next.js rewrites
 *    that to the local FastAPI service on port 8000 (see next.config.ts).
 *    The Route Handler is not size-limited, so large files work.
 *  - PRODUCTION (Vercel): if `NEXT_PUBLIC_TRACE_API_URL` is set, the browser
 *    uploads DIRECTLY to the public Trace backend (the gateway-exposed
 *    FastAPI service). This bypasses Vercel's 4.5 MB Route Handler body
 *    limit entirely — Vercel Hobby functions cannot have their body limit
 *    raised above 4.5 MB, so direct-to-backend is the only way to support
 *    large media (video) uploads. The backend has CORS open to all origins
 *    (the verifier is meant to be publicly callable).
 *  - FALLBACK: if the direct backend call fails (e.g. CORS or network), the
 *    client retries via the same-origin `/api/v1/stamp` Route Handler, which
 *    will either proxy to the backend (small files) or return a demo preview.
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

/** Same-origin API base (works in both dev and prod via Route Handlers). */
const API_BASE = "/api/v1";

/**
 * Public backend URL for direct browser→backend uploads in production.
 * Set as NEXT_PUBLIC_TRACE_API_URL on Vercel. Must include the gateway's
 * port-transform query, e.g.:
 *   https://host.example/v1?XTransformPort=8000
 */
const PUBLIC_BACKEND = process.env.NEXT_PUBLIC_TRACE_API_URL || "";

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
 * Resolve a public-backend URL for a given V1 path, preserving the gateway's
 * port-transform query. Returns "" if no public backend is configured.
 */
function resolvePublicUrl(path: string): string {
  if (!PUBLIC_BACKEND) return "";
  // PUBLIC_BASE looks like "https://host/v1?XTransformPort=8000".
  // path looks like "/v1/stamp". Strip the leading "/v1" and merge queries.
  const trimmed = path.replace(/^\/v1/, "");
  const [baseUrl, baseQuery] = PUBLIC_BACKEND.split("?");
  const [p, q] = trimmed.split("?");
  const parts: string[] = [];
  if (baseQuery) parts.push(baseQuery);
  if (q) parts.push(q);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return `${baseUrl}${p}${qs}`;
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

  // Production: try a direct browser→backend upload first. This bypasses
  // Vercel's 4.5 MB Route Handler body limit, so large media (video) works
  // up to the public backend's own limit (32 MB at the gateway).
  const publicUrl = resolvePublicUrl("/v1/stamp");
  if (publicUrl) {
    try {
      const res = await fetch(publicUrl, { method: "POST", body: form });
      if (res.ok) return jsonOrThrow<StampResponse>(res);
      // 413 / EntityTooLarge from the backend or gateway: the file is too
      // large. Do NOT fall through to the Vercel Route Handler (it has an
      // even smaller 4.5 MB limit and would 413 too). Surface a clear error.
      if (res.status === 413) {
        const text = await res.text().catch(() => "");
        if (text.includes("EntityTooLarge") || text.includes("payload size")) {
          throw new Error(
            `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum supported size is 30 MB. Please compress the video or use a smaller file.`,
          );
        }
        throw new Error(
          `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum supported size is 30 MB.`,
        );
      }
      // Any other non-ok status: surface the backend's error (e.g. invalid
      // file format) rather than silently retrying via the Route Handler.
      return jsonOrThrow<StampResponse>(res);
    } catch (err) {
      // If it's already our friendly size error, rethrow it.
      if (err instanceof Error && err.message.includes("File too large")) throw err;
      // Network/CORS error — fall through to same-origin proxy (local dev).
    }
  }

  // Fallback (local dev, or backend unreachable): same-origin Route Handler.
  const res = await fetch(`${API_BASE}/stamp`, { method: "POST", body: form });
  if (res.status === 413) {
    throw new Error(
      `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The maximum supported size is 30 MB. Please compress the video or use a smaller file.`,
    );
  }
  return jsonOrThrow<StampResponse>(res);
}

/** Verify a stamped asset by asset_id (Validation Test 2). */
export async function verifyAsset(assetId: string): Promise<VerifyResponse> {
  const publicUrl = resolvePublicUrl(`/v1/verify/${assetId}`);
  if (publicUrl) {
    try {
      const res = await fetch(publicUrl);
      if (res.ok) return jsonOrThrow<VerifyResponse>(res);
    } catch {
      /* fall through */
    }
  }
  const res = await fetch(`${API_BASE}/verify/${assetId}`);
  return jsonOrThrow<VerifyResponse>(res);
}

/** Fetch the raw manifest + assertions for the Provenance Card. */
export async function getManifest(assetId: string): Promise<ManifestResponse> {
  const publicUrl = resolvePublicUrl(`/v1/manifest/${assetId}`);
  if (publicUrl) {
    try {
      const res = await fetch(publicUrl);
      if (res.ok) return jsonOrThrow<ManifestResponse>(res);
    } catch {
      /* fall through */
    }
  }
  const res = await fetch(`${API_BASE}/manifest/${assetId}`);
  return jsonOrThrow<ManifestResponse>(res);
}

/** List recently stamped assets (dashboard). */
export async function listAssets(
  limit = 20,
): Promise<{ assets: AssetListItem[]; count: number }> {
  const publicUrl = resolvePublicUrl(`/v1/assets?limit=${limit}`);
  if (publicUrl) {
    try {
      const res = await fetch(publicUrl);
      if (res.ok) return jsonOrThrow(res);
    } catch {
      /* fall through */
    }
  }
  const res = await fetch(`${API_BASE}/assets?limit=${limit}`);
  return jsonOrThrow(res);
}

/** Dashboard summary stats. */
export async function getStats(): Promise<StatsResponse> {
  const publicUrl = resolvePublicUrl(`/v1/stats`);
  if (publicUrl) {
    try {
      const res = await fetch(publicUrl);
      if (res.ok) return jsonOrThrow<StatsResponse>(res);
    } catch {
      /* fall through */
    }
  }
  const res = await fetch(`${API_BASE}/stats`);
  return jsonOrThrow<StatsResponse>(res);
}
