"use client";

import { useT } from "@/store/settings-store";

export function Footer() {
  const t = useT();
  return (
    <footer className="border-t py-6">
      <div className="container flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} FormulaAI</span>
        <span className="max-w-xl sm:text-right">{t("common.footer")}</span>
      </div>
    </footer>
  );
}
