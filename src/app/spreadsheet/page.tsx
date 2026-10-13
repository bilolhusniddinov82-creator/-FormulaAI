"use client";

import { Table2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SheetNameInput, SpreadsheetEditor } from "@/components/spreadsheet/spreadsheet-editor";
import { useT } from "@/store/settings-store";

export default function SpreadsheetPage() {
  const t = useT();
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pb-12">
      <PageHeader icon={Table2} title={t("sheet.title")} subtitle={t("sheet.subtitle")} actions={<SheetNameInput />} />
      <SpreadsheetEditor />
    </div>
  );
}
