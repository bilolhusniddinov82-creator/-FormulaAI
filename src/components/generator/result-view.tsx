"use client";

import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownToLine,
  Bot,
  Calculator,
  FlaskConical,
  HelpCircle,
  Lightbulb,
  ListOrdered,
  MapPin,
  Shuffle,
  TableProperties,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import { CopyButton } from "@/components/shared/copy-button";
import type { FormulaItem } from "@/lib/ai/schema";
import { validateFormula } from "@/lib/formula";
import type { GenerationResponse } from "@/lib/types";
import { useT } from "@/store/settings-store";
import { useSheet } from "@/store/sheet-store";
import { FormulaCode, useLocalizedFormula } from "./formula-code";

function Section({ icon: Icon, title, children }: { icon: typeof Bot; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" />
        {title}
      </h3>
      {children}
    </section>
  );
}

export function ResultView({
  response,
  onInserted,
  navigateOnInsert = true,
}: {
  response: GenerationResponse;
  onInserted?: (address: string) => void;
  navigateOnInsert?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const localize = useLocalizedFormula();
  const insertFormula = useSheet((s) => s.insertFormula);
  const { result, source } = response;

  const insert = (item: Pick<FormulaItem, "formula" | "targetCell" | "fillDown" | "label">) => {
    const { address } = insertFormula(item);
    toast.success(t("result.inserted"), { description: `${address}: ${localize(item.formula)}` });
    onInserted?.(address);
    if (navigateOnInsert) router.push("/spreadsheet");
  };

  return (
    <Card className="animate-fade-up overflow-hidden">
      <div className="border-b bg-gradient-to-r from-primary/5 to-violet/5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{result.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{result.summary}</p>
          </div>
          <Badge variant={source === "ai" ? "violet" : "warning"}>
            {source === "ai" ? <Bot /> : <FlaskConical />}
            {source === "ai" ? t("result.sourceAi") : t("result.sourceDemo")}
          </Badge>
        </div>
      </div>

      <div className="space-y-6 p-5">
        {(result.needsClarification || result.isExample) && (
          <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              {result.isExample && <p>{t("result.exampleNotice")}</p>}
              {result.clarifyingQuestion && (
                <p className="font-medium">
                  <HelpCircle className="mr-1 inline h-3.5 w-3.5" />
                  {result.clarifyingQuestion}
                </p>
              )}
            </div>
          </div>
        )}

        {result.formulas.length > 0 && (
          <Section icon={Calculator} title={t("result.formulas")}>
            <div className="space-y-3">
              {result.formulas.map((f, i) => {
                const valid = validateFormula(f.formula) === null;
                return (
                  <div key={i} className="rounded-xl border bg-background/60 p-4">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium">{f.label}</p>
                      {f.targetCell && (
                        <Badge variant="outline">
                          <MapPin />
                          {t("result.pasteInto")} {f.targetCell}
                          {f.fillDown && ` · ${t("result.fillDown")}`}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 rounded-lg bg-muted/70 px-3 py-2.5">
                      <FormulaCode formula={f.formula} className="flex-1 text-[0.95rem]" />
                      <CopyButton text={localize(f.formula)} />
                      <Tip label={t("result.insert")}>
                        <Button
                          size="icon-sm"
                          variant="gradient"
                          disabled={!valid}
                          onClick={() => insert(f)}
                          aria-label={t("result.insert")}
                        >
                          <ArrowDownToLine />
                        </Button>
                      </Tip>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{f.explanation}</p>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {result.cellReferences.length > 0 && (
            <Section icon={TableProperties} title={t("result.cellRefs")}>
              <ul className="space-y-1.5 text-sm">
                {result.cellReferences.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <code className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-primary">
                      {r.ref}
                    </code>
                    <span className="text-muted-foreground">{r.meaning}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {result.exampleCalculation && (
            <Section icon={Lightbulb} title={t("result.example")}>
              <p className="rounded-lg bg-muted/60 p-3 text-sm">{result.exampleCalculation}</p>
            </Section>
          )}
        </div>

        {result.pasteInstructions.length > 0 && (
          <Section icon={ListOrdered} title={t("result.paste")}>
            <ol className="space-y-2 text-sm">
              {result.pasteInstructions.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[0.7rem] font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {result.assumptions.length > 0 && (
          <Section icon={AlertTriangle} title={t("result.assumptions")}>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {result.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </Section>
        )}

        {result.alternatives.length > 0 && (
          <Section icon={Shuffle} title={t("result.alternatives")}>
            <div className="space-y-2">
              {result.alternatives.map((a, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <FormulaCode formula={a.formula} />
                    <p className="mt-1 text-xs text-muted-foreground">{a.note}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <CopyButton text={localize(a.formula)} />
                    <Tip label={t("result.insert")}>
                      <Button
                        size="icon-sm"
                        variant="outline"
                        disabled={validateFormula(a.formula) !== null}
                        onClick={() => insert({ formula: a.formula, targetCell: null, fillDown: false, label: a.note })}
                        aria-label={t("result.insert")}
                      >
                        <ArrowDownToLine />
                      </Button>
                    </Tip>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </Card>
  );
}

export function ResultSkeleton() {
  return (
    <Card className="overflow-hidden p-5">
      <div className="space-y-4">
        {[60, 90, 40, 75].map((w, i) => (
          <div key={i} className="relative h-4 overflow-hidden rounded bg-muted" style={{ width: `${w}%` }}>
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-background/60 to-transparent" />
          </div>
        ))}
        <div className="relative h-16 overflow-hidden rounded-xl bg-muted">
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-background/60 to-transparent" />
        </div>
      </div>
    </Card>
  );
}
