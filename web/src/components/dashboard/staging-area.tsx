'use client';

import { useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
 Image as ImageIcon,
 Music,
 Video,
 FileText,
 X,
 Sparkles,
 Cpu,
 Loader2,
 CheckCircle2,
 XCircle,
 ExternalLink,
 Wand2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { StampResponse } from '@/lib/trace-api';

export interface StagedFile {
 id: string;
 file: File;
 model: string;
 customModel: string;
 prompt: string;
 status: 'pending' | 'stamping' | 'done' | 'error';
 result?: StampResponse;
 error?: string;
}

export interface ModelOption {
 value: string;
 label: string;
 types: ('image' | 'audio' | 'video')[];
}

// Latest AI model names (2026). Grouped by supported file types so the
// staging area can show only the models that match each file's type.
export const AI_MODELS: ModelOption[] = [
 // --- Image models ---
 { value: 'midjourney-v7', label: 'Midjourney v7', types: ['image'] },
 { value: 'gpt-5-image', label: 'GPT-5 Image', types: ['image'] },
 { value: 'flux-1-1-pro', label: 'Flux 1.1 Pro', types: ['image'] },
 { value: 'stable-diffusion-3-5', label: 'Stable Diffusion 3.5', types: ['image'] },
 { value: 'ideogram-v3', label: 'Ideogram v3', types: ['image'] },
 { value: 'recraft-v3', label: 'Recraft v3', types: ['image'] },
 { value: 'gemini-3-pro', label: 'Gemini 3 Pro', types: ['image', 'video'] },
 // --- Audio models ---
 { value: 'elevenlabs-v3', label: 'ElevenLabs v3', types: ['audio'] },
 { value: 'suno-v4', label: 'Suno v4', types: ['audio'] },
 // --- Video models ---
 { value: 'sora-2', label: 'Sora 2', types: ['video'] },
 { value: 'runway-gen4', label: 'Runway Gen-4', types: ['video'] },
 { value: 'veo-3', label: 'Veo 3', types: ['video'] },
 { value: 'kling-2-0', label: 'Kling 2.0', types: ['video'] },
 // --- Other ---
 { value: 'other', label: 'Other (type below)', types: ['image', 'audio', 'video'] },
];

/** Detect the file type from a File's MIME type or extension. */
export function detectFileType(file: File): 'image' | 'audio' | 'video' {
 const mime = file.type.toLowerCase();
 if (mime.startsWith('image/')) return 'image';
 if (mime.startsWith('audio/')) return 'audio';
 if (mime.startsWith('video/')) return 'video';
 // Fallback: check extension
 const ext = file.name.toLowerCase().split('.').pop() || '';
 if (['png', 'jpg', 'jpeg', 'webp', 'avif', 'gif', 'svg', 'tiff', 'heic'].includes(ext)) return 'image';
 if (['wav', 'mp3', 'flac', 'm4a', 'ogg'].includes(ext)) return 'audio';
 if (['mp4', 'mov', 'avi', 'm4v', 'webm'].includes(ext)) return 'video';
 return 'image';
}

/** Auto-suggest a model based on the file type. */
export function suggestModel(fileType: 'image' | 'audio' | 'video'): string {
 if (fileType === 'image') return 'midjourney-v7';
 if (fileType === 'audio') return 'elevenlabs-v3';
 return 'sora-2';
}

const TYPE_ICON = {
 image: ImageIcon,
 audio: Music,
 video: Video,
} as const;

const TYPE_COLOR = {
 image: 'text-[#2E5C8A] bg-[#2E5C8A]/5',
 audio: 'text-[#2E8B57] bg-[#2E8B57]/5',
 video: 'text-[#1F3A5F] bg-[#1F3A5F]/5',
} as const;

function formatSize(bytes: number): string {
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StagingArea({
 files,
 onUpdate,
 onRemove,
 onStampAll,
 stamping,
 resultsRef,
}: {
 files: StagedFile[];
 onUpdate: (id: string, patch: Partial<StagedFile>) => void;
 onRemove: (id: string) => void;
 onStampAll: () => void;
 stamping: boolean;
 resultsRef: React.RefObject<HTMLDivElement | null>;
}) {
 const allHaveModel = useMemo(
  () =>
   files.every((f) => {
    const m = f.model === 'other' ? f.customModel.trim() : f.model;
    return m && m.length > 0;
   }),
  [files],
 );

 const handleScrollToResults = useCallback(() => {
  setTimeout(() => {
   resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
 }, [resultsRef]);

 if (files.length === 0) return null;

 return (
  <motion.div
   initial={{ opacity: 0, y: 12 }}
   animate={{ opacity: 1, y: 0 }}
  >
   <Card className="bg-white dark:bg-slate-900 border-[#2E5C8A]/30">
    <CardHeader className="pb-3">
     <CardTitle className="text-base text-[#1F3A5F] dark:text-slate-100 flex items-center gap-2">
      <Wand2 className="h-4 w-4" />
      Staged files
      <span className="text-xs font-normal text-slate-400">
       ({files.length}) — pick a model for each, then stamp
      </span>
     </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
     {files.map((sf) => {
      const fileType = detectFileType(sf.file);
      const Icon = TYPE_ICON[fileType];
      const modelsForType = AI_MODELS.filter((m) => m.types.includes(fileType));
      return (
       <div
        key={sf.id}
        className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-3 bg-slate-50/50 dark:bg-slate-800/30"
       >
        {/* File header */}
        <div className="flex items-start justify-between gap-2">
         <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div
           className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TYPE_COLOR[fileType]}`}
          >
           <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
           <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            {sf.file.name}
           </p>
           <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="uppercase text-[10px] h-5">
             {fileType}
            </Badge>
            <span className="text-xs text-slate-400">{formatSize(sf.file.size)}</span>
           </div>
          </div>
         </div>
         {sf.status === 'done' ? (
          <CheckCircle2 className="h-5 w-5 text-[#2E8B57] shrink-0" />
         ) : sf.status === 'error' ? (
          <XCircle className="h-5 w-5 text-[#C0392B] shrink-0" />
         ) : sf.status === 'stamping' ? (
          <Loader2 className="h-5 w-5 text-[#2E5C8A] animate-spin shrink-0" />
         ) : (
          <button
           onClick={() => onRemove(sf.id)}
           disabled={stamping}
           className="shrink-0 text-slate-400 hover:text-[#C0392B] transition-colors p-1 rounded disabled:opacity-40"
           aria-label="Remove file"
          >
           <X className="h-4 w-4" />
          </button>
         )}
        </div>

        {/* Per-file model + prompt */}
        {sf.status === 'pending' && (
         <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
           <Label className="text-xs text-slate-500 dark:text-slate-400">AI model</Label>
           <select
            value={sf.model}
            onChange={(e) => onUpdate(sf.id, { model: e.target.value })}
            className="flex h-8 w-full rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:border-slate-700 dark:bg-slate-950"
           >
            {modelsForType.map((m) => (
             <option key={m.value} value={m.value}>
              {m.label}
             </option>
            ))}
           </select>
           {sf.model === 'other' && (
            <Input
             className="h-8 mt-1"
             placeholder="Type the model name"
             value={sf.customModel}
             onChange={(e) => onUpdate(sf.id, { customModel: e.target.value })}
            />
           )}
          </div>
          <div className="space-y-1">
           <Label className="text-xs text-slate-500 dark:text-slate-400">Prompt</Label>
           <Input
            className="h-8"
            placeholder='e.g. "neon tech thumbnail"'
            value={sf.prompt}
            onChange={(e) => onUpdate(sf.id, { prompt: e.target.value })}
           />
          </div>
         </div>
        )}

        {/* Result / error inline */}
        {sf.status === 'done' && sf.result && (
         <div className="flex items-center gap-3 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-2.5">
          <CheckCircle2 className="h-4 w-4 text-[#2E8B57] shrink-0" />
          <div className="flex-1 min-w-0">
           <p className="text-xs font-medium text-[#2E8B57]">
            {sf.result.validation_state} · sha256:{sf.result.file_hash.slice(0, 12)}…
           </p>
          </div>
          <a href={`/card/${sf.result.asset_id}`}>
           <Button size="sm" className="h-7 text-xs bg-[#1F3A5F] hover:bg-[#2E5C8A]">
            View Card <ExternalLink className="h-3 w-3 ml-1" />
           </Button>
          </a>
         </div>
        )}
        {sf.status === 'error' && (
         <div className="flex items-start gap-2 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-2.5">
          <XCircle className="h-4 w-4 text-[#C0392B] shrink-0 mt-0.5" />
          <p className="text-xs text-[#C0392B] break-all">{sf.error}</p>
         </div>
        )}
       </div>
      );
     })}

     {/* Stamp all button */}
     {files.some((f) => f.status === 'pending') && (
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
       <p className="text-xs text-slate-400">
        {allHaveModel ? (
         <span className="flex items-center gap-1 text-[#2E8B57]">
          <Sparkles className="h-3 w-3" /> Ready to stamp
         </span>
        ) : (
         <span className="flex items-center gap-1 text-amber-600">
          <Cpu className="h-3 w-3" /> Select a model for each file
         </span>
        )}
       </p>
       <Button
        onClick={() => {
         onStampAll();
         handleScrollToResults();
        }}
        disabled={stamping || !allHaveModel}
        className="bg-[#1F3A5F] hover:bg-[#2E5C8A]"
       >
        {stamping ? (
         <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Stamping…
         </>
        ) : (
         <>
          <Wand2 className="h-4 w-4 mr-2" />
          Stamp {files.filter((f) => f.status === 'pending').length} file
          {files.filter((f) => f.status === 'pending').length === 1 ? '' : 's'}
         </>
        )}
       </Button>
      </div>
     )}
    </CardContent>
   </Card>
  </motion.div>
 );
}
