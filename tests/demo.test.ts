import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDemoFormula } from "../src/lib/ai/demo-generator";
import { formulaResultSchema } from "../src/lib/ai/schema";
import { validateFormula } from "../src/lib/formula/index";

function check(prompt: string, lang: "en" | "ru" | "uz", ctx: Parameters<typeof generateDemoFormula>[2] = null) {
  const r = generateDemoFormula(prompt, lang, ctx);
  formulaResultSchema.parse(r);
  for (const f of [...r.formulas.map((x) => x.formula), ...r.alternatives.map((x) => x.formula)]) {
    assert.equal(validateFormula(f), null, `invalid formula ${f}`);
  }
  return r;
}

test("spec example: quantity B, price C", () => {
  const r = check("Calculate total sales. Quantity is in column B and price is in column C.", "en");
  assert.equal(r.formulas[0].formula, "=B2*C2");
  assert.equal(r.formulas[0].targetCell, "D2");
  assert.equal(r.formulas[1].formula, "=SUM(D2:D100)");
  assert.equal(r.isExample, false);
});

test("russian prompt with columns", () => {
  const r = check("Посчитай выручку. Количество в столбце C, цена в столбце E", "ru");
  assert.equal(r.formulas[0].formula, "=C2*E2");
  assert.equal(r.isExample, false);
  assert.match(r.summary, /Умножьте/);
});

test("uzbek prompt with columns", () => {
  const r = check("Savdo tushumini hisobla. Miqdor D ustunda, narx F ustunda", "uz");
  assert.equal(r.isExample, false);
  assert.equal(r.formulas[0].formula, "=D2*F2");
});

test("unknown structure is labelled as example", () => {
  const r = check("Calculate employee salaries", "en");
  assert.equal(r.isExample, true);
  assert.ok(r.assumptions.length > 0);
});

test("uses sheet context headers", () => {
  const r = check("calculate profit", "en", {
    sheetName: "P&L",
    columns: [
      { letter: "A", header: "Month", sample: [] },
      { letter: "B", header: "Revenue", sample: [] },
      { letter: "C", header: "Cost", sample: [] },
    ],
    firstDataRow: 2,
    lastDataRow: 13,
    selectedColumns: [],
  });
  assert.equal(r.formulas[0].formula, "=B2-C2");
  assert.equal(r.formulas[0].targetCell, "D2");
  assert.equal(r.formulas[2].formula, "=SUM(D2:D13)");
  assert.equal(r.isExample, false);
});

test("all intents produce valid formulas", () => {
  const prompts = [
    "Find missing inventory", "Calculate monthly expenses", "Calculate profit and loss",
    "Count products sold", "Calculate percentages and discounts", "average price", "highest sales",
    "find the price with vlookup", "calculate VAT", "total of column", "склад остаток", "o‘rtacha narx",
    "hello there",
  ];
  for (const p of prompts) for (const l of ["en", "ru", "uz"] as const) check(p, l);
  assert.equal(generateDemoFormula("hello there", "en").needsClarification, true);
});
