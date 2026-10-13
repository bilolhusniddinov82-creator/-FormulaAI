import { FUNCTIONS } from "./functions";
import { RU_TO_EN } from "./localize";
import { parseFormula, ParseError, type Node } from "./parser";
import { TokenizeError } from "./tokenizer";
import {
  compareValues,
  err,
  FormulaError,
  isError,
  isMatrix,
  parseLiteral,
  toNumber,
  toScalar,
  toText,
  type EvalResult,
  type Matrix,
  type Scalar,
} from "./values";

const astCache = new Map<string, Node | FormulaError>();

function getAst(body: string): Node | FormulaError {
  const cached = astCache.get(body);
  if (cached) return cached;
  let ast: Node | FormulaError;
  try {
    ast = parseFormula(body);
  } catch (e) {
    if (e instanceof ParseError || e instanceof TokenizeError) ast = err("#ERROR!");
    else throw e;
  }
  if (astCache.size > 5000) astCache.clear();
  astCache.set(body, ast);
  return ast;
}

/** Returns a parse error message for a formula, or null when it is valid. */
export function validateFormula(formula: string): string | null {
  const body = formula.startsWith("=") ? formula.slice(1) : formula;
  try {
    parseFormula(body);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "Invalid formula";
  }
}

function binaryOp(op: string, a: Scalar, b: Scalar): Scalar {
  if (op === "&") {
    const x = toText(a);
    const y = toText(b);
    if (isError(x)) return x;
    if (isError(y)) return y;
    return x + y;
  }
  if (["=", "<>", "<", ">", "<=", ">="].includes(op)) {
    if (isError(a)) return a;
    if (isError(b)) return b;
    const c = compareValues(a, b);
    switch (op) {
      case "=": return c === 0;
      case "<>": return c !== 0;
      case "<": return c < 0;
      case ">": return c > 0;
      case "<=": return c <= 0;
      default: return c >= 0;
    }
  }
  const x = toNumber(a);
  const y = toNumber(b);
  if (isError(x)) return x;
  if (isError(y)) return y;
  switch (op) {
    case "+": return x + y;
    case "-": return x - y;
    case "*": return x * y;
    case "/": return y === 0 ? err("#DIV/0!") : x / y;
    case "^": {
      const r = Math.pow(x, y);
      return isFinite(r) ? r : err("#NUM!");
    }
  }
  return err("#VALUE!");
}

/** Element-wise operation with broadcasting of scalars / single rows / single columns. */
function liftBinary(op: string, a: EvalResult, b: EvalResult): EvalResult {
  if (!isMatrix(a) && !isMatrix(b)) return binaryOp(op, a, b);
  const A: Matrix = isMatrix(a) ? a : [[a]];
  const B: Matrix = isMatrix(b) ? b : [[b]];
  const rows = Math.max(A.length, B.length);
  const cols = Math.max(A[0]?.length ?? 0, B[0]?.length ?? 0);
  const pick = (m: Matrix, r: number, c: number): Scalar =>
    m[m.length === 1 ? 0 : r]?.[m[0].length === 1 ? 0 : c] ?? err("#N/A");
  const out: Matrix = [];
  for (let r = 0; r < rows; r++) {
    const row: Scalar[] = [];
    for (let c = 0; c < cols; c++) row.push(binaryOp(op, pick(A, r, c), pick(B, r, c)));
    out.push(row);
  }
  return out;
}

function mapMatrix(v: EvalResult, fn: (s: Scalar) => Scalar): EvalResult {
  return isMatrix(v) ? v.map((row) => row.map(fn)) : fn(v);
}

/**
 * Evaluates a grid of raw cell inputs. Row 0 is the first spreadsheet row ("1").
 * Values are memoized; circular references produce #CIRC!.
 */
export class SheetEvaluator {
  private cache = new Map<number, Scalar>();
  private visiting = new Set<number>();
  readonly rowCount: number;
  readonly colCount: number;

  constructor(private readonly cells: string[][]) {
    this.rowCount = cells.length;
    this.colCount = cells.reduce((m, r) => Math.max(m, r.length), 0);
  }

  private key(row: number, col: number) {
    return row * 100_000 + col;
  }

  getRaw(row: number, col: number): string {
    return this.cells[row]?.[col] ?? "";
  }

  getValue(row: number, col: number): Scalar {
    if (row < 0 || col < 0) return err("#REF!");
    const k = this.key(row, col);
    if (this.cache.has(k)) return this.cache.get(k)!;
    const raw = this.getRaw(row, col);
    if (!raw.startsWith("=")) {
      const lit = parseLiteral(raw);
      this.cache.set(k, lit);
      return lit;
    }
    if (this.visiting.has(k)) return err("#CIRC!");
    this.visiting.add(k);
    let result: Scalar;
    try {
      result = this.evaluateFormula(raw);
    } finally {
      this.visiting.delete(k);
    }
    this.cache.set(k, result);
    return result;
  }

  /** Evaluates a formula string ("=...") against this sheet without storing it. */
  evaluateFormula(formula: string): Scalar {
    const ast = getAst(formula.slice(1));
    if (ast instanceof FormulaError) return ast;
    const v = toScalar(this.evalNode(ast));
    // Blank references in a formula display as 0, like Excel
    return v === null ? 0 : v;
  }

  private range(r1: number, c1: number, r2: number, c2: number): Matrix {
    const lastRow = r2 === -1 ? Math.max(this.rowCount - 1, r1 === -1 ? 0 : r1) : r2;
    const firstRow = r1 === -1 ? 0 : r1;
    const out: Matrix = [];
    for (let r = firstRow; r <= lastRow; r++) {
      const row: Scalar[] = [];
      for (let c = c1; c <= c2; c++) row.push(this.getValue(r, c));
      out.push(row);
    }
    return out;
  }

  evalNode = (node: Node): EvalResult => {
    switch (node.kind) {
      case "num":
      case "str":
      case "bool":
        return node.value;
      case "error":
        return new FormulaError(node.value as FormulaError["code"]);
      case "ref":
        return this.getValue(node.row, node.col);
      case "range":
        return this.range(node.r1, node.c1, node.r2, node.c2);
      case "unary": {
        const v = this.evalNode(node.arg);
        return mapMatrix(v, (s) => {
          const n = toNumber(s);
          return isError(n) ? n : node.op === "-" ? -n : n;
        });
      }
      case "percent":
        return mapMatrix(this.evalNode(node.arg), (s) => {
          const n = toNumber(s);
          return isError(n) ? n : n / 100;
        });
      case "binary":
        return liftBinary(node.op, this.evalNode(node.left), this.evalNode(node.right));
      case "func": {
        const name = RU_TO_EN[node.name] ?? node.name.replace(/^_XLFN\./, "");
        const fn = FUNCTIONS[name];
        if (!fn) return err("#NAME?");
        const result = fn(node.args, this.evalNode);
        if (typeof result === "number" && !isFinite(result)) return err("#NUM!");
        return result;
      }
    }
  };
}

/** Convenience helper: evaluates every cell in a grid. */
export function evaluateGrid(cells: string[][]): Scalar[][] {
  const ev = new SheetEvaluator(cells);
  return cells.map((row, r) => row.map((_, c) => ev.getValue(r, c)));
}
