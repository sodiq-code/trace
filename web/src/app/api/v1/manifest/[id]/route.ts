/**
 * GET /api/v1/manifest/[id] — raw manifest for the Provenance Card.
 * In dev: proxies to FastAPI. In prod: returns pre-stamped demo data.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEMO_MANIFESTS: Record<string, any> = {
  '44837e88-a2fb-42bf-91f1-c0583365a146': {
    asset_id: '44837e88-a2fb-42bf-91f1-c0583365a146',
    file_type: 'image',
    file_hash: '6c5c60bdda386d27d9a29e55c0507694a04be19ce21df83568e04b4555d453a4',
    created_at: '2026-09-05T18:00:00+00:00',
    file_path: 'samples/stamped/demo-image.png',
    signed_at: '2026-09-05T18:00:00+00:00',
    signed_by: 'maya@channel.com',
    signature_valid: true,
    validation_state: 'Valid',
    claim_generator: 'trace 0.1.0',
    assertions: [
      { name: 'Generator', value: 'trace 0.1.0' },
      { name: 'Generated using', value: 'midjourney-v6' },
      { name: 'Source type', value: 'AI-generated (trained model)' },
      { name: 'Creator', value: 'maya@channel.com' },
      { name: 'Model', value: 'midjourney-v6' },
      { name: 'Prompt', value: 'neon tech review thumbnail' },
    ],
    manifest_json: '{"active_manifest":"demo","manifests":{"demo":{"claim_generator_info":[{"name":"trace","version":"0.1.0"}],"title":"Trace Provenance Stamp"}}}',
  },
  '1f4ca75d-25c6-44c6-8eb0-ab54aed5110d': {
    asset_id: '1f4ca75d-25c6-44c6-8eb0-ab54aed5110d',
    file_type: 'audio',
    file_hash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
    created_at: '2026-09-05T18:01:00+00:00',
    file_path: 'samples/stamped/demo-audio.wav',
    signed_at: '2026-09-05T18:01:00+00:00',
    signed_by: 'maya@channel.com',
    signature_valid: true,
    validation_state: 'Valid',
    claim_generator: 'trace 0.1.0',
    assertions: [
      { name: 'Generator', value: 'trace 0.1.0' },
      { name: 'Generated using', value: 'elevenlabs-v2' },
      { name: 'Source type', value: 'AI-generated (trained model)' },
      { name: 'Creator', value: 'maya@channel.com' },
      { name: 'Model', value: 'elevenlabs-v2' },
      { name: 'Prompt', value: 'voiceover intro for tech review' },
    ],
    manifest_json: '{"active_manifest":"demo","manifests":{"demo":{"claim_generator_info":[{"name":"trace","version":"0.1.0"}],"title":"Trace Provenance Stamp"}}}',
  },
  '4e4f6083-3ac7-4181-8b2f-493a517ba550': {
    asset_id: '4e4f6083-3ac7-4181-8b2f-493a517ba550',
    file_type: 'image',
    file_hash: 'b2c3d4e5f6789012345678901234567890123456789012345678901234567890123',
    created_at: '2026-09-05T18:02:00+00:00',
    file_path: 'samples/stamped/demo-text.svg',
    signed_at: '2026-09-05T18:02:00+00:00',
    signed_by: 'maya@channel.com',
    signature_valid: true,
    validation_state: 'Valid',
    claim_generator: 'trace 0.1.0',
    assertions: [
      { name: 'Generator', value: 'trace 0.1.0' },
      { name: 'Generated using', value: 'gpt-4o' },
      { name: 'Source type', value: 'AI-generated (trained model)' },
      { name: 'Creator', value: 'maya@channel.com' },
      { name: 'Model', value: 'gpt-4o' },
      { name: 'Prompt', value: 'Write a 200-word introduction to the top 5 AI content tools for creators.' },
    ],
    manifest_json: '{"active_manifest":"demo","manifests":{"demo":{"claim_generator_info":[{"name":"trace","version":"0.1.0"}],"title":"Trace Provenance Stamp"}}}',
  },
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (process.env.NODE_ENV === 'development') {
    const port = process.env.TRACE_API_PORT || '8000';
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/v1/manifest/${id}`);
      if (resp.ok) return NextResponse.json(await resp.json());
      if (resp.status === 404) return NextResponse.json({ detail: 'asset not found' }, { status: 404 });
    } catch { /* fall through */ }
  }

  const data = DEMO_MANIFESTS[id];
  if (!data) {
    return NextResponse.json({ detail: `asset not found: ${id}` }, { status: 404 });
  }
  return NextResponse.json(data);
}
