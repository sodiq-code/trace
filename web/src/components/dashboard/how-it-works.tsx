'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
 UploadCloud,
 Cpu,
 ShieldCheck,
 FileCheck2,
 Fingerprint,
 ScrollText,
 ChevronDown,
} from 'lucide-react';
import {
 Accordion,
 AccordionContent,
 AccordionItem,
 AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const STEPS = [
 {
  icon: UploadCloud,
  title: '1. Drop an AI-generated asset',
  body: 'PNG, JPEG, WEBP, SVG, WAV, MP3, or MP4. You can drag multiple files at once — each gets its own manifest.',
 },
 {
  icon: Cpu,
  title: '2. Declare the source',
  body: 'You tell Trace which AI model generated the asset and what prompt you used. Trace never auto-detects — the creator attests to the source.',
 },
 {
  icon: ShieldCheck,
  title: '3. Trace embeds a C2PA manifest',
  body: 'A signed C2PA manifest is embedded directly inside the file (not a sidecar). It carries the creator, model, prompt, and a cryptographic claim signature (ES256).',
 },
 {
  icon: FileCheck2,
  title: '4. Share the Provenance Card',
  body: 'Every stamped asset gets a shareable Provenance Card URL. An editor, brand, or viewer can verify the signature in one click — no account needed.',
 },
];

const FAQ = [
 {
  q: 'What is C2PA?',
  a: 'C2PA (Coalition for Content Provenance and Authenticity) is the open standard for content provenance, co-founded by Adobe, Microsoft, BBC, Nikon, Sony, and Truepic. A C2PA manifest is a cryptographically-signed record embedded in a media file that documents its origin and edit history. Trace uses c2pa-python (the official Rust-backed SDK, sdk_version 0.90.19).',
 },
 {
  q: 'How does this comply with the EU AI Act?',
  a: 'EU AI Act Article 50 requires providers of AI-generated content to mark it as artificially generated and disclose its AI origin. Trace records the AI model (softwareAgent), the digital source type (trainedAlgorithmicMedia), the creator, and the prompt — all inside a tamper-evident, cryptographically-signed C2PA manifest. This is exactly the transparency metadata Article 50 calls for.',
 },
 {
  q: 'Is the signature real cryptography?',
  a: 'Yes. Trace signs every manifest with an ES256 (ECDSA P-256) key. The c2pa-python Reader validates the claim signature, the RFC 3161 timestamp, and the hashed-URI bindings of every assertion. The demo uses the official C2PA test cert; production swaps in a CA-trusted signing certificate.',
 },
 {
  q: 'What happens if someone edits the file after stamping?',
  a: 'The C2PA manifest is tamper-evident. Any modification to the asset bytes invalidates the data hash; any modification to the manifest breaks the signature. Re-running Trace verify on a tampered file returns signature_valid: false.',
 },
 {
  q: 'Does Trace store a copy of my files?',
  a: 'No. Trace stores only the manifest metadata (creator, model, prompt, hash, timestamps) in a local SQLite database for the dashboard. The signed asset file lives on your machine. The manifest is embedded in the file itself — verification reads it from the file, not from any server.',
 },
];

export function HowItWorks() {
 const [openItem, setOpenItem] = useState<string | undefined>('item-0');

 return (
  <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
   <CardHeader>
    <CardTitle className="text-base text-[#1F3A5F] dark:text-slate-100 flex items-center gap-2">
     <ScrollText className="h-4 w-4" />
     How Trace works
     <Badge variant="outline" className="ml-1 text-[10px] font-normal text-slate-400 border-slate-200">
      how it works
     </Badge>
    </CardTitle>
   </CardHeader>
   <CardContent className="space-y-6">
    {/* Visual flow steps */}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
     {STEPS.map((step, i) => {
      const Icon = step.icon;
      return (
       <motion.div
        key={i}
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: i * 0.08, duration: 0.3 }}
        className="relative rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 p-4"
       >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#1F3A5F] to-[#2E5C8A] text-white shadow-sm">
         <Icon className="h-4 w-4" />
        </div>
        <p className="mt-3 text-sm font-semibold text-[#1F3A5F] dark:text-slate-100">
         {step.title}
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
         {step.body}
        </p>
        {i < STEPS.length - 1 && (
         <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600">
          <ChevronDown className="h-4 w-4 rotate-[-90deg]" />
         </div>
        )}
       </motion.div>
      );
     })}
    </div>

    {/* FAQ accordion */}
    <div>
     <Accordion
      type="single"
      collapsible
      value={openItem}
      onValueChange={setOpenItem}
      className="w-full"
     >
      {FAQ.map((item, i) => (
       <AccordionItem
        key={i}
        value={`item-${i}`}
        className="border-slate-200 dark:border-slate-700"
       >
        <AccordionTrigger className="text-sm font-medium text-[#1F3A5F] dark:text-slate-100 hover:no-underline">
         {item.q}
        </AccordionTrigger>
        <AccordionContent className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
         {item.a}
        </AccordionContent>
       </AccordionItem>
      ))}
     </Accordion>
    </div>

    {/* Footer badge */}
    <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
     <Fingerprint className="h-3.5 w-3.5" />
     Built on the C2PA open standard · c2pa-python SDK 0.90.19 · ES256 signatures
    </div>
   </CardContent>
  </Card>
 );
}
