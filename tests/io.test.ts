import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import { readSpreadsheetFile } from "../src/lib/spreadsheet-io";
import { evaluateGrid } from "../src/lib/formula/index";

function xlsxFile(aoa: unknown[][], formulas: Record<string, string> = {}) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  for (const [addr, f] of Object.entries(formulas)) ws[addr] = { t: "n", v: 0, f };
  const range = XLSX.utils.decode_range(ws["!ref"]!);
  range.e.c = Math.max(range.e.c, 3);
  ws["!ref"] = XLSX.utils.encode_range(range);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new File([buf], "sales.xlsx");
}

test("xlsx with headers and formulas", async () => {
  const file = xlsxFile([["Product", "Qty", "Price", "Total"], ["Water", 10, 5000], ["Juice", 5, 12000]], { D2: "B2*C2", D3: "B3*C3" });
  const r = await readSpreadsheetFile(file);
  assert.equal(r.headerDetected, true);
  assert.equal(r.sheet.cells[1][3], "=B2*C2");
  assert.deepEqual(evaluateGrid(r.sheet.cells).map((row) => row[3]), ["Total", 50000, 60000]);
  assert.equal(r.original.name, "sales.xlsx");
});

test("data without headers gets a generated header row", async () => {
  const file = xlsxFile([["Water", 10, 5000], ["Juice", 5, 12000]], { D1: "B1*C1" });
  const r = await readSpreadsheetFile(file);
  assert.equal(r.headerDetected, false);
  assert.equal(r.sheet.cells[0][0], "Column A");
  assert.equal(r.sheet.cells[1][3], "=B2*C2");
});

test("utf-8 csv with cyrillic", async () => {
  const file = new File(["﻿Товар,Количество\nХлеб,8\nСок,5\n"], "data.csv", { type: "text/csv" });
  const r = await readSpreadsheetFile(file);
  assert.equal(r.sheet.cells[0][0], "Товар");
  assert.equal(r.sheet.cells[1][0], "Хлеб");
  assert.equal(r.sheet.cells[2][1], "5");
});
