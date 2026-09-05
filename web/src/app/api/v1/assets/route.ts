/**
 * GET /api/v1/assets — recent assets list.
 * Tries the local FastAPI service first; falls back to pre-stamped demo assets.
 */
import { NextResponse } from 'next/server';
import { fetchTrace } from '@/lib/trace-proxy';
import { DEMO_ASSETS } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const data = await fetchTrace<{ assets: typeof DEMO_ASSETS; count: number }>('/v1/assets?limit=20');
  if (data && data.assets && data.assets.length > 0) return NextResponse.json(data);
  return NextResponse.json({ assets: DEMO_ASSETS, count: DEMO_ASSETS.length });
}
