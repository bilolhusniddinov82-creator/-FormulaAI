import { test } from "node:test";
import assert from "node:assert/strict";
import * as ops from "../src/lib/sheet-ops";
import { evaluateGrid } from "../src/lib/formula/index";
import { sampleSheet, TEMPLATES } from "../src/lib/templates";

test("sample sales calculator values", () => {
  const s = sampleSheet("en");
  const v = evaluateGrid(s.cells);
  assert.deepEqual([v[1][3], v[2][3], v[3][3]], [50000, 60000, 32000]);
  assert.equal(v[5][1], 23); // total quantity
  assert.equal(v[5][3], 142000); // total revenue
  assert.ok(Math.abs((v[6][3] as number) - 142000 / 3) < 1e-6); // average sale
});

test("every template evaluates without errors", () => {
  for (const tpl of TEMPLATES) {
    for (const lang of ["en", "ru", "uz"] as const) {
      const v = evaluateGrid(tpl.build(lang).cells);
      for (const row of v) for (const cell of row) assert.ok(!(cell instanceof Object && "code" in cell), `${tpl.id}/${lang}: ${String(cell)}`);
    }
  }
});

test("insert row copies per-row formulas and grows totals", () => {
  const s = ops.insertRow(sampleSheet("en"), 4); // new row 5 directly below Bread
  assert.equal(s.cells[4][3], "=B5*C5");
  assert.equal(s.cells[6][3], "=SUM(D2:D5)");
  s.cells[4][0] = "Milk";
  s.cells[4][1] = "2";
  s.cells[4][2] = "9000";
  const v = evaluateGrid(s.cells);
  assert.equal(v[6][3], 160000);
});

test("sort keeps per-row formulas consistent", () => {
  const s = sampleSheet("en");
  const sorted = ops.sortRows(s, 3, "desc", evaluateGrid(s.cells));
  const v = evaluateGrid(sorted.cells);
  assert.deepEqual([sorted.cells[1][0], sorted.cells[2][0], sorted.cells[3][0]], ["Juice", "Water", "Bread"]);
  assert.deepEqual([v[1][3], v[2][3], v[3][3]], [60000, 50000, 32000]);
  assert.equal(v[5][3], 142000);
});

test("insert generated formula with fill down", () => {
  const base = { name: "t", cells: [["Product", "Qty", "Price"], ["A", "2", "10"], ["B", "3", "20"], ["C", "4", "30"]], formats: [] };
  const res = ops.insertFormula(ops.normalize(base), { formula: "=B2*C2", targetCell: "D2", fillDown: true, label: "Revenue" });
  assert.equal(res.address, "D2");
  assert.equal(res.sheet.cells[0][3], "Revenue");
  assert.deepEqual([res.sheet.cells[2][3], res.sheet.cells[3][3]], ["=B3*C3", "=B4*C4"]);
  const total = ops.insertFormula(res.sheet, { formula: "=СУММ(D2:D4)", targetCell: "D6", fillDown: false, label: "Total" });
  assert.equal(total.sheet.cells[5][3], "=SUM(D2:D4)");
  assert.equal(evaluateGrid(total.sheet.cells)[5][3], 200);
});

test("paste tab-separated block from Excel", () => {
  const block = ops.parseClipboard("Name\tQty\r\nTea\t5\r\nSugar\t1 500\r\n");
  const s = ops.pasteBlock(ops.normalize({ name: "p", cells: [[""]], formats: [] }), 0, 0, block);
  assert.equal(s.cells[2][1], "1 500");
  assert.equal(evaluateGrid(s.cells)[2][1], 1500);
});

test("describe sheet for the generator", () => {
  const d = ops.describeSheet(sampleSheet("en"), ["B", "C"]);
  assert.equal(d.columns[1].header, "Quantity");
  assert.equal(d.lastDataRow, 4);
  assert.deepEqual(d.selectedColumns, ["B", "C"]);
});
