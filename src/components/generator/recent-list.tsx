"use client";

import { useRouter } from "next/navigation";
import { Bot, Clock, FlaskConical } from "lucide-react";
import { FormulaCode } from "./formula-code";
import { EmptyState } from "@/components/shared/page-header";
import { useHydrated } from "@/components/layout/providers";
import type { HistoryItem } from "@/lib/types";
import { useGenerator } from "@/store/generator-store";
import { useHistory } from "@/store/history-store";
import { useT } from "@/store/settings-store";

export function timeAgo(ts: number, lang: string) {
  const rtf = new Intl.RelativeTimeFormat(lang === "uz" ? "uz" : lang, { numeric: "auto" });
  const diff = (ts - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, "second"],
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
    [Infinity, "week"],
  ];
  let prev = 1;
  for (const [limit, unit] of steps) {
    if (Math.abs(diff) < limit) return rtf.format(Math.round(diff / prev), unit);
    prev = limit;
  }
  return new Date(ts).toLocaleDateString();
}

export function HistoryCard({ item, onOpen }: { item: HistoryItem; onOpen: () => void }) {
  const first = item.result.formulas[0];
  return (
    <button
      type="button"
      onClick={onOpen}
      className="glass lift flex w-full flex-col gap-2.5 rounded-2xl p-5 text-left"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {item.source === "ai" ? <Bot className="h-3.5 w-3.5 text-violet" /> : <FlaskConical className="h-3.5 w-3.5 text-amber-500" />}
        <Clock className="h-3 w-3" />
        {timeAgo(item.createdAt, item.language)}
        <span className="ml-auto uppercase">{item.language}</span>
      </div>
      <p className="line-clamp-2 text-sm font-medium">{item.prompt}</p>
      {first && (
        <div className="truncate rounded-md bg-muted/70 px-2 py-1">
          <FormulaCode formula={first.formula} className="text-xs" />
        </div>
      )}
    </button>
  );
}

export function RecentList({ limit = 6 }: { limit?: number }) {
  const t = useT();
  const router = useRouter();
  const ready = useHydrated((s) => s.ready);
  const items = useHistory((s) => s.items);
  const show = useGenerator((s) => s.show);

  if (!ready) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }
  if (items.length === 0) return <EmptyState icon={Clock} title={t("recent.empty")} />;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.slice(0, limit).map((item) => (
        <HistoryCard
          key={item.id}
          item={item}
          onOpen={() => {
            show(item);
            router.push("/formula-generator");
          }}
        />
      ))}
    </div>
  );
}
