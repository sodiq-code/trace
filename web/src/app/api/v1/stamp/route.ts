/**
 * POST /api/v1/stamp — stamp an uploaded asset.
 * In dev: proxies to FastAPI (real C2PA stamping via c2pa-python).
 * In prod: returns a demo response using the user's metadata.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function detectFileType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg', 'tiff', 'heic'].includes(ext)) return 'image';
  if (['wav', 'mp3', 'flac', 'm4a'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'avi', 'm4v'].includes(ext)) return 'video';
  return 'image'; // fallback
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ detail: 'Invalid form data' }, { status: 400 });
  }

  const files = formData.getAll('file');
  const model = (formData.get('model') as string) || 'unknown-ai-model';
  const prompt = (formData.get('prompt') as string) || '';
  const creator = (formData.get('creator') as string) || 'unknown@trace.local';

  // In development, proxy to the local FastAPI service for real C2PA stamping.
  if (process.env.NODE_ENV === 'development') {
    const port = process.env.TRACE_API_PORT || '8000';
    try {
      const resp = await fetch(`http://127.0.0.1:${port}/v1/stamp`, {
        method: 'POST',
        body: formData,
      });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    } catch {
      return NextResponse.json(
        { detail: 'Failed to connect to stamp service. Is "trace serve" running on port ' + port + '?' },
        { status: 502 },
      );
    }
  }

  // In production (Vercel), return a demo response using the user's metadata.
  // Real stamping requires the Python c2pa-python library — clone the repo
  // and run "trace serve" locally for real C2PA manifests.
  const firstFile = files[0] as File | null;
  const fileName = firstFile?.name || 'upload.png';
  const fileType = detectFileType(fileName);

  return NextResponse.json({
    asset_id: 'demo-' + Math.random().toString(36).slice(2, 10),
    manifest_id: 'demo-manifest-' + Math.random().toString(36).slice(2, 10),
    file_type: fileType,
    file_hash: 'demo' + Math.random().toString(36).slice(2, 18).padEnd(64, '0'),
    signed_path: `/samples/stamped/demo-${fileType === 'audio' ? 'audio' : 'image'}.png`,
    card_url: '/card/44837e88-a2fb-42bf-91f1-c0583365a146',
    verify_url: '/api/v1/verify/44837e88-a2fb-42bf-91f1-c0583365a146',
    manifest_url: '/api/v1/manifest/44837e88-a2fb-42bf-91f1-c0583365a146',
    validation_state: 'Valid',
    assertions: [
      { name: 'Generated using', value: model },
      { name: 'Source type', value: 'AI-generated (trained model)' },
      { name: 'Creator', value: creator },
      { name: 'Prompt', value: prompt || '(not specified)' },
    ],
    _demo_mode: true,
    _note: 'Demo mode: This is a preview response. For real C2PA stamping, clone the repo and run "trace serve" locally.',
  }, { status: 201 });
}
