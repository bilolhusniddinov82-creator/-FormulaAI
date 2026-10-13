"use client";

import { useMemo, useState } from "react";
import { Bot, Check } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { PromptForm } from "@/components/generator/prompt-form";
import { ResultSkeleton, ResultView } from "@/components/generator/result-view";
import { colToLetters } from "@/lib/formula";
import { lastDataRow } from "@/lib/sheet-ops";
import { cn } from "@/lib/utils";
import { useGenerator } from "@/store/generator-store";
import { useT } from "@/store/settings-store";
import { useSheet } from "@/store/sheet-store";

const QUICK = [
  { fn: "SUM", label: "Σ SUM" },
  { fn: "AVERAGE", label: "AVERAGE" },
  { fn: "MAX", label: "MAX" },
  { fn: "MIN", label: "MIN" },
  { fn: "COUNT", label: "COUNT" },
] as const;

export function AssistantPanel() {
  const t = useT();
  const sheet = useSheet((s) => s.sheet);
  const insertFormula = useSheet((s) => s.insertFormula);
  const { status, response } = useGenerator();
  const [selected, setSelected] = useState<string[]>([]);

  const columns = useMemo(
    () =>
      (sheet.cells[0] ?? [])
        .map((h, c) => ({ letter: colToLetters(c), header: h.trim() }))
        .filter((c) => c.header !== ""),
    [sheet.cells],
  );
  const last = lastDataRow(sheet.cells);

  const toggle = (letter: string) =>
    setSelected((s) => (s.includes(letter) ? s.filter((x) => x !== letter) : [...s, letter]));

  const quick = (fn: (typeof QUICK)[number]["fn"]) => {
    const targets = selected.length ? selected : [];
    if (!targets.length || last < 1) {
      toast.info(t("sheet.chooseColumns"));
      return;
    }
    for (const letter of targets) {
      const formula = `=${fn}(${letter}2:${letter}${last + 1})`;
      insertFormula({ formula, targetCell: `${letter}${last + 3}`, fillDown: false, label: fn });
    }
    toast.success(t("result.inserted"));
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-violet text-white">
            <Bot className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">{t("sheet.assistant")}</h2>
            <p className="text-xs text-muted-foreground">{t("sheet.assistantDesc")}</p>
          </div>
        </div>

        <p className="mb-2 text-xs font-medium">{t("sheet.chooseColumns")}</p>
        <div className="mb-1 flex flex-wrap gap-1.5">
          {columns.map((c) => {
            const on = selected.includes(c.letter);
            return (
              <button
                key={c.letter}
                type="button"
                onClick={() => toggle(c.letter)}
                aria-pressed={on}
                className={cn(
                  "flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/50 hover:bg-muted",
                )}
              >
                {on && <Check className="h-3 w-3" />}
                <b className="font-mono">{c.letter}</b>
                <span className="truncate">{c.header}</span>
              </button>
            );
          })}
        </div>
        <p className="mb-3 text-[11px] text-muted-foreground">{t("sheet.noColumnsSelected")}</p>

        <p className="mb-2 text-xs font-medium">{t("sheet.quick")}</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {QUICK.map((q) => (
            <button
              key={q.fn}
              type="button"
              disabled={!selected.length}
              onClick={() => quick(q.fn)}
              className="rounded-md border px-2 py-1 font-mono text-[11px] font-medium transition-colors hover:border-primary/50 hover:bg-muted disabled:opacity-40"
            >
              {q.label}
            </button>
          ))}
        </div>

        <PromptForm variant="compact" showExamples={false} defaultWithSheet selectedColumns={selected} />
      </Card>

      {status === "loading" && <ResultSkeleton />}
      {status !== "loading" && response && <ResultView response={response} navigateOnInsert={false} />}
    </div>
  );
}
