"use client";

import { Bot, Database, FlaskConical, Monitor, Moon, Settings, Sun, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { useAiStatus } from "@/components/shared/ai-status";
import { ConfirmButton } from "@/components/shared/confirm-dialog";
import { LanguageSegmented } from "@/components/shared/language-select";
import { PageHeader } from "@/components/shared/page-header";
import { FormulaCode } from "@/components/generator/formula-code";
import { CURRENCIES, formatValue, type Currency } from "@/lib/format";
import { sampleSheet } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { useHistory } from "@/store/history-store";
import { useSettings, useT } from "@/store/settings-store";
import { useSheet } from "@/store/sheet-store";

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="mt-0.5 max-w-md text-xs text-muted-foreground">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; icon?: typeof Sun }[];
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap rounded-lg border bg-muted/50 p-0.5">
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
            value === v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
          {label}
        </button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const t = useT();
  const settings = useSettings();
  const { theme, setTheme } = useTheme();
  const ai = useAiStatus();
  const clearHistory = useHistory((s) => s.clear);
  const loadSheet = useSheet((s) => s.load);

  const update = (patch: Parameters<typeof settings.set>[0]) => {
    settings.set(patch);
    toast.success(t("settings.saved"), { duration: 1200 });
  };

  return (
    <div className="container max-w-3xl pb-16">
      <PageHeader icon={Settings} title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <Card className="px-5">
        <Row title={t("settings.language")} desc={t("settings.languageDesc")}>
          <LanguageSegmented value={settings.language} onChange={(language) => update({ language })} />
        </Row>
        <Row title={t("settings.theme")} desc={t("settings.themeDesc")}>
          <Segmented
            value={(theme ?? "system") as "light" | "dark" | "system"}
            onChange={(v) => setTheme(v)}
            options={[
              { value: "light", label: t("settings.light"), icon: Sun },
              { value: "dark", label: t("settings.dark"), icon: Moon },
              { value: "system", label: t("settings.system"), icon: Monitor },
            ]}
          />
        </Row>
        <Row title={t("settings.formulaLocale")} desc={t("settings.formulaLocaleDesc")}>
          <Segmented
            value={settings.formulaLocale}
            onChange={(formulaLocale) => update({ formulaLocale })}
            options={[
              { value: "en", label: t("settings.english") },
              { value: "ru", label: t("settings.russian") },
            ]}
          />
        </Row>
        <Row title={t("settings.separator")} desc={t("settings.separatorDesc")}>
          <Segmented
            value={settings.separator}
            onChange={(separator) => update({ separator })}
            options={[
              { value: ",", label: t("settings.comma") },
              { value: ";", label: t("settings.semicolon") },
            ]}
          />
        </Row>
        <div className="-mt-2 mb-4 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs">
          <span className="text-muted-foreground">{t("settings.preview")}:</span>
          <FormulaCode formula='=IF(SUM(D2:D4)>100000,ROUND(SUM(D2:D4)*0.05,0),"—")' className="text-xs" />
        </div>
        <Row title={t("settings.currency")} desc={t("settings.currencyDesc")}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {formatValue(142000, "currency", { lang: settings.language, currency: settings.currency, decimals: settings.decimals })}
            </span>
            <Select value={settings.currency} onChange={(e) => update({ currency: e.target.value as Currency })}>
              {CURRENCIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
        </Row>
        <Row title={t("settings.decimals")} desc={t("settings.decimalsDesc")}>
          <Select value={settings.decimals} onChange={(e) => update({ decimals: Number(e.target.value) })}>
            {[0, 1, 2, 3, 4].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </Select>
        </Row>
      </Card>

      <Card className="mt-6 px-5">
        <Row title={t("settings.ai")} desc={ai.aiEnabled ? `${t("settings.aiOn")} · ${ai.model}` : t("settings.aiOff")}>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
              ai.aiEnabled ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            )}
          >
            {ai.aiEnabled ? <Bot className="h-3.5 w-3.5" /> : <FlaskConical className="h-3.5 w-3.5" />}
            {ai.aiEnabled ? t("mode.ai") : t("mode.demo")}
          </span>
        </Row>
        <Row title={t("settings.data")} desc={t("settings.dataDesc")}>
          <ConfirmButton
            variant="outline"
            message={t("settings.confirmReset")}
            onConfirm={() => {
              clearHistory();
              settings.reset();
              loadSheet(sampleSheet("uz"));
              setTheme("system");
              toast.success(t("settings.resetDone"));
            }}
          >
            <Database /> <Trash2 /> {t("settings.resetAll")}
          </ConfirmButton>
        </Row>
      </Card>
    </div>
  );
}
