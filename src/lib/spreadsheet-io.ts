import * as XLSX from "xlsx";
import { excelNumberFormat, type Currency } from "./format";
import { colToLetters, evaluateGrid, isError } from "./formula";
import { insertRow } from "./sheet-ops";
import type { ColumnFormat, SheetData } from "./types";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_ROWS = 5000;
export const MAX_COLS = 100;

export interface OriginalFile {
  name: string;
  type: string;
  buffer: ArrayBuffer;
}

export interface ImportResult {
  sheet: SheetData;
  original: OriginalFile;
  truncated: boolean;
  headerDetected: boolean;
}

export class ImportError extends Error {
  constructor(public code: "too_large" | "unreadable" | "empty") {
    super(code);
  }
}

function looksLikeHeader(row: string[]): boolean {
  const filled = row.filter((v) => v.trim() !== "");
  if (filled.length === 0) return false;
  return filled.every((v) => !v.startsWith("=") && isNaN(Number(v.replace(/\s/g, "").replace(",", "."))));
}

/** Reads .xlsx/.xls/.csv into SheetData (first non-empty worksheet). Formulas are preserved. */
export async function readSpreadsheetFile(file: File): Promise<ImportResult> {
  if (file.size > MAX_FILE_BYTES) throw new ImportError("too_large");
  const buffer = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
      const text = new TextDecoder("utf-8").decode(buffer).replace(/^﻿/, "");
      wb = XLSX.read(text, { type: "string", raw: true });
    } else {
      wb = XLSX.read(buffer, { type: "array", cellFormula: true, cellNF: true });
    }
  } catch {
    throw new ImportError("unreadable");
  }
  const name = wb.SheetNames.find((n) => wb.Sheets[n]["!ref"]) ?? wb.SheetNames[0];
  const ws = name ? wb.Sheets[name] : undefined;
  if (!ws || !ws["!ref"]) throw new ImportError("empty");

  const range = XLSX.utils.decode_range(ws["!ref"]);
  const totalRows = range.e.r - range.s.r + 1;
  const totalCols = range.e.c - range.s.c + 1;
  const rows = Math.min(totalRows, MAX_ROWS);
  const cols = Math.min(totalCols, MAX_COLS);
  const formats: ColumnFormat[] = Array.from({ length: cols }, () => "general");
  const cells: string[][] = [];

  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: r + range.s.r, c: c + range.s.c })] as XLSX.CellObject | undefined;
      if (!cell) {
        row.push("");
      } else if (cell.f) {
        row.push("=" + cell.f.replace(/_xlfn\./gi, ""));
      } else if (cell.t === "n" && typeof cell.v === "number") {
        const fmt = String(cell.z ?? "");
        if (r > 0 && /[dmy]/i.test(fmt) && !/[0#]/.test(fmt)) formats[c] = "date";
        else if (r > 0 && fmt.includes("%")) formats[c] = "percent";
        row.push(String(cell.v));
      } else if (cell.t === "b") {
        row.push(cell.v ? "TRUE" : "FALSE");
      } else if (cell.t === "d" && cell.v instanceof Date) {
        row.push(cell.v.toISOString().slice(0, 10));
      } else {
        row.push(cell.v == null ? "" : String(cell.v));
      }
    }
    cells.push(row);
  }
  if (cells.every((r) => r.every((v) => v.trim() === ""))) throw new ImportError("empty");

  const headerDetected = looksLikeHeader(cells[0]);
  let sheet: SheetData = { name: (name ?? file.name).slice(0, 100), cells, formats };
  if (!headerDetected) {
    // Add a generated header row; existing formula references are shifted down by one row
    sheet = insertRow(sheet, 0);
    sheet.cells[0] = sheet.cells[0].map((_, c) => `Column ${colToLetters(c)}`);
  }

  return {
    sheet,
    original: { name: file.name, type: file.type || "application/octet-stream", buffer },
    truncated: totalRows > MAX_ROWS || totalCols > MAX_COLS,
    headerDetected,
  };
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Cells trimmed to the used area. */
function usedCells(sheet: SheetData): string[][] {
  let lastRow = 0;
  let lastCol = 0;
  sheet.cells.forEach((row, r) =>
    row.forEach((v, c) => {
      if (v.trim() !== "") {
        lastRow = Math.max(lastRow, r);
        lastCol = Math.max(lastCol, c);
      }
    }),
  );
  return sheet.cells.slice(0, lastRow + 1).map((row) => {
    const out = row.slice(0, lastCol + 1);
    while (out.length < lastCol + 1) out.push("");
    return out;
  });
}

const safeName = (s: string) =>
  s.replace(/\.(xlsx|xls|csv)$/i, "").replace(/[\\/:*?"<>|]+/g, "_").trim() || "sheet";

/** Exports the sheet as .xlsx with live formulas, cached values and number formats. */
export function exportXlsx(sheet: SheetData, opts: { currency: Currency; decimals: number; fileName?: string }) {
  const cells = usedCells(sheet);
  const values = evaluateGrid(cells);
  const ws: XLSX.WorkSheet = {};
  cells.forEach((row, r) =>
    row.forEach((raw, c) => {
      if (raw.trim() === "") return;
      const v = values[r][c];
      let cell: XLSX.CellObject;
      if (isError(v)) cell = { t: "e", v: 0, w: v.code };
      else if (typeof v === "number") cell = { t: "n", v };
      else if (typeof v === "boolean") cell = { t: "b", v };
      else cell = { t: "s", v: v ?? "" };
      if (raw.startsWith("=")) cell.f = raw.slice(1);
      const z = r > 0 ? excelNumberFormat(sheet.formats[c] ?? "general", opts.currency, opts.decimals) : undefined;
      if (z && cell.t === "n") cell.z = z;
      ws[XLSX.utils.encode_cell({ r, c })] = cell;
    }),
  );
  const cols = Math.max(cells[0]?.length ?? 1, 1);
  ws["!ref"] = `A1:${colToLetters(cols - 1)}${Math.max(cells.length, 1)}`;
  ws["!cols"] = Array.from({ length: cols }, (_, c) => ({
    wch: Math.min(40, Math.max(10, ...cells.map((r) => (r[c] ?? "").length + 2))),
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31).replace(/[\\/?*[\]:]/g, "_") || "Sheet1");
  XLSX.writeFile(wb, `${safeName(opts.fileName ?? sheet.name)}.xlsx`, { compression: true });
}

/** Exports computed values as UTF-8 CSV (with BOM so Excel shows Cyrillic correctly). */
export function exportCsv(sheet: SheetData) {
  const values = evaluateGrid(usedCells(sheet));
  const csv = values
    .map((row) =>
      row
        .map((v) => {
          const s = v === null ? "" : isError(v) ? v.code : String(v);
          return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
  download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${safeName(sheet.name)}.csv`);
}

export function downloadOriginal(file: OriginalFile) {
  download(new Blob([file.buffer], { type: file.type }), file.name);
}
