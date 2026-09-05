'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowLeft,
  Fingerprint,
  Clock,
  User,
  Cpu,
  FileText,
  KeyRound,
  Code2,
  Copy,
  Check,
  ChevronDown,
  History,
  ShieldAlert,
  Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getManifest, verifyAsset, type ManifestResponse, type VerifyResponse } from '@/lib/trace-api';
import { toast } from 'sonner';

export default function ProvenanceCardPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>('');
  const [manifest, setManifest] = useState<ManifestResponse | null>(null);
  const [verify, setVerify] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string>('');
  const [showManifest, setShowManifest] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const loadManifest = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const m = await getManifest(id);
      setManifest(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load manifest');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadManifest();
  }, [loadManifest]);

  const handleVerify = useCallback(async () => {
    if (!id) return;
    setVerifying(true);
    try {
      const v = await verifyAsset(id);
      setVerify(v);
      toast.success('Cryptographic verification complete', {
        description: `Signature ${v.manifest.signature_valid ? 'VALID' : 'INVALID'}`,
      });
    } catch (err) {
      toast.error('Verification failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setVerifying(false);
    }
  }, [id]);

  const handleCopyManifest = useCallback(() => {
    if (!manifest?.manifest_json) return;
    navigator.clipboard.writeText(manifest.manifest_json).then(() => {
      setCopied(true);
      toast.success('Manifest JSON copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  }, [manifest]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#f7f8fa] to-[#eef2f7]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 text-[#2E5C8A] animate-spin" />
          <p className="text-sm text-slate-500">Loading provenance manifest…</p>
        </div>
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#f7f8fa] to-[#eef2f7] gap-4">
        <XCircle className="h-12 w-12 text-[#C0392B]" />
        <p className="text-slate-700 font-medium">{error || 'Asset not found'}</p>
        <a href="/">
          <Button variant="outline">← Back to dashboard</Button>
        </a>
      </div>
    );
  }

  const valid = manifest.signature_valid;
  const fileName = manifest.file_path.split('/').pop() || 'asset';
  const prettyManifest = (() => {
    try {
      return JSON.stringify(JSON.parse(manifest.manifest_json), null, 2);
    } catch {
      return manifest.manifest_json;
    }
  })();

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-[#f7f8fa] to-[#eef2f7]">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <a href="/" className="text-slate-500 hover:text-[#1F3A5F] transition-colors" aria-label="Back to dashboard">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#1F3A5F] to-[#2E5C8A]">
              <ShieldCheck className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-[#1F3A5F]">Trace Provenance Card</span>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-2xl px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-white shadow-sm">
            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Asset header */}
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-xl font-bold text-[#1F3A5F] truncate">{fileName}</h1>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="uppercase">{manifest.file_type}</Badge>
                    <span className="text-xs text-slate-400 font-mono">
                      {manifest.file_hash.slice(0, 20)}…
                    </span>
                  </div>
                </div>
              </div>

              {/* The green compliance checkmark — largest element (report Sec 29.1 principle 1) */}
              <div className="flex flex-col items-center py-4">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 200, delay: 0.15 }}
                  className={`flex h-24 w-24 items-center justify-center rounded-full shadow-lg ${
                    valid ? 'bg-[#2E8B57] shadow-emerald-200' : 'bg-[#C0392B] shadow-red-200'
                  }`}
                >
                  {valid ? (
                    <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />
                  ) : (
                    <XCircle className="h-12 w-12 text-white" strokeWidth={2.5} />
                  )}
                </motion.div>
                <p
                  className={`mt-3 text-lg font-bold ${
                    valid ? 'text-[#2E8B57]' : 'text-[#C0392B]'
                  }`}
                >
                  Cryptographic signature: {valid ? 'VALID' : 'INVALID'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {manifest.validation_state} · {manifest.claim_generator}
                </p>
              </div>

              {/* Source chain timeline (report Sec 29.3) */}
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Source chain
                </h2>
                <div className="border-l-2 border-slate-200 pl-4 space-y-4">
                  <TimelineItem
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Asset created"
                    value={new Date(manifest.created_at).toLocaleString()}
                  />
                  <TimelineItem
                    icon={<Cpu className="h-3.5 w-3.5" />}
                    label="Generated using"
                    value={manifest.assertions.find((a) => a.name === 'Generated using')?.value || manifest.claim_generator}
                  />
                  <TimelineItem
                    icon={<FileText className="h-3.5 w-3.5" />}
                    label="Prompt"
                    value={manifest.assertions.find((a) => a.name === 'Prompt')?.value || '—'}
                  />
                  <TimelineItem
                    icon={<User className="h-3.5 w-3.5" />}
                    label="Manifest signed by"
                    value={manifest.signed_by || '—'}
                  />
                  <TimelineItem
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label="Signed at"
                    value={manifest.signed_at ? new Date(manifest.signed_at).toLocaleString() : '—'}
                  />
                  <TimelineItem
                    icon={<KeyRound className="h-3.5 w-3.5" />}
                    label="Cryptographic signature"
                    value={valid ? 'VALID (claim signature verified)' : 'INVALID'}
                    highlight={valid ? 'green' : 'red'}
                  />
                </div>
              </div>

              {/* All assertions (creator-readable) */}
              <div className="space-y-2">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                  Provenance assertions
                </h2>
                <div className="grid gap-1.5">
                  {manifest.assertions.map((a, i) => (
                    <div key={i} className="flex gap-3 text-sm py-1 border-b border-slate-50 last:border-0">
                      <span className="text-slate-500 min-w-[140px]">{a.name}</span>
                      <span className="font-medium text-slate-900 break-all">{a.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verify button (report Sec 29.3 bottom) */}
              <Button
                onClick={handleVerify}
                disabled={verifying}
                className="w-full bg-[#1F3A5F] hover:bg-[#2E5C8A] h-11 shadow-sm"
              >
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  <>
                    <Fingerprint className="h-4 w-4 mr-2" />
                    Verify cryptographically
                  </>
                )}
              </Button>

              {/* Inline verification result */}
              {verify && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`rounded-lg p-4 border ${
                    verify.manifest.signature_valid
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {verify.manifest.signature_valid ? (
                      <CheckCircle2 className="h-5 w-5 text-[#2E8B57]" />
                    ) : (
                      <XCircle className="h-5 w-5 text-[#C0392B]" />
                    )}
                    <span className="font-semibold text-slate-900">
                      Verification result: {verify.manifest.signature_valid ? '200 OK — signature valid' : 'signature invalid'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {verify.verifications.length} verification(s) logged ·{' '}
                    {verify.manifest.validation_state}
                  </p>
                </motion.div>
              )}

              {/* Verification history (when available) */}
              {verify && verify.verifications.length > 0 && (
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                    <History className="h-3.5 w-3.5" />
                    Verification history
                  </h2>
                  <div className="border-l-2 border-slate-200 pl-4 space-y-2.5">
                    {verify.verifications.map((v, i) => (
                      <div key={i} className="relative">
                        <div
                          className={`absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-white border-2 ${
                            v.result === 'valid' ? 'border-[#2E8B57]' : 'border-[#C0392B]'
                          }`}
                        />
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-slate-500">
                            {new Date(v.verified_at).toLocaleString()}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              v.result === 'valid'
                                ? 'text-[#2E8B57] border-[#2E8B57]/30 bg-emerald-50'
                                : 'text-[#C0392B] border-[#C0392B]/30 bg-red-50'
                            }`}
                          >
                            {v.result}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manifest inspector (collapsible raw JSON) */}
              <div className="space-y-2">
                <button
                  onClick={() => setShowManifest((s) => !s)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-slate-700 uppercase tracking-wide hover:text-[#1F3A5F] transition-colors py-1"
                >
                  <span className="flex items-center gap-2">
                    <Code2 className="h-3.5 w-3.5" />
                    Raw C2PA manifest
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${showManifest ? 'rotate-180' : ''}`}
                  />
                </button>
                {showManifest && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">
                        The full C2PA manifest embedded in this file (JSON)
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyManifest}
                        className="h-7 text-xs"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3 w-3 mr-1" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3 mr-1" /> Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <pre className="trace-json max-h-72 overflow-auto rounded-lg bg-slate-900 text-slate-100 p-4 text-xs font-mono leading-relaxed">
                      {prettyManifest}
                    </pre>
                  </motion.div>
                )}
              </div>

              {/* Meta footer */}
              <div className="flex justify-between text-xs text-slate-400 pt-4 border-t border-slate-100">
                <span>
                  asset_id: <code className="font-mono">{manifest.asset_id.slice(0, 13)}…</code>
                </span>
                <span>
                  sha256: <code className="font-mono">{manifest.file_hash.slice(0, 16)}…</code>
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-400">
          <a
            href={`/api/v1/manifest/${manifest.asset_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-[#2E5C8A] transition-colors"
          >
            <Download className="h-3 w-3" />
            Manifest API
          </a>
          <span className="text-slate-300">·</span>
          <a
            href={`/api/v1/verify/${manifest.asset_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-[#2E5C8A] transition-colors"
          >
            <ShieldAlert className="h-3 w-3" />
            Verify API
          </a>
        </div>
        <p className="text-center text-xs text-slate-400 mt-3">
          Generated by Trace — The Provenance-First AI Content Engine. Trace does not constitute
          legal advice.
        </p>
      </main>
    </div>
  );
}

function TimelineItem({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: 'green' | 'red';
}) {
  return (
    <div className="relative">
      <div className="absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-white border-2 border-[#2E5C8A]" />
      <div className="flex items-center gap-1.5 text-xs text-slate-500 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p
        className={`text-sm font-medium mt-0.5 ${
          highlight === 'green'
            ? 'text-[#2E8B57]'
            : highlight === 'red'
              ? 'text-[#C0392B]'
              : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
