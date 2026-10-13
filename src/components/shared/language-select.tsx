"use client";

import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LANGUAGES, type Language } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settings-store";

/** Compact language menu for the navbar. */
export function LanguageSwitcher() {
  const language = useSettings((s) => s.language);
  const set = useSettings((s) => s.set);
  const current = LANGUAGES.find((l) => l.value === language)!;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 px-2.5" aria-label="Language">
          <Languages />
          <span className="text-xs font-semibold">{current.short}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem key={l.value} onSelect={() => set({ language: l.value })}>
            <span className="w-6 text-xs font-semibold text-muted-foreground">{l.short}</span>
            {l.label}
            {l.value === language && <Check className="ml-auto text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Segmented control: Uzbek / Russian / English. */
export function LanguageSegmented({
  value,
  onChange,
  className,
}: {
  value: Language;
  onChange: (l: Language) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-lg border bg-muted/50 p-0.5", className)}>
      {LANGUAGES.map((l) => (
        <button
          key={l.value}
          type="button"
          role="radio"
          aria-checked={value === l.value}
          onClick={() => onChange(l.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-all",
            value === l.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
