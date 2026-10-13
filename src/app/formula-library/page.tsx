"use client";

import { useMemo, useState } from "react";
import { BookOpen, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/shared/copy-button";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { FormulaCode, useLocalizedFormula } from "@/components/generator/formula-code";
import { CATEGORIES, LIBRARY, type LibraryCategory } from "@/lib/formula-library";
import { EN_TO_RU } from "@/lib/formula";
import { cn } from "@/lib/utils";
import { useSettings, useT } from "@/store/settings-store";

export default function FormulaLibraryPage() {
  const t = useT();
  const lang = useSettings((s) => s.language);
  const localize = useLocalizedFormula();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LibraryCategory | "all">("all");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LIBRARY.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (!q) return true;
      const ru = EN_TO_RU[e.name] ?? "";
      const haystack = [e.name, ru, e.syntax, e.example, ...Object.values(e.description), ...Object.values(e.useCase)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, category]);

  return (
    <div className="container pb-16">
      <PageHeader icon={BookOpen} title={t("library.title")} subtitle={t("library.subtitle")} />

      <div className="sticky top-16 z-10 -mx-4 mb-6 space-y-3 bg-background/90 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("library.search")}
            className="h-11 pl-10"
            aria-label={t("library.search")}
          />
        </div>
        <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
          {[{ id: "all" as const, label: { en: t("library.all"), ru: t("library.all"), uz: t("library.all") } }, ...CATEGORIES].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                category === c.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {c.label[lang]}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {results.length} {t("library.count")}
        </p>
      </div>

      {results.length === 0 ? (
        <EmptyState icon={Search} title={t("library.noResults")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {results.map((e) => {
            const ru = EN_TO_RU[e.name];
            const cat = CATEGORIES.find((c) => c.id === e.category)!;
            return (
              <Card key={e.name + e.category} className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-mono text-lg font-semibold text-primary">{e.name}</h2>
                    {ru && ru !== e.name && (
                      <p className="text-xs text-muted-foreground">
                        {t("library.ruName")}: <span className="font-mono">{ru}</span>
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-violet/10 px-2 py-0.5 text-[11px] font-medium text-violet">{cat.label[lang]}</span>
                </div>
                <p className="text-sm">{e.description[lang]}</p>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("library.syntax")}</p>
                  <code className="block rounded-md bg-muted/60 px-2.5 py-1.5 font-mono text-xs">{e.syntax}</code>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">{t("library.example")}</p>
                  <div className="flex items-center gap-2 rounded-md bg-muted/60 px-2.5 py-1.5">
                    <FormulaCode formula={e.example} className="flex-1 text-xs" />
                    <CopyButton text={localize(e.example)} className="h-7 w-7" />
                  </div>
                </div>
                <div className="mt-auto rounded-md border-l-2 border-primary/50 bg-primary/5 px-3 py-2 text-xs">
                  <span className="font-medium">{t("library.useCase")}: </span>
                  <span className="text-muted-foreground">{e.useCase[lang]}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
