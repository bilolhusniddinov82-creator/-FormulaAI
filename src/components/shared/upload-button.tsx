"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ImportError } from "@/lib/spreadsheet-io";
import { useT } from "@/store/settings-store";
import { useSheet } from "@/store/sheet-store";

/** Opens a file picker, parses .xlsx/.xls/.csv, loads it into the editor and navigates there. */
export function UploadButton({
  label,
  navigate = true,
  ...props
}: { label?: string; navigate?: boolean } & ButtonProps) {
  const t = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const load = useSheet((s) => s.load);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const { readSpreadsheetFile } = await import("@/lib/spreadsheet-io");
      const res = await readSpreadsheetFile(file);
      load(res.sheet, res.original);
      const rows = res.sheet.cells.length - 1;
      toast.success(t("upload.success"), {
        description: `${file.name} · ${rows} ${t("upload.rows")}${res.truncated ? " (5000+)" : ""}`,
      });
      if (navigate) router.push("/spreadsheet");
    } catch (e) {
      const code = (e as Partial<ImportError>)?.code ?? "unreadable";
      toast.error(code === "too_large" ? t("upload.tooLarge") : code === "empty" ? t("upload.empty") : t("upload.error"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Button variant="outline" onClick={() => input.current?.click()} disabled={busy} {...props}>
        {busy ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
        {label ?? t("prompt.upload")}
      </Button>
    </>
  );
}
