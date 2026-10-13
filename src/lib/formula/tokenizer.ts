import { lettersToCol } from "./refs";

export type Token =
  | { type: "num"; value: number; start: number; end: number }
  | { type: "str"; value: string; start: number; end: number }
  | {
      type: "ref";
      col: number;
      row: number;
      colAbs: boolean;
      rowAbs: boolean;
      start: number;
      end: number;
    }
  | { type: "ident"; value: string; start: number; end: number }
  | { type: "op"; value: string; start: number; end: number }
  | { type: "lparen" | "rparen" | "sep" | "colon"; start: number; end: number }
  | { type: "error"; value: string; start: number; end: number };

const OPS2 = ["<=", ">=", "<>"];
const OPS1 = ["+", "-", "*", "/", "^", "&", "=", "<", ">", "%"];
const ERROR_LITERALS = ["#DIV/0!", "#VALUE!", "#REF!", "#NAME?", "#N/A", "#NUM!", "#NULL!"];

export class TokenizeError extends Error {}

/** Tokenizes a formula body (without the leading "="). */
export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    const start = i;

    if (ch === '"') {
      let value = "";
      i++;
      while (i < src.length) {
        if (src[i] === '"') {
          if (src[i + 1] === '"') {
            value += '"';
            i += 2;
            continue;
          }
          break;
        }
        value += src[i++];
      }
      if (src[i] !== '"') throw new TokenizeError("Unterminated string");
      i++;
      tokens.push({ type: "str", value, start, end: i });
      continue;
    }

    if (ch === "#") {
      const lit = ERROR_LITERALS.find((e) => src.startsWith(e, i));
      if (!lit) throw new TokenizeError(`Unexpected "#" at ${i}`);
      i += lit.length;
      tokens.push({ type: "error", value: lit, start, end: i });
      continue;
    }

    const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) {
      i += num[0].length;
      tokens.push({ type: "num", value: parseFloat(num[0]), start, end: i });
      continue;
    }

    const refMatch = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)/.exec(src.slice(i));
    const identMatch = /^[\p{L}_][\p{L}\p{N}_.]*/u.exec(src.slice(i));
    const nextNonSpace = (pos: number) => {
      while (pos < src.length && /\s/.test(src[pos])) pos++;
      return src[pos];
    };

    if (refMatch) {
      const afterRef = i + refMatch[0].length;
      const continuesAsIdent = /[\p{L}\p{N}_.]/u.test(src[afterRef] ?? "");
      if (!continuesAsIdent && nextNonSpace(afterRef) !== "(") {
        tokens.push({
          type: "ref",
          colAbs: refMatch[1] === "$",
          col: lettersToCol(refMatch[2]),
          rowAbs: refMatch[3] === "$",
          row: parseInt(refMatch[4], 10) - 1,
          start,
          end: afterRef,
        });
        i = afterRef;
        continue;
      }
    }

    // Whole-column reference like $B or B used in B:B
    const colOnly = /^(\$?)([A-Za-z]{1,3})(?=\s*:\s*\$?[A-Za-z]{1,3}(?![\p{L}\p{N}]))/u.exec(src.slice(i));
    if (colOnly) {
      i += colOnly[0].length;
      tokens.push({
        type: "ref",
        colAbs: colOnly[1] === "$",
        col: lettersToCol(colOnly[2]),
        rowAbs: true,
        row: -1, // -1 marks a whole-column reference
        start,
        end: i,
      });
      continue;
    }
    const prev = tokens[tokens.length - 1];
    if (prev?.type === "colon") {
      const colEnd = /^(\$?)([A-Za-z]{1,3})(?![\p{L}\p{N}_(])/u.exec(src.slice(i));
      const before = tokens[tokens.length - 2];
      if (colEnd && before?.type === "ref" && before.row === -1) {
        i += colEnd[0].length;
        tokens.push({
          type: "ref",
          colAbs: colEnd[1] === "$",
          col: lettersToCol(colEnd[2]),
          rowAbs: true,
          row: -1,
          start,
          end: i,
        });
        continue;
      }
    }

    if (identMatch) {
      i += identMatch[0].length;
      tokens.push({ type: "ident", value: identMatch[0], start, end: i });
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen", start, end: ++i });
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", start, end: ++i });
      continue;
    }
    if (ch === "," || ch === ";") {
      tokens.push({ type: "sep", start, end: ++i });
      continue;
    }
    if (ch === ":") {
      tokens.push({ type: "colon", start, end: ++i });
      continue;
    }
    const op2 = src.slice(i, i + 2);
    if (OPS2.includes(op2)) {
      i += 2;
      tokens.push({ type: "op", value: op2, start, end: i });
      continue;
    }
    if (OPS1.includes(ch)) {
      tokens.push({ type: "op", value: ch, start, end: ++i });
      continue;
    }
    throw new TokenizeError(`Unexpected character "${ch}"`);
  }
  return tokens;
}
