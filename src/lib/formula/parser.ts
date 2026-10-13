import { tokenize, type Token } from "./tokenizer";

export type Node =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "error"; value: string }
  | { kind: "ref"; row: number; col: number }
  | { kind: "range"; r1: number; c1: number; r2: number; c2: number }
  | { kind: "func"; name: string; args: Node[] }
  | { kind: "unary"; op: string; arg: Node }
  | { kind: "binary"; op: string; left: Node; right: Node }
  | { kind: "percent"; arg: Node };

export class ParseError extends Error {}

const COMPARISON = ["=", "<>", "<", ">", "<=", ">="];

/** Parses a formula body (without the leading "=") into an AST. */
export function parseFormula(src: string): Node {
  const tokens = tokenize(src);
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const isOp = (values: string[]) => {
    const t = peek();
    return t?.type === "op" && values.includes(t.value);
  };
  const expect = (type: Token["type"]) => {
    const t = tokens[pos];
    if (!t || t.type !== type) throw new ParseError(`Expected ${type}`);
    pos++;
    return t;
  };

  function binaryLevel(ops: string[], next: () => Node): () => Node {
    return () => {
      let left = next();
      while (isOp(ops)) {
        const op = (tokens[pos++] as { value: string }).value;
        left = { kind: "binary", op, left, right: next() };
      }
      return left;
    };
  }

  const comparison = (): Node => binaryLevel(COMPARISON, concat)();
  const concat = (): Node => binaryLevel(["&"], additive)();
  const additive = (): Node => binaryLevel(["+", "-"], multiplicative)();
  const multiplicative = (): Node => binaryLevel(["*", "/"], power)();
  const power = (): Node => binaryLevel(["^"], unary)();

  function unary(): Node {
    if (isOp(["+", "-"])) {
      const op = (tokens[pos++] as { value: string }).value;
      return { kind: "unary", op, arg: unary() };
    }
    let node = primary();
    while (isOp(["%"])) {
      pos++;
      node = { kind: "percent", arg: node };
    }
    return node;
  }

  function primary(): Node {
    const t = peek();
    if (!t) throw new ParseError("Unexpected end of formula");
    switch (t.type) {
      case "num":
        pos++;
        return { kind: "num", value: t.value };
      case "str":
        pos++;
        return { kind: "str", value: t.value };
      case "error":
        pos++;
        return { kind: "error", value: t.value };
      case "lparen": {
        pos++;
        const inner = comparison();
        expect("rparen");
        return inner;
      }
      case "ref": {
        pos++;
        if (peek()?.type === "colon") {
          pos++;
          const end = expect("ref") as Extract<Token, { type: "ref" }>;
          return {
            kind: "range",
            r1: Math.min(t.row, end.row),
            c1: Math.min(t.col, end.col),
            r2: t.row === -1 || end.row === -1 ? -1 : Math.max(t.row, end.row),
            c2: Math.max(t.col, end.col),
          };
        }
        if (t.row === -1) throw new ParseError("Incomplete column range");
        return { kind: "ref", row: t.row, col: t.col };
      }
      case "ident": {
        pos++;
        const upper = t.value.toUpperCase();
        if (peek()?.type === "lparen") {
          pos++;
          const args: Node[] = [];
          if (peek()?.type !== "rparen") {
            for (;;) {
              // Allow empty arguments such as IF(A1,,0)
              if (peek()?.type === "sep" || peek()?.type === "rparen") {
                args.push({ kind: "num", value: 0 });
              } else {
                args.push(comparison());
              }
              if (peek()?.type === "sep") {
                pos++;
                continue;
              }
              break;
            }
          }
          expect("rparen");
          return { kind: "func", name: upper, args };
        }
        if (upper === "TRUE" || upper === "ИСТИНА") return { kind: "bool", value: true };
        if (upper === "FALSE" || upper === "ЛОЖЬ") return { kind: "bool", value: false };
        return { kind: "error", value: "#NAME?" };
      }
      default:
        throw new ParseError("Unexpected token");
    }
  }

  const ast = comparison();
  if (pos < tokens.length) throw new ParseError("Unexpected token after end of formula");
  return ast;
}

/** Collects every cell/range a formula references (used for highlighting). */
export function collectRefs(node: Node, out: Node[] = []): Node[] {
  switch (node.kind) {
    case "ref":
    case "range":
      out.push(node);
      break;
    case "func":
      node.args.forEach((a) => collectRefs(a, out));
      break;
    case "unary":
    case "percent":
      collectRefs(node.arg, out);
      break;
    case "binary":
      collectRefs(node.left, out);
      collectRefs(node.right, out);
      break;
  }
  return out;
}
