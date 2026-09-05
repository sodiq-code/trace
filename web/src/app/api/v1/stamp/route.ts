/**
 * POST /api/v1/stamp — stamp an uploaded asset.
 * Tries the FastAPI service first (real C2PA stamping via c2pa-python).
 * Falls back to a preview demo response if the service is unreachable.
 */
import { NextRequest, NextResponse } from 'next/server';
import { postTraceForm } from '@/lib/trace-proxy';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function detectFileType(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop() || '';
  if (['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg', 'tiff', 'heic'].includes(ext)) return 'image';
  if (['wav', 'mp3', 'flac', 'm4a'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'avi', 'm4v'].includes(ext)) return 'video';
  return 'image';
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

  // Try the local FastAPI service for real C2PA stamping.
  const result = await postTraceForm<any>('/v1/stamp', formData);
  if (result) {
    return NextResponse.json(result.data, { status: result.status });
  }

  // Fallback: demo preview response using the user's metadata.
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
    _note: 'Demo mode: preview response. For real C2PA stamping, run "trace serve" locally.',
  }, { status: 201 });
}
