"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Boxes,
  Calculator,
  Loader2,
  Package,
  Percent,
  Receipt,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Tip } from "@/components/ui/tooltip";
import { LanguageSegmented } from "@/components/shared/language-select";
import { UploadButton } from "@/components/shared/upload-button";
import type { TranslationKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useGenerator } from "@/store/generator-store";
import { useSettings, useT } from "@/store/settings-store";

const formSchema = z.object({
  prompt: z.string().trim().min(3, "prompt.tooShort").max(2000, "prompt.tooLong"),
  language: z.enum(["en", "ru", "uz"]),
  withSheet: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

export const EXAMPLES: { key: TranslationKey; icon: typeof Calculator }[] = [
  { key: "examples.revenue", icon: ShoppingCart },
  { key: "examples.salary", icon: Users },
  { key: "examples.inventory", icon: Package },
  { key: "examples.expenses", icon: Receipt },
  { key: "examples.profit", icon: TrendingUp },
  { key: "examples.count", icon: Boxes },
  { key: "examples.discount", icon: Percent },
];

export function PromptForm({
  variant = "hero",
  showExamples = true,
  defaultWithSheet = false,
  selectedColumns,
  onSuccess,
}: {
  variant?: "hero" | "compact";
  showExamples?: boolean;
  defaultWithSheet?: boolean;
  selectedColumns?: string[];
  onSuccess?: () => void;
}) {
  const t = useT();
  const uiLanguage = useSettings((s) => s.language);
  const { prompt: storePrompt, status, generate } = useGenerator();
  const loading = status === "loading";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { prompt: storePrompt, language: uiLanguage, withSheet: defaultWithSheet },
  });
  const { register, handleSubmit, control, setValue, formState } = form;

  // Follow the interface language until the user picks another one here
  useEffect(() => {
    if (!formState.dirtyFields.language) setValue("language", uiLanguage);
  }, [uiLanguage, formState.dirtyFields.language, setValue]);

  // Keep in sync when a prompt is loaded from history
  useEffect(() => {
    setValue("prompt", storePrompt);
  }, [storePrompt, setValue]);

  const submit = handleSubmit(async (values) => {
    const res = await generate({
      prompt: values.prompt,
      language: values.language,
      withSheet: values.withSheet,
      selectedColumns,
    });
    if (!res) {
      const err = useGenerator.getState().error;
      toast.error(err === "network" ? t("error.network") : t("error.generic"));
      return;
    }
    if (res.notice) toast.warning(t(`notice.${res.notice}` as TranslationKey));
    else toast.success(t("toast.generated"));
    onSuccess?.();
  });

  const runExample = (key: TranslationKey) => {
    setValue("prompt", t(key), { shouldValidate: true });
    void submit();
  };

  const error = formState.errors.prompt?.message;
  const hero = variant === "hero";

  return (
    <div className="space-y-8">
      <div className={cn(hero ? "glow-border" : "rounded-2xl border bg-card/80 backdrop-blur-xl")}>
      <form
        onSubmit={submit}
        className={cn("group", hero ? "glow-inner p-3 sm:p-5" : "p-3")}
      >
        <label htmlFor="prompt" className="sr-only">
          {t("prompt.label")}
        </label>
        <Textarea
          id="prompt"
          {...register("prompt")}
          placeholder={t("prompt.placeholder")}
          rows={hero ? 4 : 3}
          className={cn("resize-none border-0 bg-transparent px-2 shadow-none focus-visible:ring-0", hero && "text-base")}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          aria-invalid={!!error}
        />
        {error && <p className="px-2 pb-2 text-sm text-destructive">{t(error as TranslationKey)}</p>}

        <div className={cn("flex flex-col gap-3 border-t pt-3", hero && "sm:flex-row sm:items-center sm:justify-between")}>
          <div className="flex flex-wrap items-center gap-2">
            <Controller
              control={control}
              name="language"
              render={({ field }) => (
                <Tip label={t("prompt.language")}>
                  <div>
                    <LanguageSegmented value={field.value} onChange={(l) => field.onChange(l)} />
                  </div>
                </Tip>
              )}
            />
            <Controller
              control={control}
              name="withSheet"
              render={({ field }) => (
                <Tip label={t("prompt.useSheetHint")}>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[hsl(var(--primary))]"
                    />
                    {t("prompt.useSheet")}
                  </label>
                </Tip>
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            {hero && <UploadButton className="flex-1 sm:flex-none" />}
            <Tip label={t("prompt.shortcut")}>
              <Button type="submit" variant="gradient" disabled={loading} className={hero ? "flex-1 sm:flex-none" : "w-full"}>
                {loading ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {loading ? t("prompt.generating") : t("prompt.generate")}
              </Button>
            </Tip>
          </div>
        </div>
      </form>
      </div>

      {showExamples && (
        <div>
          <p
            className={cn(
              "mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground",
              hero && "justify-center",
            )}
          >
            <Sparkles className="h-3.5 w-3.5 text-violet" />
            {t("examples.title")}
          </p>
          <div className={cn("flex flex-wrap gap-2", hero && "justify-center")}>
            {EXAMPLES.map(({ key, icon: Icon }, i) => (
              <button
                key={key}
                type="button"
                disabled={loading}
                onClick={() => runExample(key)}
                style={{ animationDelay: `${i * 50}ms` }}
                className="group/card glass flex animate-fade-up items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-left text-[13px] font-medium transition-all hover:-translate-y-0.5 hover:border-primary/40 disabled:opacity-60"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/15 to-violet/15 text-primary transition-all group-hover/card:from-primary group-hover/card:to-violet group-hover/card:text-white">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                {t(key)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
