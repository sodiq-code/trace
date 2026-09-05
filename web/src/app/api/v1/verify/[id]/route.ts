/**
 * GET /api/v1/verify/[id] — Validation Test 2 (report Sec 32.2).
 * Returns JSON with the claim chain and signature validity.
 * Tries FastAPI first; falls back to pre-stamped demo data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchTrace } from '@/lib/trace-proxy';
import { DEMO_VERIFY } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const data = await fetchTrace<any>(`/v1/verify/${id}`);
  if (data) return NextResponse.json(data);

  const demo = DEMO_VERIFY[id];
  if (demo) return NextResponse.json(demo);
  return NextResponse.json({ detail: `asset not found: ${id}` }, { status: 404 });
}
