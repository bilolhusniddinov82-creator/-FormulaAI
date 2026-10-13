import type { FormulaResult } from "./ai/schema";

export type Language = "en" | "ru" | "uz";

export const LANGUAGES: { value: Language; label: string; short: string }[] = [
  { value: "uz", label: "O‘zbekcha", short: "UZ" },
  { value: "ru", label: "Русский", short: "RU" },
  { value: "en", label: "English", short: "EN" },
];

export type ColumnFormat = "general" | "number" | "currency" | "percent" | "date";

export interface SheetData {
  name: string;
  /** Raw cell inputs. Row 0 is spreadsheet row 1 (headers). Formulas start with "=". */
  cells: string[][];
  /** Display format per column. */
  formats: ColumnFormat[];
}

/** Structure of the user's sheet sent to the generator so formulas use real columns. */
export interface SheetContext {
  sheetName: string;
  columns: { letter: string; header: string; sample: string[] }[];
  /** Spreadsheet row number of the first data row (usually 2). */
  firstDataRow: number;
  /** Spreadsheet row number of the last data row. */
  lastDataRow: number;
  /** Column letters the user selected for this calculation (may be empty). */
  selectedColumns: string[];
}

export type ResultSource = "ai" | "demo";

export interface GenerationResponse {
  result: FormulaResult;
  source: ResultSource;
  /** Present when AI was configured but failed and demo mode answered instead. */
  notice?: string;
}

export interface HistoryItem {
  id: string;
  prompt: string;
  language: Language;
  createdAt: number;
  source: ResultSource;
  usedSheetContext: boolean;
  result: FormulaResult;
}
