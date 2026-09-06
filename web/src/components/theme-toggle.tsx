'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check } from 'lucide-react';

export function ThemeToggle() {
 const { theme, setTheme } = useTheme();
 const [mounted, setMounted] = useState(false);

 // Avoid hydration mismatch by rendering only after mount.
 // eslint-disable-next-line react-hooks/set-state-in-effect
 useEffect(() => setMounted(true), []);

 if (!mounted) {
  return (
   <Button
    variant="outline"
    size="icon"
    className="h-9 w-9 border-slate-200 bg-white"
    aria-label="Toggle theme"
   >
    <Sun className="h-4 w-4" />
   </Button>
  );
 }

 const options: { value: 'light' | 'dark' | 'system'; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
 ];

 const active = options.find((o) => o.value === theme) || options[2];

 return (
  <DropdownMenu>
   <DropdownMenuTrigger asChild>
    <Button
     variant="outline"
     size="icon"
     className="h-9 w-9 border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
     aria-label="Toggle theme"
    >
     {active.icon}
    </Button>
   </DropdownMenuTrigger>
   <DropdownMenuContent align="end" className="min-w-[140px]">
    {options.map((o) => (
     <DropdownMenuItem
      key={o.value}
      onClick={() => setTheme(o.value)}
      className="flex items-center justify-between gap-2 cursor-pointer"
     >
      <span className="flex items-center gap-2">
       {o.icon}
       {o.label}
      </span>
      {theme === o.value && <Check className="h-3.5 w-3.5 text-[#2E5C8A]" />}
     </DropdownMenuItem>
    ))}
   </DropdownMenuContent>
  </DropdownMenu>
 );
}
