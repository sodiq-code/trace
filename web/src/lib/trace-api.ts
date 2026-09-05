/**
 * Trace API client — typed wrapper around the Trace FastAPI service.
 *
 * The browser calls same-origin `/api/v1/*`; Next.js rewrites that to the
 * FastAPI service on port 8000 (see next.config.ts). This keeps every request
 * relative (sandbox-safe) and identical in local dev.
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

const API_BASE = "/api/v1";

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

  const res = await fetch(`${API_BASE}/stamp`, { method: "POST", body: form });
  return jsonOrThrow<StampResponse>(res);
}

/** Verify a stamped asset by asset_id (Validation Test 2). */
export async function verifyAsset(assetId: string): Promise<VerifyResponse> {
  const res = await fetch(`${API_BASE}/verify/${assetId}`);
  return jsonOrThrow<VerifyResponse>(res);
}

/** Fetch the raw manifest + assertions for the Provenance Card. */
export async function getManifest(assetId: string): Promise<ManifestResponse> {
  const res = await fetch(`${API_BASE}/manifest/${assetId}`);
  return jsonOrThrow<ManifestResponse>(res);
}

/** List recently stamped assets (dashboard). */
export async function listAssets(limit = 20): Promise<{ assets: AssetListItem[]; count: number }> {
  const res = await fetch(`${API_BASE}/assets?limit=${limit}`);
  return jsonOrThrow(res);
}

/** Dashboard summary stats. */
export async function getStats(): Promise<StatsResponse> {
  const res = await fetch(`${API_BASE}/stats`);
  return jsonOrThrow(res);
}
