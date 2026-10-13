"use client";

import { useRouter } from "next/navigation";
import { ArrowRight, LayoutTemplate, Package, ShoppingCart, Tag, TrendingUp, Users, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormulaCode } from "@/components/generator/formula-code";
import { PageHeader } from "@/components/shared/page-header";
import { TEMPLATES, type Template } from "@/lib/templates";
import { useSettings, useT } from "@/store/settings-store";
import { useSheet } from "@/store/sheet-store";

const ICONS: Record<Template["icon"], typeof ShoppingCart> = {
  shopping: ShoppingCart,
  users: Users,
  package: Package,
  wallet: Wallet,
  trending: TrendingUp,
  tag: Tag,
};

export default function TemplatesPage() {
  const t = useT();
  const router = useRouter();
  const lang = useSettings((s) => s.language);
  const load = useSheet((s) => s.load);

  const open = (tpl: Template) => {
    load(tpl.build(lang));
    toast.success(t("templates.loaded"), { description: tpl.title[lang] });
    router.push("/spreadsheet");
  };

  return (
    <div className="container pb-16">
      <PageHeader icon={LayoutTemplate} title={t("templates.title")} subtitle={t("templates.subtitle")} />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {TEMPLATES.map((tpl, i) => {
          const Icon = ICONS[tpl.icon];
          const headers = tpl.build(lang).cells[0];
          return (
            <Card key={tpl.id} className="lift flex animate-fade-up flex-col rounded-3xl p-6" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="mb-4 flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-violet text-white shadow-glow">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-semibold">{tpl.title[lang]}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{tpl.description[lang]}</p>
                </div>
              </div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("templates.columns")}</p>
              <div className="mb-4 flex flex-wrap gap-1">
                {headers.map((h) => (
                  <span key={h} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                    {h}
                  </span>
                ))}
              </div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">{t("templates.formulas")}</p>
              <div className="mb-5 space-y-1">
                {tpl.formulas.slice(0, 3).map((f) => (
                  <div key={f} className="truncate rounded-md bg-muted/60 px-2 py-1">
                    <FormulaCode formula={f} className="text-xs" />
                  </div>
                ))}
              </div>
              <Button className="mt-auto" variant="outline" onClick={() => open(tpl)}>
                {t("templates.use")} <ArrowRight />
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
