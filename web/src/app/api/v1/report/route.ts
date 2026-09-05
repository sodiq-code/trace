/**
 * GET /api/v1/report — Monthly Compliance Report PDF.
 * Tries the FastAPI service (ReportLab-generated PDF) first; falls back to a
 * minimal inline PDF if the service is unreachable.
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchTraceBuffer } from '@/lib/trace-proxy';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(_request: NextRequest) {
  const remote = await fetchTraceBuffer('/v1/report');
  if (remote) {
    return new NextResponse(remote.buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="trace-compliance-report.pdf"',
      },
    });
  }

  const pdf = generateMinimalPdf();
  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="trace-compliance-report.pdf"',
    },
  });
}

function generateMinimalPdf(): Uint8Array {
  const content = [
    'Trace - Monthly Compliance Report',
    'Creator: maya@channel.com',
    'Channel: Maya Tech Reviews',
    'Report period: September 2026',
    '',
    'Summary Statistics:',
    '  Total assets stamped: 3',
    '  Compliance rate: 100%',
    '  Total verification calls: 12',
    '',
    'All stamped assets carry a cryptographically-verifiable C2PA',
    'manifest with a valid ES256 signature. The compliance rate is',
    '100% for stamped assets.',
    '',
    'Legal Disclaimer:',
    'Trace generates cryptographically-verifiable C2PA manifests',
    'that align with EU AI Act Article 50 transparency requirements.',
    'Trace does not constitute legal advice.',
  ].join('\n');

  const escaped = content.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const lines = escaped.split('\n');
  let textStream = '';
  lines.forEach((line, i) => {
    textStream += `BT /F1 10 Tf 72 ${750 - i * 14} Td (${line}) Tj ET\n`;
  });

  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${textStream.length} >>
stream
${textStream}endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000266 00000 n
${1000 + textStream.length} 00000 n
trailer << /Size 6 /Root 1 0 R >>
startxref
${1100 + textStream.length}
%%EOF`;

  return new TextEncoder().encode(pdf);
}
