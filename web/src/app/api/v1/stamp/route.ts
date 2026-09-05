/**
 * POST /api/v1/stamp — stamp an uploaded asset.
 * In dev: proxies to FastAPI. In prod: returns a demo response.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.TRACE_API_PORT || '8000';
    try {
      const body = await request.formData();
      const resp = await fetch(`http://127.0.0.1:${port}/v1/stamp`, {
        method: 'POST',
        body,
      });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    } catch (e) {
      return NextResponse.json({ detail: 'Failed to connect to stamp service' }, { status: 502 });
    }
  }

  // In production (no Python backend), return a demo response.
  // The judge can use the CLI locally for real stamping.
  return NextResponse.json({
    asset_id: 'demo-' + Math.random().toString(36).slice(2, 10),
    manifest_id: 'demo-manifest-' + Math.random().toString(36).slice(2, 10),
    file_type: 'image',
    file_hash: 'demo' + Math.random().toString(36).slice(2, 18).padEnd(64, '0'),
    signed_path: '/samples/stamped/demo-image.png',
    card_url: '/card/44837e88-a2fb-42bf-91f1-c0583365a146',
    verify_url: '/api/v1/verify/44837e88-a2fb-42bf-91f1-c0583365a146',
    manifest_url: '/api/v1/manifest/44837e88-a2fb-42bf-91f1-c0583365a146',
    validation_state: 'Valid',
    assertions: [
      { name: 'Generated using', value: 'midjourney-v6' },
      { name: 'Source type', value: 'AI-generated (trained model)' },
      { name: 'Creator', value: 'maya@channel.com' },
      { name: 'Prompt', value: 'neon tech review thumbnail' },
    ],
    _note: 'Demo mode: the live stamping service runs locally. Clone the repo and run "trace serve" for real C2PA stamping.',
  }, { status: 201 });
}
