import {
  adjustFormulaForStructure,
  canonicalizeFormula,
  compareValues,
  hasRange,
  parseAddress,
  parseDateText,
  shiftFormula,
  toAddress,
  type Scalar,
  type StructureChange,
} from "./formula";
import type { FormulaItem } from "./ai/schema";
import type { ColumnFormat, SheetData } from "./types";

/** Pure, immutable operations on SheetData. Row 0 is the header row (spreadsheet row 1). */

export const MIN_ROWS = 20;
export const MIN_COLS = 6;

export function cloneSheet(sheet: SheetData): SheetData {
  return { ...sheet, cells: sheet.cells.map((r) => [...r]), formats: [...sheet.formats] };
}

export function colCount(sheet: SheetData): number {
  return Math.max(sheet.formats.length, ...sheet.cells.map((r) => r.length), 1);
}

/** Pads the grid so every row has the same number of columns, with at least the given size. */
export function normalize(sheet: SheetData, minRows = MIN_ROWS, minCols = MIN_COLS): SheetData {
  const cols = Math.max(colCount(sheet), minCols);
  const rows = Math.max(sheet.cells.length, minRows);
  const cells: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const src = sheet.cells[r] ?? [];
    const row: string[] = [];
    for (let c = 0; c < cols; c++) row.push(src[c] ?? "");
    cells.push(row);
  }
  const formats: ColumnFormat[] = [];
  for (let c = 0; c < cols; c++) formats.push(sheet.formats[c] ?? "general");
  return { ...sheet, cells, formats };
}

function ensureSize(sheet: SheetData, rows: number, cols: number): SheetData {
  return normalize(sheet, Math.max(rows, sheet.cells.length), Math.max(cols, colCount(sheet)));
}

/** Last row index of the contiguous data block below the header (0 when there is no data). */
export function lastDataRow(cells: string[][]): number {
  let last = 0;
  for (let r = 1; r < cells.length; r++) {
    if (cells[r].every((v) => v.trim() === "")) break;
    last = r;
  }
  return last;
}

/** Normalizes user input for a cell: canonical formulas, dates in date columns. */
export function normalizeInput(value: string, format: ColumnFormat): string {
  if (value.startsWith("=")) return canonicalizeFormula(value.trim());
  if (format === "date") {
    const serial = parseDateText(value);
    if (serial !== null) return String(serial);
  }
  return value;
}

export function setCell(sheet: SheetData, row: number, col: number, value: string): SheetData {
  const next = ensureSize(cloneSheet(sheet), row + 1, col + 1);
  next.cells[row][col] = normalizeInput(value, next.formats[col]);
  return next;
}

/** Pastes a block (e.g. tab-separated text copied from Excel) starting at row/col. */
export function pasteBlock(sheet: SheetData, row: number, col: number, block: string[][]): SheetData {
  const width = Math.max(...block.map((r) => r.length));
  const next = ensureSize(cloneSheet(sheet), row + block.length + 1, col + width);
  block.forEach((r, i) =>
    r.forEach((v, j) => {
      next.cells[row + i][col + j] = normalizeInput(v, next.formats[col + j]);
    }),
  );
  return next;
}

export function parseClipboard(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  return lines.map((line) => line.split("\t").map((v) => v.replace(/^"(.*)"$/s, "$1").replace(/""/g, '"')));
}

function adjustAll(cells: string[][], change: StructureChange): string[][] {
  return cells.map((row) => row.map((v) => (v.startsWith("=") ? adjustFormulaForStructure(v, change) : v)));
}

/** Inserts an empty row at `index`; per-row formulas from the row above are copied down. */
export function insertRow(sheet: SheetData, index: number): SheetData {
  const next = cloneSheet(normalize(sheet));
  const cols = colCount(next);
  const cells = adjustAll(next.cells, { type: "insertRow", index });
  const above = index - 1 >= 1 ? cells[index - 1] : null;
  const newRow = Array.from({ length: cols }, (_, c) => {
    const v = above?.[c] ?? "";
    return v.startsWith("=") && !hasRange(v) ? shiftFormula(v, 1, 0) : "";
  });
  cells.splice(index, 0, newRow);
  return { ...next, cells };
}

export function deleteRow(sheet: SheetData, index: number): SheetData {
  if (sheet.cells.length <= 1) return sheet;
  const next = cloneSheet(sheet);
  next.cells.splice(index, 1);
  return { ...next, cells: adjustAll(next.cells, { type: "deleteRow", index }) };
}

export function insertCol(sheet: SheetData, index: number, header = ""): SheetData {
  const next = cloneSheet(normalize(sheet));
  const cells = adjustAll(next.cells, { type: "insertCol", index }).map((row, r) => {
    const copy = [...row];
    copy.splice(index, 0, r === 0 ? header : "");
    return copy;
  });
  const formats = [...next.formats];
  formats.splice(index, 0, "general");
  return { ...next, cells, formats };
}

export function deleteCol(sheet: SheetData, index: number): SheetData {
  if (colCount(sheet) <= 1) return sheet;
  const next = cloneSheet(normalize(sheet, 1, 1));
  next.cells.forEach((row) => row.splice(index, 1));
  next.formats.splice(index, 1);
  return { ...next, cells: adjustAll(next.cells, { type: "deleteCol", index }) };
}

export function setFormat(sheet: SheetData, col: number, format: ColumnFormat): SheetData {
  const next = normalize(cloneSheet(sheet), 1, col + 1);
  next.formats[col] = format;
  return next;
}

/**
 * Sorts the data block (rows 2..last contiguous row) by a column's computed values.
 * Formulas move with their row and their relative references are shifted, like Excel.
 */
export function sortRows(
  sheet: SheetData,
  col: number,
  direction: "asc" | "desc",
  values: Scalar[][],
): SheetData {
  const last = lastDataRow(sheet.cells);
  if (last < 2) return sheet;
  const next = cloneSheet(sheet);
  const indexes = Array.from({ length: last }, (_, i) => i + 1);
  indexes.sort((a, b) => {
    const va = values[a]?.[col] ?? null;
    const vb = values[b]?.[col] ?? null;
    // Blanks always last
    if (va === null || va === "") return vb === null || vb === "" ? 0 : 1;
    if (vb === null || vb === "") return -1;
    const c = compareValues(va, vb);
    return direction === "asc" ? c : -c;
  });
  indexes.forEach((from, i) => {
    const to = i + 1;
    next.cells[to] = sheet.cells[from].map((v) => (v.startsWith("=") ? shiftFormula(v, to - from, 0) : v));
  });
  return next;
}

/** Copies the formula at (row, col) down to the last data row. */
export function fillDown(sheet: SheetData, row: number, col: number, toRow?: number): SheetData {
  const src = sheet.cells[row]?.[col] ?? "";
  if (!src.startsWith("=")) return sheet;
  const last = toRow ?? lastDataRow(sheet.cells);
  if (last <= row) return sheet;
  const next = ensureSize(cloneSheet(sheet), last + 1, col + 1);
  for (let r = row + 1; r <= last; r++) next.cells[r][col] = shiftFormula(src, r - row, 0);
  return next;
}

/** First completely empty column index (used when a formula has no target column). */
export function firstEmptyCol(cells: string[][]): number {
  const cols = Math.max(...cells.map((r) => r.length), 0);
  for (let c = 0; c < cols; c++) if (cells.every((r) => (r[c] ?? "").trim() === "")) return c;
  return cols;
}

export interface InsertResult {
  sheet: SheetData;
  row: number;
  col: number;
  address: string;
}

/** Inserts a generated formula into the sheet, filling down for per-row formulas. */
export function insertFormula(sheet: SheetData, item: Pick<FormulaItem, "formula" | "targetCell" | "fillDown" | "label">): InsertResult {
  const formula = canonicalizeFormula(item.formula.startsWith("=") ? item.formula : `=${item.formula}`);
  let target = item.targetCell ? parseAddress(item.targetCell) : null;
  if (!target) {
    const col = firstEmptyCol(sheet.cells);
    target = { row: item.fillDown ? 1 : Math.max(1, lastDataRow(sheet.cells) + 2), col };
  }
  let next = ensureSize(cloneSheet(sheet), target.row + 1, target.col + 1);
  next = normalize(next, next.cells.length, next.formats.length);
  // Name an empty result column after the formula
  if (target.row >= 1 && item.fillDown && next.cells[0][target.col].trim() === "") {
    next.cells[0][target.col] = item.label.slice(0, 40);
  }
  next.cells[target.row][target.col] = formula;
  if (item.fillDown) next = fillDown(next, target.row, target.col);
  return { sheet: next, row: target.row, col: target.col, address: toAddress(target.row, target.col) };
}

/** Builds a SheetContext-like description of the sheet for the formula generator. */
export function describeSheet(sheet: SheetData, selected: string[]) {
  const last = lastDataRow(sheet.cells);
  const header = sheet.cells[0] ?? [];
  const columns = header
    .map((h, c) => ({ c, h }))
    .filter(({ c, h }) => h.trim() !== "" || sheet.cells.slice(1, last + 1).some((r) => (r[c] ?? "").trim() !== ""))
    .slice(0, 60)
    .map(({ c, h }) => ({
      letter: toAddress(0, c).replace(/\d+$/, ""),
      header: h.slice(0, 200),
      sample: sheet.cells
        .slice(1, Math.min(last, 3) + 1)
        .map((r) => (r[c] ?? "").slice(0, 200)),
    }));
  return {
    sheetName: sheet.name.slice(0, 200),
    columns,
    firstDataRow: 2,
    lastDataRow: Math.max(2, last + 1),
    selectedColumns: selected,
  };
}
