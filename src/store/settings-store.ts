"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArgSeparator, FunctionLocale } from "@/lib/formula";
import type { Currency } from "@/lib/format";
import { translate, type TranslationKey } from "@/lib/i18n";
import type { Language } from "@/lib/types";

interface SettingsState {
  language: Language;
  formulaLocale: FunctionLocale;
  separator: ArgSeparator;
  currency: Currency;
  decimals: number;
  set: (patch: Partial<Omit<SettingsState, "set" | "reset">>) => void;
  reset: () => void;
}

const DEFAULTS = {
  language: "uz" as Language,
  formulaLocale: "en" as FunctionLocale,
  separator: "," as ArgSeparator,
  currency: "UZS" as Currency,
  decimals: 2,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set(patch),
      reset: () => set(DEFAULTS),
    }),
    { name: "formulaai-settings", skipHydration: true },
  ),
);

/** Translation hook bound to the current interface language. */
export function useT() {
  const language = useSettings((s) => s.language);
  return (key: TranslationKey) => translate(language, key);
}

export function useFormulaStyle() {
  const locale = useSettings((s) => s.formulaLocale);
  const separator = useSettings((s) => s.separator);
  return { locale, separator };
}
