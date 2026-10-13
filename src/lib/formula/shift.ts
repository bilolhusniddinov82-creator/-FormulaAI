import { colToLetters } from "./refs";
import { tokenize, type Token } from "./tokenizer";

type RefToken = Extract<Token, { type: "ref" }>;

function refText(t: RefToken, row: number, col: number): string {
  const c = `${t.colAbs ? "$" : ""}${colToLetters(col)}`;
  if (t.row === -1) return c;
  return `${c}${t.rowAbs ? "$" : ""}${row + 1}`;
}

/** Rewrites the ref tokens of a formula. Returns the original formula if it cannot be tokenized. */
function rewriteRefs(
  formula: string,
  rewrite: (tokens: Token[], i: number) => { text: string; skip?: number } | null,
): string {
  if (!formula.startsWith("=")) return formula;
  const body = formula.slice(1);
  let tokens: Token[];
  try {
    tokens = tokenize(body);
  } catch {
    return formula;
  }
  let out = "";
  let last = 0;
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "ref") continue;
    const res = rewrite(tokens, i);
    if (!res) continue;
    const span = res.skip ? tokens[i + res.skip] : tokens[i];
    out += body.slice(last, tokens[i].start) + res.text;
    last = span.end;
    i += res.skip ?? 0;
  }
  return "=" + out + body.slice(last);
}

/**
 * Shifts relative references as Excel does when a formula is copied
 * (e.g. =B2*C2 copied one row down becomes =B3*C3).
 */
export function shiftFormula(formula: string, dRow: number, dCol: number): string {
  return rewriteRefs(formula, (tokens, i) => {
    const t = tokens[i] as RefToken;
    const row = t.row === -1 || t.rowAbs ? t.row : t.row + dRow;
    const col = t.colAbs ? t.col : t.col + dCol;
    if ((t.row !== -1 && row < 0) || col < 0) return { text: "#REF!" };
    return { text: refText(t, row, col) };
  });
}

export type StructureChange =
  | { type: "insertRow"; index: number }
  | { type: "deleteRow"; index: number }
  | { type: "insertCol"; index: number }
  | { type: "deleteCol"; index: number };

/**
 * Updates references after rows/columns are inserted or deleted.
 * Ranges ending directly above an inserted row grow to include it (like Excel tables).
 */
export function adjustFormulaForStructure(formula: string, change: StructureChange): string {
  const isRow = change.type === "insertRow" || change.type === "deleteRow";
  const insert = change.type === "insertRow" || change.type === "insertCol";
  const idx = change.index;
  const coord = (t: RefToken) => (isRow ? t.row : t.col);
  const withCoord = (t: RefToken, v: number) =>
    isRow ? refText(t, v, t.col) : refText(t, t.row, v);

  return rewriteRefs(formula, (tokens, i) => {
    const a = tokens[i] as RefToken;
    const isRange = tokens[i + 1]?.type === "colon" && tokens[i + 2]?.type === "ref";
    if (isRow && a.row === -1) return isRange ? { text: tokensText(tokens, i), skip: 2 } : null;

    if (!isRange) {
      const v = coord(a);
      if (insert) return v >= idx ? { text: withCoord(a, v + 1) } : null;
      if (v === idx) return { text: "#REF!" };
      return v > idx ? { text: withCoord(a, v - 1) } : null;
    }

    const b = tokens[i + 2] as RefToken;
    let s = coord(a);
    let e = coord(b);
    if (insert) {
      if (s >= idx) s++;
      if (e >= idx || (isRow && e === idx - 1 && s < e)) e++;
    } else {
      if (s === idx && e === idx) return { text: "#REF!", skip: 2 };
      if (s > idx) s--;
      if (e >= idx) e--;
    }
    return { text: `${withCoord(a, s)}:${withCoord(b, e)}`, skip: 2 };
  });

  function tokensText(tokens: Token[], i: number) {
    const a = tokens[i] as RefToken;
    const b = tokens[i + 2] as RefToken;
    return `${refText(a, a.row, a.col)}:${refText(b, b.row, b.col)}`;
  }
}

/** True when a formula references a multi-cell range (e.g. SUM(D2:D10)). */
export function hasRange(formula: string): boolean {
  if (!formula.startsWith("=")) return false;
  try {
    return tokenize(formula.slice(1)).some((t) => t.type === "colon");
  } catch {
    return false;
  }
}
