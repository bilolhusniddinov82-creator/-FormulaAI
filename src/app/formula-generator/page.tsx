"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptForm } from "@/components/generator/prompt-form";
import { ResultSkeleton, ResultView } from "@/components/generator/result-view";
import { useHydrated } from "@/components/layout/providers";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import type { Language } from "@/lib/types";
import { useGenerator } from "@/store/generator-store";
import { useSettings, useT } from "@/store/settings-store";

/** Runs ?q=… (optionally &lang=uz|ru|en) once, so prompts can be shared as links. */
function QueryRunner() {
  const params = useSearchParams();
  const ready = useHydrated((s) => s.ready);
  const started = useRef(false);
  useEffect(() => {
    const q = params.get("q")?.trim();
    if (!ready || started.current || !q || q.length < 3) return;
    started.current = true;
    const langParam = params.get("lang");
    const language: Language =
      langParam === "uz" || langParam === "ru" || langParam === "en" ? langParam : useSettings.getState().language;
    void useGenerator.getState().generate({ prompt: q.slice(0, 2000), language, withSheet: false });
  }, [params, ready]);
  return null;
}

export default function FormulaGeneratorPage() {
  const t = useT();
  const { status, response, answeredPrompt, reset } = useGenerator();

  return (
    <div className="container max-w-5xl pb-16">
      <Suspense>
        <QueryRunner />
      </Suspense>
      <PageHeader
        icon={Sparkles}
        title={t("nav.generator")}
        subtitle={t("hero.subtitle")}
        actions={
          response && (
            <Button variant="outline" onClick={reset}>
              <RotateCcw /> {t("result.newRequest")}
            </Button>
          )
        }
      />
      <PromptForm showExamples={!response && status !== "loading"} />

      <div className="mt-8">
        {status === "loading" && <ResultSkeleton />}
        {status !== "loading" && response && (
          <div className="space-y-3">
            {answeredPrompt && (
              <p className="rounded-lg bg-muted/60 px-4 py-2.5 text-sm text-muted-foreground">“{answeredPrompt}”</p>
            )}
            <ResultView response={response} />
          </div>
        )}
        {status !== "loading" && !response && (
          <EmptyState icon={Wand2} title={t("result.empty")} hint={t("result.emptyHint")} />
        )}
      </div>
    </div>
  );
}
