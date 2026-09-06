/**
 * GET /api/v1/stats — dashboard summary stats.
 * Tries the local FastAPI service first; falls back to demo data if unreachable.
 */
import { NextResponse } from 'next/server';
import { fetchTrace } from '@/lib/trace-proxy';

export const dynamic = 'force-dynamic';

export async function GET() {
 const data = await fetchTrace<{ total_assets: number; total_verifications: number; compliance_rate: number }>('/v1/stats');
 if (data) return NextResponse.json(data);
 return NextResponse.json({
  total_assets: 3,
  total_verifications: 12,
  compliance_rate: 1.0,
 });
}
