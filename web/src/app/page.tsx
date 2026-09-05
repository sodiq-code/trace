'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShieldCheck,
  UploadCloud,
  FileCheck2,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sparkles,
  History,
  FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  stampAsset,
  getStats,
  listAssets,
  type StampResponse,
  type StatsResponse,
  type AssetListItem,
} from '@/lib/trace-api';
import { toast } from 'sonner';

export default function DashboardPage() {
  const [dragging, setDragging] = useState(false);
  const [stamping, setStamping] = useState(false);
  const [lastResult, setLastResult] = useState<StampResponse | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [model, setModel] = useState('midjourney-v6');
  const [prompt, setPrompt] = useState('');
  const [creator, setCreator] = useState('maya@channel.com');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshDashboard = useCallback(async () => {
    try {
      const [s, a] = await Promise.all([getStats(), listAssets(10)]);
      setStats(s);
      setAssets(a.assets);
    } catch {
      /* dashboard data is best-effort */
    }
  }, []);

  // Load stats + recent assets on mount (report Sec 29.2 compliance dashboard).
  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  const handleStamp = useCallback(
    async (file: File) => {
      setStamping(true);
      setLastResult(null);
      const t0 = performance.now();
      try {
        const result = await stampAsset(file, { model, prompt, creator });
        setLastResult(result);
        toast.success('Provenance manifest attached', {
          description: `${result.validation_state} · ${file.name}`,
        });
        await refreshDashboard();
      } catch (err) {
        toast.error('Stamping failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setStamping(false);
        // Report latency to console for the <3s validation (report Sec 32.4).
        // eslint-disable-next-line no-console
        console.log(`[trace] stamp+dashboard refresh: ${((performance.now() - t0) / 1000).toFixed(2)}s`);
      }
    },
    [model, prompt, creator, refreshDashboard],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleStamp(file);
    },
    [handleStamp],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleStamp(file);
      e.target.value = '';
    },
    [handleStamp],
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f8fa]">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1F3A5F]">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1F3A5F] leading-tight">Trace</h1>
              <p className="text-xs text-slate-500 leading-tight">
                The Provenance-First AI Content Engine
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              Signed in as {creator}
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
        {/* Hero / tagline */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1F3A5F]">
            Every AI-generated asset, provenance-tagged in one click.
          </h2>
          <p className="text-slate-600 text-sm sm:text-base">
            EU AI Act Article 50 compliant in under one second. Cryptographically-verifiable C2PA
            manifests.
          </p>
        </div>

        {/* Drop zone */}
        <Card className={`border-2 border-dashed transition-colors ${dragging ? 'border-[#2E5C8A] bg-blue-50' : 'border-slate-300 bg-white'}`}>
          <CardContent
            className="p-8 sm:p-12"
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1F3A5F]/5">
                {stamping ? (
                  <Loader2 className="h-8 w-8 text-[#2E5C8A] animate-spin" />
                ) : (
                  <UploadCloud className="h-8 w-8 text-[#1F3A5F]" />
                )}
              </div>
              <div>
                <p className="text-lg font-semibold text-[#1F3A5F]">
                  {stamping ? 'Stamping…' : 'Drop an AI-generated asset here'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  PNG, JPEG, WEBP, WAV, MP3, MP4 — under 100MB
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                className="bg-[#1F3A5F] hover:bg-[#2E5C8A]"
                disabled={stamping}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileCheck2 className="h-4 w-4 mr-2" />
                Choose a file
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,audio/*,video/*"
                onChange={onFileChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Metadata inputs */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[#1F3A5F] flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Asset metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="model" className="text-xs text-slate-600">Generator model</Label>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="midjourney-v6" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="creator" className="text-xs text-slate-600">Creator identity</Label>
              <Input id="creator" value={creator} onChange={(e) => setCreator(e.target.value)} placeholder="you@channel.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prompt" className="text-xs text-slate-600">Prompt (max 2KB)</Label>
              <Input id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="neon tech thumbnail" />
            </div>
          </CardContent>
        </Card>

        {/* Last result — the green-path guarantee */}
        {lastResult && (
          <Card className="bg-white border-emerald-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                {lastResult.validation_state.toLowerCase() === 'valid' ? (
                  <CheckCircle2 className="h-5 w-5 text-[#2E8B57]" />
                ) : (
                  <XCircle className="h-5 w-5 text-[#C0392B]" />
                )}
                <span className="text-[#1F3A5F]">
                  Provenance manifest attached — {lastResult.validation_state}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="uppercase">{lastResult.file_type}</Badge>
                <Badge variant="outline" className="font-mono text-xs">
                  sha256: {lastResult.file_hash.slice(0, 16)}…
                </Badge>
              </div>
              <div className="grid gap-1.5 text-sm">
                {lastResult.assertions.map((a, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-500 min-w-[120px]">{a.name}:</span>
                    <span className="font-medium text-slate-900">{a.value}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <a href={`/card/${lastResult.asset_id}`}>
                  <Button variant="default" className="bg-[#1F3A5F] hover:bg-[#2E5C8A]">
                    View Provenance Card
                    <ExternalLink className="h-3.5 w-3.5 ml-2" />
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Compliance Dashboard (report Sec 29.2) */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Assets stamped"
            value={stats?.total_assets ?? '—'}
            hint="this month"
          />
          <StatCard
            label="Compliance rate"
            value={stats ? `${Math.round(stats.compliance_rate * 100)}%` : '—'}
            hint="stamped = compliant"
            accent="green"
          />
          <StatCard
            label="Verifications"
            value={stats?.total_verifications ?? '—'}
            hint="third-party checks"
          />
        </div>

        {/* Export Monthly Report (report Sec 29.4, Should Work) */}
        <div className="flex justify-center">
          <a href="/api/v1/report" download>
            <Button variant="outline" className="bg-white border-[#1F3A5F] text-[#1F3A5F] hover:bg-[#1F3A5F] hover:text-white">
              <FileDown className="h-4 w-4 mr-2" />
              Export Monthly Compliance Report (PDF)
            </Button>
          </a>
        </div>

        {/* Recent assets */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[#1F3A5F] flex items-center gap-2">
              <History className="h-4 w-4" />
              Recent assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">
                No assets stamped yet. Drop a file above to begin.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto -mx-2">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 uppercase">
                    <tr>
                      <th className="text-left font-medium px-2 py-2">Asset</th>
                      <th className="text-left font-medium px-2 py-2">Type</th>
                      <th className="text-left font-medium px-2 py-2 hidden sm:table-cell">Stamped</th>
                      <th className="text-left font-medium px-2 py-2">Status</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((a) => (
                      <tr key={a.asset_id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-2 py-2 font-medium text-slate-900 truncate max-w-[180px]">
                          {a.file_name}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant="secondary" className="uppercase text-xs">{a.file_type}</Badge>
                        </td>
                        <td className="px-2 py-2 text-slate-500 hidden sm:table-cell text-xs">
                          {new Date(a.created_at).toLocaleString()}
                        </td>
                        <td className="px-2 py-2">
                          <span className="inline-flex items-center gap-1 text-[#2E8B57] text-xs font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right">
                          <a href={`/card/${a.asset_id}`} className="text-[#2E5C8A] hover:underline text-xs">
                            Card →
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-slate-500">
          Trace generates cryptographically-verifiable C2PA manifests aligned with EU AI Act
          Article 50. Trace does not constitute legal advice.
        </div>
      </footer>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'green';
}) {
  return (
    <Card className="bg-white">
      <CardContent className="p-4">
        <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
        <p
          className={`text-2xl font-bold mt-1 ${
            accent === 'green' ? 'text-[#2E8B57]' : 'text-[#1F3A5F]'
          }`}
        >
          {value}
        </p>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}
