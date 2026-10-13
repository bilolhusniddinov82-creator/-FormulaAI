import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateGrid,
  shiftFormula,
  adjustFormulaForStructure,
  localizeFormula,
  canonicalizeFormula,
  isError,
} from "../src/lib/formula/index";

const sales = [
  ["Product", "Quantity", "Unit Price", "Total Revenue"],
  ["Water", "10", "5000", "=B2*C2"],
  ["Juice", "5", "12000", "=B3*C3"],
  ["Bread", "8", "4000", "=B4*C4"],
  ["", "", "", ""],
  ["Total quantity", "=SUM(B2:B4)", "Total revenue", "=SUM(D2:D4)"],
  ["Average sale", "=AVERAGE(D2:D4)", "Max", "=MAX(D2:D4)"],
];

test("sales calculator", () => {
  const v = evaluateGrid(sales);
  assert.equal(v[1][3], 50000);
  assert.equal(v[2][3], 60000);
  assert.equal(v[3][3], 32000);
  assert.equal(v[5][1], 23);
  assert.equal(v[5][3], 142000);
  assert.ok(Math.abs((v[6][1] as number) - 47333.3333333) < 0.001);
  assert.equal(v[6][3], 60000);
});

function calc(formula: string, extra: string[][] = sales): unknown {
  const grid = extra.map((r) => [...r]);
  grid.push([formula]);
  const v = evaluateGrid(grid);
  return v[v.length - 1][0];
}

test("operators and precedence", () => {
  assert.equal(calc("=1+2*3"), 7);
  assert.equal(calc("=-2^2"), 4);
  assert.equal(calc("=(1+2)*3"), 9);
  assert.equal(calc("=50%*200"), 100);
  assert.equal(calc('="a"&"b"&1'), "ab1");
  assert.equal(calc("=10/4"), 2.5);
  assert.ok(isError(calc("=1/0")));
  assert.equal(calc("=B2>B3"), true);
});

test("logical", () => {
  assert.equal(calc('=IF(B2>5,"many","few")'), "many");
  assert.equal(calc("=IFERROR(1/0,-1)"), -1);
  assert.equal(calc("=AND(B2>1,B3>1)"), true);
  assert.equal(calc("=OR(B2>100,B3>100)"), false);
  assert.equal(calc('=IFS(B2>20,"a",B2>5,"b")'), "b");
});

test("conditional aggregation", () => {
  assert.equal(calc('=SUMIF(A2:A4,"Water",D2:D4)'), 50000);
  assert.equal(calc('=COUNTIF(B2:B4,">6")'), 2);
  assert.equal(calc('=SUMIFS(D2:D4,B2:B4,">6",C2:C4,"<5000")'), 32000);
  assert.equal(calc('=COUNTIFS(A2:A4,"J*")'), 1);
  assert.equal(calc("=SUMPRODUCT(B2:B4,C2:C4)"), 142000);
  assert.equal(calc('=SUMPRODUCT((A2:A4="Bread")*D2:D4)'), 32000);
});

test("lookup", () => {
  assert.equal(calc('=VLOOKUP("Juice",A2:D4,4,FALSE)'), 60000);
  assert.equal(calc('=XLOOKUP("Bread",A2:A4,C2:C4)'), 4000);
  assert.equal(calc('=XLOOKUP("Milk",A2:A4,C2:C4,"none")'), "none");
  assert.equal(calc('=INDEX(C2:C4,MATCH("Juice",A2:A4,0))'), 12000);
  assert.ok(isError(calc('=VLOOKUP("Milk",A2:D4,2,FALSE)')));
});

test("text and math", () => {
  assert.equal(calc('=LEFT("Excel",2)'), "Ex");
  assert.equal(calc('=MID("Formula",2,3)'), "orm");
  assert.equal(calc('=UPPER(A2)'), "WATER");
  assert.equal(calc("=ROUND(2.345,2)"), 2.35);
  assert.equal(calc("=ROUND(-2.5,0)"), -3);
  assert.equal(calc("=ROUNDUP(2.341,2)"), 2.35);
  assert.equal(calc('=TEXT(1234.5,"#,##0.00")'), "1,234.50");
  assert.equal(calc('=CONCAT(A2," ",A3)'), "Water Juice");
});

test("dates", () => {
  assert.equal(calc("=DATE(2024,1,1)"), 45292);
  assert.equal(calc("=YEAR(DATE(2024,3,15))"), 2024);
  assert.equal(calc("=MONTH(DATE(2024,3,15))"), 3);
  assert.equal(calc('=DATEDIF(DATE(2020,1,1),DATE(2024,6,1),"Y")'), 4);
  assert.equal(calc("=EOMONTH(DATE(2024,2,10),0)"), 45351);
});

test("circular reference", () => {
  const v = evaluateGrid([["=B1", "=A1"]]);
  assert.ok(isError(v[0][0]));
});

test("shift formulas", () => {
  assert.equal(shiftFormula("=B2*C2", 1, 0), "=B3*C3");
  assert.equal(shiftFormula("=$B$2*C2", 2, 1), "=$B$2*D4");
  assert.equal(shiftFormula("=SUM(B:B)", 3, 0), "=SUM(B:B)");
  assert.equal(shiftFormula("=A1", -1, 0), "=#REF!");
});

test("structure adjustments", () => {
  assert.equal(adjustFormulaForStructure("=SUM(D2:D4)", { type: "insertRow", index: 2 }), "=SUM(D2:D5)");
  assert.equal(adjustFormulaForStructure("=SUM(D2:D4)", { type: "insertRow", index: 4 }), "=SUM(D2:D5)");
  assert.equal(adjustFormulaForStructure("=SUM(D2:D4)", { type: "deleteRow", index: 2 }), "=SUM(D2:D3)");
  assert.equal(adjustFormulaForStructure("=B3*C3", { type: "deleteRow", index: 1 }), "=B2*C2");
  assert.equal(adjustFormulaForStructure("=B3*C3", { type: "deleteCol", index: 1 }), "=#REF!*B3");
  assert.equal(adjustFormulaForStructure("=B3*C3", { type: "insertCol", index: 2 }), "=B3*D3");
});

test("localization", () => {
  const style = { locale: "ru", separator: ";" } as const;
  assert.equal(localizeFormula('=IF(A2>0.5,"yes, ok",SUM(B2:B4))', style), '=ЕСЛИ(A2>0,5;"yes, ok";СУММ(B2:B4))');
  assert.equal(localizeFormula("=SUM(A1,B1)", { locale: "en", separator: ";" }), "=SUM(A1;B1)");
  assert.equal(canonicalizeFormula('=ЕСЛИ(A2>0,5;"да";СУММ(B2:B4))'), '=IF(A2>0.5,"да",SUM(B2:B4))');
  assert.equal(canonicalizeFormula("=СЧЕТЕСЛИ(A1:A3;\">1\")"), '=COUNTIF(A1:A3,">1")');
  // Russian names evaluate directly too
  assert.equal(calc("=СУММ(B2:B4)"), 23);
});
