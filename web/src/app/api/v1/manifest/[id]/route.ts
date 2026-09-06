/**
 * GET /api/v1/manifest/[id] — raw manifest for the Provenance Card.
 * Tries FastAPI first; falls back to pre-stamped demo data.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchTrace } from '@/lib/trace-proxy';
import { DEMO_MANIFESTS } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

export async function GET(
 _request: NextRequest,
 { params }: { params: Promise<{ id: string }> },
) {
 const { id } = await params;

 const data = await fetchTrace<any>(`/v1/manifest/${id}`);
 if (data) return NextResponse.json(data);

 const demo = DEMO_MANIFESTS[id];
 if (demo) return NextResponse.json(demo);
 return NextResponse.json({ detail: `asset not found: ${id}` }, { status: 404 });
}
