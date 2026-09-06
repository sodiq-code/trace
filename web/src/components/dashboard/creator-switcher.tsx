'use client';

import { useEffect, useState } from 'react';
import { UserRound, Plus, Check, Trash2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
 DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

export interface CreatorProfile {
 email: string;
 channel?: string;
}

const STORAGE_KEY = 'trace:creator-profiles';
const ACTIVE_KEY = 'trace:active-creator';

const DEFAULT_PROFILES: CreatorProfile[] = [
 { email: 'maya@channel.com', channel: 'Maya Tech Reviews' },
];

function loadProfiles(): CreatorProfile[] {
 if (typeof window === 'undefined') return DEFAULT_PROFILES;
 try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_PROFILES;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PROFILES;
  return parsed;
 } catch {
  return DEFAULT_PROFILES;
 }
}

function loadActive(): string {
 if (typeof window === 'undefined') return DEFAULT_PROFILES[0].email;
 return localStorage.getItem(ACTIVE_KEY) || DEFAULT_PROFILES[0].email;
}

export function CreatorSwitcher({
 active,
 onActiveChange,
}: {
 active: string;
 onActiveChange: (email: string) => void;
}) {
 const [profiles, setProfiles] = useState<CreatorProfile[]>(DEFAULT_PROFILES);
 const [mounted, setMounted] = useState(false);
 const [newEmail, setNewEmail] = useState('');
 const [newChannel, setNewChannel] = useState('');
 const [adding, setAdding] = useState(false);

 /* eslint-disable react-hooks/set-state-in-effect */
 useEffect(() => {
  // Load profiles from localStorage on the client (SSR-safe hydration pattern).
  setProfiles(loadProfiles());
  setMounted(true);
 }, []);
 /* eslint-enable react-hooks/set-state-in-effect */

 useEffect(() => {
  if (!mounted) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
 }, [profiles, mounted]);

 useEffect(() => {
  if (!mounted) return;
  localStorage.setItem(ACTIVE_KEY, active);
 }, [active, mounted]);

 const activeProfile = profiles.find((p) => p.email === active) || profiles[0];

 const handleAdd = () => {
  const email = newEmail.trim().toLowerCase();
  if (!email || !email.includes('@')) {
   toast.error('Enter a valid email for the creator profile');
   return;
  }
  if (profiles.some((p) => p.email === email)) {
   toast.error('That creator already exists');
   return;
  }
  const next: CreatorProfile = { email, channel: newChannel.trim() || undefined };
  setProfiles((prev) => [...prev, next]);
  onActiveChange(email);
  setNewEmail('');
  setNewChannel('');
  setAdding(false);
  toast.success('Creator profile added', { description: email });
 };

 const handleDelete = (email: string) => {
  if (profiles.length <= 1) {
   toast.error('You need at least one creator profile');
   return;
  }
  const next = profiles.filter((p) => p.email !== email);
  setProfiles(next);
  if (active === email) {
   onActiveChange(next[0].email);
  }
  toast.success('Creator profile removed');
 };

 if (!mounted) {
  return (
   <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 hidden sm:flex">
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5" />
    {active}
   </Badge>
  );
 }

 return (
  <DropdownMenu>
   <DropdownMenuTrigger asChild>
    <button
     className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
     aria-label="Switch creator profile"
    >
     <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
      <UserRound className="h-3 w-3" />
     </span>
     <span className="max-w-[140px] truncate">{activeProfile?.channel || activeProfile?.email || active}</span>
     <ChevronDown className="h-3 w-3 opacity-60" />
    </button>
   </DropdownMenuTrigger>
   <DropdownMenuContent align="end" className="w-72">
    <DropdownMenuLabel className="text-xs text-slate-500 uppercase tracking-wide">
     Creator profiles
    </DropdownMenuLabel>
    {profiles.map((p) => (
     <DropdownMenuItem
      key={p.email}
      onClick={() => onActiveChange(p.email)}
      className="flex items-start justify-between gap-2 py-2 cursor-pointer"
     >
      <div className="min-w-0 flex-1">
       <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
         {p.channel || p.email}
        </span>
        {p.email === active && <Check className="h-3.5 w-3.5 text-[#2E5C8A] shrink-0" />}
       </div>
       {p.channel && (
        <span className="text-xs text-slate-500 truncate block">{p.email}</span>
       )}
      </div>
      {profiles.length > 1 && (
       <button
        onClick={(e) => {
         e.stopPropagation();
         handleDelete(p.email);
        }}
        className="shrink-0 text-slate-400 hover:text-[#C0392B] transition-colors p-1"
        aria-label={`Delete ${p.email}`}
       >
        <Trash2 className="h-3.5 w-3.5" />
       </button>
      )}
     </DropdownMenuItem>
    ))}
    <DropdownMenuSeparator />
    {adding ? (
     <div className="p-2 space-y-2">
      <Input
       placeholder="email@channel.com"
       value={newEmail}
       onChange={(e) => setNewEmail(e.target.value)}
       className="h-8 text-xs"
       autoFocus
      />
      <Input
       placeholder="Channel name (optional)"
       value={newChannel}
       onChange={(e) => setNewChannel(e.target.value)}
       className="h-8 text-xs"
      />
      <div className="flex gap-2">
       <Button size="sm" className="h-7 text-xs flex-1 bg-[#1F3A5F] hover:bg-[#2E5C8A]" onClick={handleAdd}>
        <Plus className="h-3 w-3 mr-1" /> Add
       </Button>
       <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setAdding(false)}>
        Cancel
       </Button>
      </div>
     </div>
    ) : (
     <DropdownMenuItem
      onClick={() => setAdding(true)}
      className="flex items-center gap-2 cursor-pointer text-[#2E5C8A]"
     >
      <Plus className="h-4 w-4" />
      <span className="text-sm">Add creator profile</span>
     </DropdownMenuItem>
    )}
   </DropdownMenuContent>
  </DropdownMenu>
 );
}
