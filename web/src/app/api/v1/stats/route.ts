/**
 * GET /api/v1/stats — dashboard summary stats.
 * In dev: proxies to FastAPI. In prod: returns static demo data.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.TRACE_API_PORT || '8000';
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/v1/stats`);
      if (resp.ok) return NextResponse.json(await resp.json());
    } catch { /* fall through */ }
  }
  return NextResponse.json({
    total_assets: 3,
    total_verifications: 12,
    compliance_rate: 1.0,
  });
}
