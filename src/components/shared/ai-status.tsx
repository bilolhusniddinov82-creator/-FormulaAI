"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useT } from "@/store/settings-store";

interface AiStatus {
  loaded: boolean;
  aiEnabled: boolean;
  model: string | null;
}

export const useAiStatus = create<AiStatus>(() => ({ loaded: false, aiEnabled: false, model: null }));

let requested = false;
function loadStatus() {
  if (requested) return;
  requested = true;
  fetch("/api/status")
    .then((r) => r.json())
    .then((d) => useAiStatus.setState({ loaded: true, aiEnabled: !!d.aiEnabled, model: d.model ?? null }))
    .catch(() => useAiStatus.setState({ loaded: true, aiEnabled: false }));
}

export function AiStatusBadge({ className }: { className?: string }) {
  const t = useT();
  const { loaded, aiEnabled } = useAiStatus();
  useEffect(loadStatus, []);
  if (!loaded) return null;
  return (
    <Tip label={aiEnabled ? t("mode.aiHint") : t("mode.demoHint")} side="bottom">
      <span
        tabIndex={0}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-full border bg-foreground/[0.04] px-3 text-xs font-medium text-foreground/80 outline-none transition-colors hover:bg-foreground/[0.08] focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <span className="relative flex h-2 w-2">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
              aiEnabled ? "bg-success" : "bg-violet",
            )}
          />
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", aiEnabled ? "bg-success" : "bg-violet")} />
        </span>
        {aiEnabled ? t("mode.ai") : t("mode.demo")}
      </span>
    </Tip>
  );
}
