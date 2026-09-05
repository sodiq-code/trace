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
  Info,
  AlertCircle,
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

const AI_MODELS = [
  { value: '', label: '— Select AI model —' },
  { value: 'midjourney-v6', label: 'Midjourney v6' },
  { value: 'dall-e-3', label: 'DALL-E 3' },
  { value: 'stable-diffusion-xl', label: 'Stable Diffusion XL' },
  { value: 'gpt-4o', label: 'GPT-4o (image gen)' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
  { value: 'elevenlabs-v2', label: 'ElevenLabs v2 (audio)' },
  { value: 'sora', label: 'Sora (video)' },
  { value: 'runway-gen3', label: 'Runway Gen-3 (video)' },
  { value: 'other', label: 'Other (type below)' },
];

export default function DashboardPage() {
  const [dragging, setDragging] = useState(false);
  const [stamping, setStamping] = useState(false);
  const [results, setResults] = useState<StampResponse[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [model, setModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [prompt, setPrompt] = useState('');
  const [creator, setCreator] = useState('maya@channel.com');
  const [isDemoMode, setIsDemoMode] = useState(false);
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

  useEffect(() => {
    refreshDashboard();
    // Detect demo mode (production Vercel deployment)
    if (typeof window !== 'undefined' && window.location.hostname.includes('vercel.app')) {
      setIsDemoMode(true);
    }
  }, [refreshDashboard]);

  const effectiveModel = model === 'other' ? customModel : model;

  const handleStamp = useCallback(
    async (files: File[]) => {
      if (!effectiveModel) {
        toast.error('Please select an AI model', {
          description: 'The model field tells Trace which AI tool generated the asset.',
        });
        return;
      }
      setStamping(true);
      setResults([]);
      const t0 = performance.now();
      try {
        const stampResults: StampResponse[] = [];
        for (const file of files) {
          const result = await stampAsset(file, {
            model: effectiveModel,
            prompt,
            creator,
          });
          stampResults.push(result);
        }
        setResults(stampResults);
        if (stampResults.length === 1) {
          toast.success('Provenance manifest attached', {
            description: `${stampResults[0].validation_state} · ${files[0].name}`,
          });
        } else {
          toast.success(`${stampResults.length} assets stamped`, {
            description: stampResults.every((r) => r.validation_state === 'Valid')
              ? 'All valid'
              : 'Some failed — check results',
          });
        }
        await refreshDashboard();
      } catch (err) {
        toast.error('Stamping failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        setStamping(false);
        // eslint-disable-next-line no-console
        console.log(`[trace] stamp ${files.length} file(s): ${((performance.now() - t0) / 1000).toFixed(2)}s`);
      }
    },
    [effectiveModel, customModel, prompt, creator, refreshDashboard],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) handleStamp(files);
    },
    [handleStamp],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) handleStamp(files);
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
        {/* Demo mode banner */}
        {isDemoMode && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-semibold mb-1">Demo mode (read-only)</p>
              <p>
                This live deployment serves pre-stamped demo assets. Uploading a file returns a
                preview response — it does <strong>not</strong> create a real C2PA manifest. To
                stamp your own assets with real cryptographic provenance,{' '}
                <a
                  href="https://github.com/sodiq-code/trace"
                  className="underline font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  clone the repo
                </a>{' '}
                and run <code className="bg-amber-100 px-1 rounded">trace serve</code> locally.
              </p>
            </div>
          </div>
        )}

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

        {/* Drop zone — supports multiple files */}
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
                  {stamping ? 'Stamping…' : 'Drop AI-generated assets here'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  One or more files — PNG, JPEG, WEBP, SVG, WAV, MP3, MP4, MOV — under 100MB each
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
                Choose files (multiple allowed)
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,audio/*,video/*"
                multiple
                onChange={onFileChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Metadata inputs — manual by design (report §21.2) */}
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base text-[#1F3A5F] flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Asset metadata
              <span className="text-xs font-normal text-slate-400 ml-1">
                (required — you specify the source)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Info banner explaining why metadata is manual */}
            <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-100 p-3">
              <Info className="h-4 w-4 text-[#2E5C8A] shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600">
                Trace does <strong>not</strong> auto-detect the AI model or prompt — this is
                deliberate (report §21.2). You tell Trace which tool generated the asset and what
                prompt you used. This metadata is embedded in the C2PA manifest as a permanent,
                cryptographically-verifiable provenance record.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="model" className="text-xs text-slate-600">
                  AI model <span className="text-red-500">*</span>
                </Label>
                <select
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {AI_MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                {model === 'other' && (
                  <Input
                    className="mt-1"
                    placeholder="Type the model name"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                  />
                )}
                <p className="text-xs text-slate-400">
                  The AI tool that generated this asset (e.g. Midjourney, DALL-E, ElevenLabs).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="creator" className="text-xs text-slate-600">
                  Creator identity
                </Label>
                <Input
                  id="creator"
                  value={creator}
                  onChange={(e) => setCreator(e.target.value)}
                  placeholder="you@channel.com"
                />
                <p className="text-xs text-slate-400">
                  Your email or channel name — recorded as the asset's creator.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prompt" className="text-xs text-slate-600">
                  Generation prompt
                </Label>
                <Input
                  id="prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder='e.g. "neon tech thumbnail"'
                />
                <p className="text-xs text-slate-400">
                  The prompt you used to generate this asset. Becomes part of the permanent
                  provenance record.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results — supports multiple */}
        {results.length > 0 && (
          <div className="space-y-4">
            {results.map((result, i) => (
              <Card key={i} className="bg-white border-emerald-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {result.validation_state.toLowerCase() === 'valid' ? (
                      <CheckCircle2 className="h-5 w-5 text-[#2E8B57]" />
                    ) : (
                      <XCircle className="h-5 w-5 text-[#C0392B]" />
                    )}
                    <span className="text-[#1F3A5F]">
                      {result._demo_mode ? 'Preview (demo mode)' : 'Provenance manifest attached'} —{' '}
                      {result.validation_state}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="uppercase">
                      {result.file_type}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs">
                      sha256: {result.file_hash.slice(0, 16)}…
                    </Badge>
                  </div>
                  <div className="grid gap-1.5 text-sm">
                    {result.assertions.map((a, j) => (
                      <div key={j} className="flex gap-2">
                        <span className="text-slate-500 min-w-[120px]">{a.name}:</span>
                        <span className="font-medium text-slate-900">{a.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <a href={`/card/${result.asset_id}`}>
                      <Button variant="default" className="bg-[#1F3A5F] hover:bg-[#2E5C8A]">
                        View Provenance Card
                        <ExternalLink className="h-3.5 w-3.5 ml-2" />
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Compliance Dashboard (report §29.2) */}
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

        {/* Export Monthly Report (report §29.4, Should Work) */}
        <div className="flex justify-center">
          <a href="/api/v1/report" download>
            <Button
              variant="outline"
              className="bg-white border-[#1F3A5F] text-[#1F3A5F] hover:bg-[#1F3A5F] hover:text-white"
            >
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
                          <Badge variant="secondary" className="uppercase text-xs">
                            {a.file_type}
                          </Badge>
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
                          <a
                            href={`/card/${a.asset_id}`}
                            className="text-[#2E5C8A] hover:underline text-xs"
                          >
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
