'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
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
  Search,
  Github,
  Filter,
  Lock,
  Zap,
  FileSpreadsheet,
  Database,
  Cpu,
  KeyRound,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { ComplianceCharts } from '@/components/dashboard/compliance-charts';
import { HowItWorks } from '@/components/dashboard/how-it-works';
import { CreatorSwitcher } from '@/components/dashboard/creator-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import {
  StagingArea,
  detectFileType,
  suggestModel,
  type StagedFile,
} from '@/components/dashboard/staging-area';
import {
  stampAsset,
  getStats,
  listAssets,
  type StampResponse,
  type StatsResponse,
  type AssetListItem,
} from '@/lib/trace-api';
import { toast } from 'sonner';

const TYPE_FILTERS = [
  { value: 'all', label: 'All', icon: Database },
  { value: 'image', label: 'Image', icon: Sparkles },
  { value: 'audio', label: 'Audio', icon: Zap },
  { value: 'video', label: 'Video', icon: Cpu },
] as const;

function downloadCsv(filename: string, rows: AssetListItem[]) {
  const headers = ['asset_id', 'file_name', 'file_type', 'file_hash', 'signed_by', 'created_at'];
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [r.asset_id, r.file_name, r.file_type, r.file_hash, r.signed_by, r.created_at]
        .map(escape)
        .join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DashboardPage() {
  const [dragging, setDragging] = useState(false);
  const [stamping, setStamping] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [assets, setAssets] = useState<AssetListItem[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [creator, setCreator] = useState('maya@channel.com');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [typeFilter, setTypeFilter] = useState<(typeof TYPE_FILTERS)[number]['value']>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const stagingRef = useRef<HTMLDivElement>(null);

  const refreshDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const [s, a] = await Promise.all([getStats(), listAssets(20)]);
      setStats(s);
      setAssets(a.assets);
    } catch {
      /* dashboard data is best-effort */
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    refreshDashboard();
    if (typeof window !== 'undefined') {
      (async () => {
        try {
          const probe = await fetch('/api/healthz');
          const data = await probe.json();
          if (data && data.demo_mode) setIsDemoMode(true);
        } catch {
          /* ignore */
        }
      })();
    }
  }, [refreshDashboard]);

  // --- Staging logic: files are staged, not immediately stamped ---
  // The Vercel Hobby plan enforces a hard 4.5 MB request body limit on Route
  // Handlers. The blueprint (§31.3) says: "keep demo assets under 5MB each".
  // Files over 4.5 MB require the direct-to-backend path (which the fresh JS
  // uses automatically), but stale browser caches may still hit the Route
  // Handler. This guard ensures the error is always accurate.
  const addFiles = useCallback((fileList: File[]) => {
    const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5 MB — Vercel Route Handler limit
    const accepted: File[] = [];
    const rejected: { name: string; size: number }[] = [];
    for (const file of fileList) {
      if (file.size > MAX_FILE_SIZE) {
        rejected.push({ name: file.name, size: file.size });
      } else {
        accepted.push(file);
      }
    }
    if (rejected.length > 0) {
      toast.error(`${rejected.length} file${rejected.length === 1 ? '' : 's'} exceed the 4.5 MB limit`, {
        description:
          rejected
            .map((f) => `${f.name} (${(f.size / (1024 * 1024)).toFixed(1)} MB)`)
            .join(', ') +
          '. Compress to under 4.5 MB, or run Trace locally for larger files (no limit).',
      });
    }
    if (accepted.length === 0) return;
    const newStaged: StagedFile[] = accepted.map((file) => {
      const fileType = detectFileType(file);
      return {
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        model: suggestModel(fileType),
        customModel: '',
        prompt: '',
        status: 'pending' as const,
      };
    });
    setStagedFiles((prev) => [...prev, ...newStaged]);
    // Scroll to the staging area so the user sees it
    setTimeout(() => {
      stagingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const updateStaged = useCallback((id: string, patch: Partial<StagedFile>) => {
    setStagedFiles((prev) => prev.map((sf) => (sf.id === id ? { ...sf, ...patch } : sf)));
  }, []);

  const removeStaged = useCallback((id: string) => {
    setStagedFiles((prev) => prev.filter((sf) => sf.id !== id));
  }, []);

  const handleStampAll = useCallback(async () => {
    const pending = stagedFiles.filter((sf) => sf.status === 'pending');
    if (pending.length === 0) return;
    setStamping(true);
    const t0 = performance.now();
    // Mark all pending as stamping
    setStagedFiles((prev) =>
      prev.map((sf) => (sf.status === 'pending' ? { ...sf, status: 'stamping' } : sf)),
    );
    const creatorLocal = creator;
    for (const sf of pending) {
      const model = sf.model === 'other' ? sf.customModel.trim() : sf.model;
      try {
        const result = await stampAsset(sf.file, {
          model,
          prompt: sf.prompt,
          creator: creatorLocal,
        });
        setStagedFiles((prev) =>
          prev.map((s) => (s.id === sf.id ? { ...s, status: 'done', result } : s)),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setStagedFiles((prev) =>
          prev.map((s) => (s.id === sf.id ? { ...s, status: 'error', error: msg } : s)),
        );
        toast.error(`Stamping failed: ${sf.file.name}`, { description: msg });
      }
    }
    setStamping(false);
    console.log(`[trace] stamp ${pending.length} file(s): ${((performance.now() - t0) / 1000).toFixed(2)}s`);
    const successCount = pending.length;
    if (successCount > 0) {
      toast.success(`${successCount} asset${successCount === 1 ? '' : 's'} stamped`, {
        description: 'Provenance manifest attached — see results below',
      });
    }
    await refreshDashboard();
    // Scroll to results
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
  }, [stagedFiles, creator, refreshDashboard]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) addFiles(files);
    },
    [addFiles],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) addFiles(files);
      e.target.value = '';
    },
    [addFiles],
  );

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (typeFilter !== 'all' && a.file_type !== typeFilter) return false;
      if (searchQuery && !a.file_name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [assets, typeFilter, searchQuery]);

  const handleExportCsv = useCallback(() => {
    if (assets.length === 0) {
      toast.error('No assets to export');
      return;
    }
    const ts = new Date().toISOString().slice(0, 10);
    downloadCsv(`trace-assets-${ts}.csv`, assets);
    toast.success('Asset ledger exported', {
      description: `${assets.length} rows · trace-assets-${ts}.csv`,
    });
  }, [assets]);

  const completedResults = stagedFiles.filter((sf) => sf.status === 'done' && sf.result);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f7f8fa] to-[#eef2f7] dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#1F3A5F] to-[#2E5C8A] shadow-sm">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1F3A5F] dark:text-slate-100 leading-tight">Trace</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight hidden sm:block">
                The Provenance-First AI Content Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CreatorSwitcher active={creator} onActiveChange={setCreator} />
            <ThemeToggle />
            <a
              href="https://github.com/sodiq-code/trace"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-[#1F3A5F] dark:hover:text-white hover:border-[#1F3A5F] dark:hover:border-slate-500 transition-colors"
              aria-label="View source on GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
        {/* Backend offline banner */}
        {isDemoMode && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4"
          >
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 dark:text-amber-200">
              <p className="font-semibold mb-1">Backend offline (read-only fallback)</p>
              <p>
                The Trace provenance backend is not reachable right now, so uploads return a preview
                response instead of a real C2PA manifest. To stamp assets with real cryptographic
                provenance,{' '}
                <a
                  href="https://github.com/sodiq-code/trace"
                  className="underline font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  clone the repo
                </a>{' '}
                and run <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">trace serve</code> locally.
              </p>
            </div>
          </motion.div>
        )}

        {/* Hero / tagline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center space-y-3 pt-2"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#2E5C8A]/20 bg-[#2E5C8A]/5 dark:border-[#2E5C8A]/30 dark:bg-[#2E5C8A]/10 px-3 py-1 text-xs font-medium text-[#2E5C8A] dark:text-[#5b8ec0]">
            <Lock className="h-3 w-3" />
            C2PA · EU AI Act Article 50
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1F3A5F] dark:text-slate-100 leading-tight">
            Every AI-generated asset, provenance-tagged in one click.
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
            Cryptographically-verifiable C2PA manifests in under one second. Prove what AI
            generated, when, and how — permanently embedded in the file.
          </p>
          <div className="flex items-center justify-center gap-3 text-xs text-slate-400 dark:text-slate-500 pt-1">
            <span className="inline-flex items-center gap-1">
              <KeyRound className="h-3 w-3" /> ES256 signatures
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span className="inline-flex items-center gap-1">
              <Cpu className="h-3 w-3" /> c2pa-python 0.90.19
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> tamper-evident
            </span>
          </div>
        </motion.div>

        {/* How it works explainer */}
        <HowItWorks />

        {/* Drop zone */}
        <Card
          className={`border-2 border-dashed transition-all duration-200 ${
            dragging
              ? 'border-[#2E5C8A] bg-blue-50/50 dark:bg-blue-950/20 scale-[1.01] shadow-md'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#2E5C8A]/50'
          }`}
        >
          <CardContent
            className="p-8 sm:p-12"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <div className="flex flex-col items-center text-center gap-4">
              <motion.div
                animate={stamping ? { rotate: 360 } : {}}
                transition={stamping ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#1F3A5F]/5 to-[#2E5C8A]/10 dark:from-[#2E5C8A]/20 dark:to-[#1F3A5F]/20"
              >
                {stamping ? (
                  <Loader2 className="h-8 w-8 text-[#2E5C8A] animate-spin" />
                ) : (
                  <UploadCloud className="h-8 w-8 text-[#1F3A5F] dark:text-[#5b8ec0]" />
                )}
              </motion.div>
              <div>
                <p className="text-lg font-semibold text-[#1F3A5F] dark:text-slate-100">
                  {stamping ? 'Stamping…' : 'Drop AI-generated assets here'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  One or more files — PNG, JPEG, WEBP, SVG, WAV, MP3, MP4, MOV — up to 4.5 MB each (Vercel limit — run locally for larger files).
                  You can mix image, audio, and video; each gets its own model.
                </p>
              </div>
              <Button
                type="button"
                variant="default"
                className="bg-[#1F3A5F] hover:bg-[#2E5C8A] shadow-sm"
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

        {/* Staging area — per-file model selection */}
        <div ref={stagingRef}>
          <StagingArea
            files={stagedFiles}
            onUpdate={updateStaged}
            onRemove={removeStaged}
            onStampAll={handleStampAll}
            stamping={stamping}
            resultsRef={resultsRef}
          />
        </div>

        {/* Results — completed stamps */}
        <div ref={resultsRef}>
          {completedResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-[#1F3A5F] dark:text-slate-100 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[#2E8B57]" />
                Stamped assets
                <span className="text-xs font-normal text-slate-400">({completedResults.length})</span>
              </h3>
              {completedResults.map((sf) => (
                <motion.div
                  key={sf.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <Card className="bg-white dark:bg-slate-900 border-emerald-200 dark:border-emerald-800">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        {sf.result!.validation_state.toLowerCase() === 'valid' ? (
                          <CheckCircle2 className="h-5 w-5 text-[#2E8B57]" />
                        ) : (
                          <XCircle className="h-5 w-5 text-[#C0392B]" />
                        )}
                        <span className="text-[#1F3A5F] dark:text-slate-100">
                          {sf.result!._demo_mode ? 'Preview (backend offline)' : 'Provenance manifest attached'} —{' '}
                          {sf.result!.validation_state}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="uppercase">
                          {sf.result!.file_type}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs">
                          {sf.file.name}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs">
                          sha256: {sf.result!.file_hash.slice(0, 16)}…
                        </Badge>
                      </div>
                      <div className="grid gap-1.5 text-sm">
                        {sf.result!.assertions.map((a, j) => (
                          <div key={j} className="flex gap-2">
                            <span className="text-slate-500 dark:text-slate-400 min-w-[120px]">{a.name}:</span>
                            <span className="font-medium text-slate-900 dark:text-slate-100">{a.value}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        <a href={`/card/${sf.result!.asset_id}`}>
                          <Button variant="default" className="bg-[#1F3A5F] hover:bg-[#2E5C8A]">
                            View Provenance Card
                            <ExternalLink className="h-3.5 w-3.5 ml-2" />
                          </Button>
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Compliance stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          {loadingDashboard ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            <>
              <StatCard
                label="Assets stamped"
                value={stats?.total_assets ?? '—'}
                hint="this month"
                icon={<FileCheck2 className="h-4 w-4" />}
              />
              <StatCard
                label="Compliance rate"
                value={stats ? `${Math.round(stats.compliance_rate * 100)}%` : '—'}
                hint="stamped = compliant"
                accent="green"
                icon={<ShieldCheck className="h-4 w-4" />}
              />
              <StatCard
                label="Verifications"
                value={stats?.total_verifications ?? '—'}
                hint="third-party checks"
                icon={<Zap className="h-4 w-4" />}
              />
            </>
          )}
        </div>

        {/* Compliance charts */}
        {loadingDashboard ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-[260px] rounded-lg" />
            <Skeleton className="h-[260px] rounded-lg" />
          </div>
        ) : (
          <ComplianceCharts assets={assets} stats={stats} />
        )}

        {/* Export buttons */}
        <div className="flex justify-center gap-2 flex-wrap">
          <a href="/api/v1/report" download>
            <Button
              variant="outline"
              className="bg-white dark:bg-slate-900 border-[#1F3A5F] text-[#1F3A5F] dark:text-slate-100 dark:border-slate-600 hover:bg-[#1F3A5F] hover:text-white transition-colors"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Export Compliance Report (PDF)
            </Button>
          </a>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  onClick={handleExportCsv}
                  className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export Asset Ledger (CSV)
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download all {assets.length} stamped assets as a CSV spreadsheet</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Recent assets */}
        <Card className="bg-white dark:bg-slate-900">
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-base text-[#1F3A5F] dark:text-slate-100 flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent assets
                <span className="text-xs font-normal text-slate-400">
                  ({filteredAssets.length}/{assets.length})
                </span>
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search filename…"
                    className="h-8 w-40 pl-8 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
                  <Filter className="h-3 w-3 text-slate-400 ml-1.5 mr-0.5" />
                  {TYPE_FILTERS.map((f) => {
                    const Icon = f.icon;
                    return (
                      <button
                        key={f.value}
                        onClick={() => setTypeFilter(f.value)}
                        className={`rounded-md px-2 py-1 text-xs font-medium transition-colors inline-flex items-center gap-1 ${
                          typeFilter === f.value
                            ? 'bg-[#1F3A5F] text-white'
                            : 'text-slate-500 dark:text-slate-400 hover:text-[#1F3A5F] dark:hover:text-slate-100'
                        }`}
                      >
                        <Icon className="h-3 w-3" />
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingDashboard ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : assets.length === 0 ? (
              <div className="py-10 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                  <UploadCloud className="h-6 w-6 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No assets stamped yet</p>
                <p className="text-xs text-slate-400 mt-1">Drop a file above to attach your first provenance manifest.</p>
              </div>
            ) : filteredAssets.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">No assets match your filter.</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 text-[#2E5C8A]"
                  onClick={() => {
                    setTypeFilter('all');
                    setSearchQuery('');
                  }}
                >
                  Clear filters
                </Button>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto -mx-2 trace-scroll">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase sticky top-0 bg-white dark:bg-slate-900">
                    <tr>
                      <th className="text-left font-medium px-2 py-2">Asset</th>
                      <th className="text-left font-medium px-2 py-2">Type</th>
                      <th className="text-left font-medium px-2 py-2 hidden sm:table-cell">Stamped</th>
                      <th className="text-left font-medium px-2 py-2">Status</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.map((a) => (
                      <tr key={a.asset_id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-2 py-2 font-medium text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                          {a.file_name}
                        </td>
                        <td className="px-2 py-2">
                          <Badge variant="secondary" className="uppercase text-xs">
                            {a.file_type}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-slate-500 dark:text-slate-400 hidden sm:table-cell text-xs">
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
                            className="text-[#2E5C8A] hover:underline text-xs font-medium"
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

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm mt-auto">
        <div className="mx-auto max-w-5xl px-4 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
          <p className="mb-1">
            Trace generates cryptographically-verifiable C2PA manifests aligned with EU AI Act
            Article 50. Trace does not constitute legal advice.
          </p>
          <p className="text-slate-400">
            Built with c2pa-python · ES256 signatures ·{' '}
            <a
              href="https://github.com/sodiq-code/trace"
              className="underline hover:text-[#2E5C8A]"
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/sodiq-code/trace
            </a>
          </p>
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
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: 'green';
  icon?: React.ReactNode;
}) {
  return (
    <Card className="bg-white dark:bg-slate-900 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
          {icon && (
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-md ${
                accent === 'green' ? 'bg-emerald-50 text-[#2E8B57] dark:bg-emerald-950/40' : 'bg-[#1F3A5F]/5 text-[#1F3A5F] dark:bg-[#2E5C8A]/20 dark:text-[#5b8ec0]'
              }`}
            >
              {icon}
            </span>
          )}
        </div>
        <p
          className={`text-2xl font-bold mt-1.5 ${
            accent === 'green' ? 'text-[#2E8B57]' : 'text-[#1F3A5F] dark:text-slate-100'
          }`}
        >
          {value}
        </p>
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function SkeletonCard() {
  return (
    <Card className="bg-white dark:bg-slate-900">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
        <Skeleton className="h-7 w-16 mt-3" />
        <Skeleton className="h-3 w-24 mt-2" />
      </CardContent>
    </Card>
  );
}
