"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowUpRight, BookOpen, Clock, LayoutTemplate, ShoppingCart, Sparkles, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PromptForm } from "@/components/generator/prompt-form";
import { RecentList } from "@/components/generator/recent-list";
import { sampleSheet } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { useSettings, useT } from "@/store/settings-store";
import { useSheet } from "@/store/sheet-store";

const SALES_ROWS = [
  ["Water", "10", "5 000", "50 000"],
  ["Juice", "5", "12 000", "60 000"],
  ["Bread", "8", "4 000", "32 000"],
];

function BentoLink({
  href,
  icon: Icon,
  title,
  desc,
  className,
  children,
}: {
  href: string;
  icon: typeof Table2;
  title: string;
  desc: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link href={href} className={cn("glass lift group relative flex flex-col overflow-hidden rounded-3xl p-6", className)}>
      <div className="flex items-start justify-between">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-violet/15 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <span className="grid h-9 w-9 place-items-center rounded-full border bg-card/60 text-muted-foreground transition-all group-hover:rotate-45 group-hover:border-transparent group-hover:bg-foreground group-hover:text-background">
          <ArrowUpRight className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-auto pt-8">
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </Link>
  );
}

export default function DashboardPage() {
  const t = useT();
  const router = useRouter();
  const lang = useSettings((s) => s.language);
  const load = useSheet((s) => s.load);

  const openSales = () => {
    load(sampleSheet(lang));
    router.push("/spreadsheet");
  };

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="container max-w-4xl pb-16 pt-16 sm:pt-24">
        <div className="mb-10 text-center">
          <div className="glass mx-auto mb-7 inline-flex animate-fade-up items-center gap-2 rounded-full py-1 pl-1 pr-4 text-xs font-medium">
            <span className="rounded-full bg-gradient-to-r from-primary to-violet px-2.5 py-1 text-[11px] font-semibold text-white">
              2026
            </span>
            <span className="text-muted-foreground">{t("hero.badge")}</span>
          </div>
          <h1
            className="animate-fade-up text-balance font-display text-[2.4rem] font-semibold leading-[1.08] sm:text-[3.4rem] lg:text-[4.1rem]"
            style={{ animationDelay: "60ms" }}
          >
            <span className="text-gradient">{t("hero.title")}</span>
          </h1>
          <p
            className="mx-auto mt-6 max-w-xl animate-fade-up text-lg text-muted-foreground sm:text-xl"
            style={{ animationDelay: "120ms" }}
          >
            {t("hero.subtitle")}
          </p>
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "180ms" }}>
          <PromptForm onSuccess={() => router.push("/formula-generator")} />
        </div>
      </section>

      {/* Bento */}
      <section className="container">
        <div className="grid auto-rows-[minmax(190px,auto)] gap-4 md:grid-cols-3">
          {/* Sales calculator — large tile */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-violet to-pink p-[1px] md:col-span-2 md:row-span-2">
            <div className="relative flex h-full flex-col overflow-hidden rounded-[calc(1.5rem-1px)] bg-[hsl(232_45%_10%)] p-6 text-white sm:p-8">
              <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet/40 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-primary/40 blur-3xl" />
              <div className="relative flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 backdrop-blur">
                  <ShoppingCart className="h-5 w-5" />
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs">=B2*C2</span>
              </div>
              <h2 className="relative mt-6 font-display text-2xl font-semibold sm:text-3xl">{t("dash.salesTitle")}</h2>
              <p className="relative mt-2 max-w-md text-sm text-white/70">{t("dash.salesDesc")}</p>

              <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5 font-mono text-xs backdrop-blur sm:text-[13px]">
                <div className="grid grid-cols-4 border-b border-white/10 px-4 py-2.5 text-white/50">
                  <span>Product</span>
                  <span className="text-right">Qty</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Revenue</span>
                </div>
                {SALES_ROWS.map((r) => (
                  <div key={r[0]} className="grid grid-cols-4 border-b border-white/5 px-4 py-2.5">
                    <span>{r[0]}</span>
                    <span className="text-right">{r[1]}</span>
                    <span className="text-right">{r[2]}</span>
                    <span className="text-right text-cyan">{r[3]}</span>
                  </div>
                ))}
                <div className="grid grid-cols-4 px-4 py-2.5 font-semibold">
                  <span>Σ</span>
                  <span className="text-right">23</span>
                  <span />
                  <span className="text-right text-white">142 000</span>
                </div>
              </div>

              <div className="relative mt-auto pt-6">
                <Button onClick={openSales} className="bg-white text-[hsl(232_45%_10%)] hover:bg-white/90">
                  {t("dash.open")} <ArrowRight />
                </Button>
              </div>
            </div>
          </div>

          <BentoLink href="/spreadsheet" icon={Table2} title={t("nav.spreadsheet")} desc={t("dash.editorDesc")} />
          <BentoLink href="/templates" icon={LayoutTemplate} title={t("nav.templates")} desc={t("dash.templatesDesc")} />
          <BentoLink
            href="/formula-library"
            icon={BookOpen}
            title={t("nav.library")}
            desc={t("dash.libraryDesc")}
            className="md:col-span-1"
          >
            <div className="pointer-events-none absolute -right-6 top-16 flex rotate-[-8deg] flex-col gap-1.5 font-mono text-[11px] opacity-60">
              {["XLOOKUP", "SUMIFS", "IFERROR"].map((f) => (
                <span key={f} className="rounded-full border bg-card/70 px-2.5 py-0.5">{f}</span>
              ))}
            </div>
          </BentoLink>
          <BentoLink
            href="/formula-generator"
            icon={Sparkles}
            title={t("nav.generator")}
            desc={t("hero.subtitle")}
            className="md:col-span-2"
          />
        </div>
      </section>

      {/* Recent */}
      <section className="container mt-16">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="flex items-center gap-2.5 font-display text-xl font-semibold">
            <Clock className="h-5 w-5 text-primary" />
            {t("recent.title")}
          </h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/history">
              {t("recent.viewAll")} <ArrowRight />
            </Link>
          </Button>
        </div>
        <RecentList />
      </section>
    </div>
  );
}
