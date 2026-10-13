import { formatGeneral, formatSerialDate, isError, type Scalar } from "./formula";
import type { ColumnFormat, Language } from "./types";

export type Currency = "UZS" | "USD" | "RUB" | "EUR";

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "UZS", label: "UZS — so‘m" },
  { value: "USD", label: "USD — $" },
  { value: "RUB", label: "RUB — ₽" },
  { value: "EUR", label: "EUR — €" },
];

export interface DisplayOptions {
  lang: Language;
  currency: Currency;
  decimals: number;
}

const locale = (lang: Language) => (lang === "en" ? "en-US" : "ru-RU");

function num(n: number, lang: Language, decimals: number) {
  return n.toLocaleString(locale(lang), { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Formats a computed cell value for display. */
export function formatValue(v: Scalar, format: ColumnFormat, o: DisplayOptions): string {
  if (v === null) return "";
  if (isError(v)) return v.code;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "string") return v;
  switch (format) {
    case "number":
      return num(v, o.lang, o.decimals);
    case "percent":
      return `${num(v * 100, o.lang, Math.min(o.decimals, 2))}%`;
    case "date":
      return v > 0 && v < 2958466 ? formatSerialDate(v) : formatGeneral(v);
    case "currency": {
      const d = o.currency === "UZS" ? 0 : o.decimals;
      const s = num(Math.abs(v), o.lang, d);
      const sign = v < 0 ? "-" : "";
      if (o.currency === "USD") return `${sign}$${s}`;
      if (o.currency === "EUR") return `${sign}${s} €`;
      if (o.currency === "RUB") return `${sign}${s} ₽`;
      return `${sign}${s} ${o.lang === "ru" ? "сум" : o.lang === "uz" ? "so‘m" : "UZS"}`;
    }
    default:
      return formatGeneral(v);
  }
}

/** Excel number format codes used when exporting. */
export function excelNumberFormat(format: ColumnFormat, currency: Currency, decimals: number): string | undefined {
  const dec = decimals > 0 ? "." + "0".repeat(decimals) : "";
  switch (format) {
    case "number":
      return `#,##0${dec}`;
    case "percent":
      return `0${dec}%`;
    case "date":
      return "dd.mm.yyyy";
    case "currency":
      if (currency === "USD") return `"$"#,##0${dec}`;
      if (currency === "EUR") return `#,##0${dec} "€"`;
      if (currency === "RUB") return `#,##0${dec} "₽"`;
      return `#,##0 "so'm"`;
    default:
      return undefined;
  }
}
