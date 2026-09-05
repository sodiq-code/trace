/**
 * GET /api/v1/assets — recent assets list.
 * In dev: proxies to FastAPI. In prod: returns pre-stamped demo assets.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEMO_ASSETS = [
  {
    asset_id: '44837e88-a2fb-42bf-91f1-c0583365a146',
    file_type: 'image',
    file_hash: '6c5c60bdda386d27d9a29e55c0507694a04be19ce21df83568e04b4555d453a4',
    created_at: '2026-09-05T18:00:00+00:00',
    file_name: 'demo-image.png',
    signed_by: 'maya@channel.com',
  },
  {
    asset_id: '1f4ca75d-25c6-44c6-8eb0-ab54aed5110d',
    file_type: 'audio',
    file_hash: 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890',
    created_at: '2026-09-05T18:01:00+00:00',
    file_name: 'demo-audio.wav',
    signed_by: 'maya@channel.com',
  },
  {
    asset_id: '4e4f6083-3ac7-4181-8b2f-493a517ba550',
    file_type: 'image',
    file_hash: 'b2c3d4e5f6789012345678901234567890123456789012345678901234567890123',
    created_at: '2026-09-05T18:02:00+00:00',
    file_name: 'demo-text.svg',
    signed_by: 'maya@channel.com',
  },
];

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.TRACE_API_PORT || '8000';
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/v1/assets?limit=20`);
      if (resp.ok) return NextResponse.json(await resp.json());
    } catch { /* fall through */ }
  }
  return NextResponse.json({ assets: DEMO_ASSETS, count: DEMO_ASSETS.length });
}
