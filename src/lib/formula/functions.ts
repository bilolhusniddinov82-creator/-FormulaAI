import type { Node } from "./parser";
import {
  compareValues,
  dateToSerial,
  err,
  flatten,
  formatGeneral,
  formatSerialDate,
  isError,
  isMatrix,
  parseDateText,
  serialToDate,
  todaySerial,
  toBool,
  toNumber,
  toScalar,
  toText,
  type EvalResult,
  type Matrix,
  type Scalar,
} from "./values";

export type Evaluate = (node: Node) => EvalResult;
type Fn = (args: Node[], ev: Evaluate) => EvalResult;

// ---------- helpers ----------

const scalarArg = (ev: Evaluate, n: Node | undefined, fallback: Scalar = null): Scalar =>
  n ? toScalar(ev(n)) : fallback;

function numArg(ev: Evaluate, n: Node | undefined, fallback?: number): number | ReturnType<typeof err> {
  if (!n) return fallback ?? err("#VALUE!");
  return toNumber(scalarArg(ev, n));
}

function textArg(ev: Evaluate, n: Node | undefined, fallback = ""): string | ReturnType<typeof err> {
  if (!n) return fallback;
  return toText(scalarArg(ev, n));
}

function asMatrix(v: EvalResult): Matrix {
  return isMatrix(v) ? v : [[v]];
}

/**
 * Collects numbers the way SUM/AVERAGE do: values inside ranges are counted only when
 * they are numbers; directly typed arguments are coerced.
 */
function collectNumbers(args: Node[], ev: Evaluate): number[] | ReturnType<typeof err> {
  const out: number[] = [];
  for (const a of args) {
    const v = ev(a);
    if (isMatrix(v)) {
      for (const x of v.flat()) {
        if (isError(x)) return x;
        if (typeof x === "number") out.push(x);
      }
    } else {
      if (v === null) continue;
      const n = toNumber(v);
      if (isError(n)) return n;
      out.push(n);
    }
  }
  return out;
}

function roundHalfAway(x: number, digits: number): number {
  const f = Math.pow(10, digits);
  const r = Math.round(Math.abs(x) * f * (1 + Number.EPSILON)) / f;
  return Math.sign(x) * r;
}

/** Builds an Excel criteria predicate: 5, ">100", "<>Apple", "App*", "". */
export function makeCriteria(criteria: Scalar): (v: Scalar) => boolean {
  if (typeof criteria === "number" || typeof criteria === "boolean") {
    return (v) => v === criteria || (typeof v === "string" && toNumber(v) === criteria);
  }
  const c = criteria === null || isError(criteria) ? "" : String(criteria);
  const m = /^(<=|>=|<>|<|>|=)?(.*)$/s.exec(c)!;
  const op = m[1] ?? "=";
  const rhsRaw = m[2];
  const rhsNum = rhsRaw.trim() !== "" && !isNaN(Number(rhsRaw)) ? Number(rhsRaw) : null;

  if (rhsNum !== null) {
    return (v) => {
      const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : null;
      if (n === null) return op === "<>";
      switch (op) {
        case "=": return n === rhsNum;
        case "<>": return n !== rhsNum;
        case "<": return n < rhsNum;
        case ">": return n > rhsNum;
        case "<=": return n <= rhsNum;
        case ">=": return n >= rhsNum;
      }
      return false;
    };
  }

  if (rhsRaw === "") {
    if (op === "=") return (v) => v === null || v === "";
    if (op === "<>") return (v) => !(v === null || v === "");
  }

  const pattern = new RegExp(
    "^" +
      rhsRaw
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/~\*/g, "\u0000")
        .replace(/~\?/g, "\u0001")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".")
        .replace(/\u0000/g, "\\*")
        .replace(/\u0001/g, "\\?") +
      "$",
    "is",
  );
  return (v) => {
    const s = v === null ? "" : isError(v) ? v.code : String(v);
    switch (op) {
      case "=": return pattern.test(s);
      case "<>": return !pattern.test(s);
      default: {
        const cmp = compareValues(s, rhsRaw);
        if (typeof v !== "string") return false;
        return op === "<" ? cmp < 0 : op === ">" ? cmp > 0 : op === "<=" ? cmp <= 0 : cmp >= 0;
      }
    }
  };
}

/** Shared implementation for SUMIFS / COUNTIFS / AVERAGEIFS / MAXIFS / MINIFS. */
function matchingIndexes(pairs: Node[], ev: Evaluate): number[] | ReturnType<typeof err> {
  if (pairs.length === 0 || pairs.length % 2 !== 0) return err("#VALUE!");
  let indexes: number[] | null = null;
  for (let i = 0; i < pairs.length; i += 2) {
    const range = flatten(ev(pairs[i]));
    const pred = makeCriteria(scalarArg(ev, pairs[i + 1]));
    const hits: number[] = [];
    range.forEach((v, idx) => {
      if (pred(v)) hits.push(idx);
    });
    indexes = indexes === null ? hits : indexes.filter((x) => hits.includes(x));
  }
  return indexes ?? [];
}

function numbersAt(range: Scalar[], idx: number[]): number[] {
  return idx.map((i) => range[i]).filter((v): v is number => typeof v === "number");
}

function exactFind(list: Scalar[], value: Scalar): number {
  const pred = typeof value === "string" ? makeCriteria(value) : null;
  return list.findIndex((v) => (pred ? typeof v === "string" && pred(v) : compareValues(v, value) === 0 && v !== null));
}

function approxFind(list: Scalar[], value: Scalar): number {
  // Largest value <= lookup value (list assumed ascending)
  let found = -1;
  for (let i = 0; i < list.length; i++) {
    if (list[i] === null) continue;
    if (compareValues(list[i], value) <= 0) found = i;
    else break;
  }
  return found;
}

function dateArg(ev: Evaluate, n: Node | undefined): number | ReturnType<typeof err> {
  const v = scalarArg(ev, n);
  if (typeof v === "string") {
    const d = parseDateText(v);
    if (d !== null) return d;
  }
  return toNumber(v);
}

function formatText(value: number, format: string): string {
  const f = format.trim();
  const lower = f.toLowerCase();
  if (/[dmy]/.test(lower) && !/0|#/.test(f)) {
    const d = serialToDate(value);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = String(d.getUTCFullYear());
    return lower
      .replace(/yyyy|гггг/g, yyyy)
      .replace(/yy|гг/g, yyyy.slice(2))
      .replace(/mm|мм/g, mm)
      .replace(/dd|дд/g, dd);
  }
  const isPercent = f.endsWith("%");
  const core = isPercent ? f.slice(0, -1) : f;
  const decimals = core.includes(".") ? core.split(".")[1].replace(/[^0#]/g, "").length : 0;
  const grouped = core.includes(",") || core.includes(" ");
  const v = isPercent ? value * 100 : value;
  const s = v.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouped,
  });
  return isPercent ? `${s}%` : s;
}

// ---------- function table ----------

const F: Record<string, Fn> = {
  // ----- Math -----
  SUM: (a, ev) => {
    const n = collectNumbers(a, ev);
    return isError(n) ? n : n.reduce((s, x) => s + x, 0);
  },
  PRODUCT: (a, ev) => {
    const n = collectNumbers(a, ev);
    return isError(n) ? n : n.length ? n.reduce((s, x) => s * x, 1) : 0;
  },
  ROUND: (a, ev) => {
    const x = numArg(ev, a[0]);
    const d = numArg(ev, a[1], 0);
    if (isError(x)) return x;
    if (isError(d)) return d;
    return roundHalfAway(x, Math.trunc(d));
  },
  ROUNDUP: (a, ev) => {
    const x = numArg(ev, a[0]);
    const d = numArg(ev, a[1], 0);
    if (isError(x)) return x;
    if (isError(d)) return d;
    const f = Math.pow(10, Math.trunc(d));
    return (Math.sign(x) * Math.ceil(parseFloat((Math.abs(x) * f).toPrecision(12)))) / f;
  },
  ROUNDDOWN: (a, ev) => {
    const x = numArg(ev, a[0]);
    const d = numArg(ev, a[1], 0);
    if (isError(x)) return x;
    if (isError(d)) return d;
    const f = Math.pow(10, Math.trunc(d));
    return (Math.sign(x) * Math.floor(parseFloat((Math.abs(x) * f).toPrecision(12)))) / f;
  },
  ABS: (a, ev) => {
    const x = numArg(ev, a[0]);
    return isError(x) ? x : Math.abs(x);
  },
  SQRT: (a, ev) => {
    const x = numArg(ev, a[0]);
    if (isError(x)) return x;
    return x < 0 ? err("#NUM!") : Math.sqrt(x);
  },
  POWER: (a, ev) => {
    const x = numArg(ev, a[0]);
    const y = numArg(ev, a[1]);
    if (isError(x)) return x;
    if (isError(y)) return y;
    return Math.pow(x, y);
  },
  MOD: (a, ev) => {
    const x = numArg(ev, a[0]);
    const y = numArg(ev, a[1]);
    if (isError(x)) return x;
    if (isError(y)) return y;
    if (y === 0) return err("#DIV/0!");
    return x - y * Math.floor(x / y);
  },
  INT: (a, ev) => {
    const x = numArg(ev, a[0]);
    return isError(x) ? x : Math.floor(x);
  },
  CEILING: (a, ev) => {
    const x = numArg(ev, a[0]);
    const s = numArg(ev, a[1], 1);
    if (isError(x)) return x;
    if (isError(s)) return s;
    return s === 0 ? 0 : Math.ceil(x / s) * s;
  },
  FLOOR: (a, ev) => {
    const x = numArg(ev, a[0]);
    const s = numArg(ev, a[1], 1);
    if (isError(x)) return x;
    if (isError(s)) return s;
    return s === 0 ? err("#DIV/0!") : Math.floor(x / s) * s;
  },
  PI: () => Math.PI,
  SUMPRODUCT: (a, ev) => {
    const arrays = a.map((n) => flatten(ev(n)));
    if (arrays.length === 0) return err("#VALUE!");
    const len = arrays[0].length;
    if (arrays.some((x) => x.length !== len)) return err("#VALUE!");
    let total = 0;
    for (let i = 0; i < len; i++) {
      let p = 1;
      for (const arr of arrays) {
        const v = arr[i];
        if (isError(v)) return v;
        p *= typeof v === "number" ? v : typeof v === "boolean" ? Number(v) : 0;
      }
      total += p;
    }
    return total;
  },

  // ----- Statistics -----
  AVERAGE: (a, ev) => {
    const n = collectNumbers(a, ev);
    if (isError(n)) return n;
    return n.length ? n.reduce((s, x) => s + x, 0) / n.length : err("#DIV/0!");
  },
  MIN: (a, ev) => {
    const n = collectNumbers(a, ev);
    return isError(n) ? n : n.length ? Math.min(...n) : 0;
  },
  MAX: (a, ev) => {
    const n = collectNumbers(a, ev);
    return isError(n) ? n : n.length ? Math.max(...n) : 0;
  },
  MEDIAN: (a, ev) => {
    const n = collectNumbers(a, ev);
    if (isError(n)) return n;
    if (!n.length) return err("#NUM!");
    const s = [...n].sort((x, y) => x - y);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  },
  COUNT: (a, ev) =>
    a.reduce((c, n) => {
      const v = ev(n);
      if (isMatrix(v)) return c + v.flat().filter((x) => typeof x === "number").length;
      return c + (typeof v === "number" || (typeof v === "string" && !isError(toNumber(v)) && v.trim() !== "") ? 1 : 0);
    }, 0),
  COUNTA: (a, ev) =>
    a.reduce((c, n) => c + flatten(ev(n)).filter((x) => x !== null && x !== "").length, 0),
  COUNTBLANK: (a, ev) => flatten(ev(a[0])).filter((x) => x === null || x === "").length,
  LARGE: (a, ev) => {
    const n = collectNumbers([a[0]], ev);
    const k = numArg(ev, a[1]);
    if (isError(n)) return n;
    if (isError(k)) return k;
    const s = [...n].sort((x, y) => y - x);
    return k >= 1 && k <= s.length ? s[Math.floor(k) - 1] : err("#NUM!");
  },
  SMALL: (a, ev) => {
    const n = collectNumbers([a[0]], ev);
    const k = numArg(ev, a[1]);
    if (isError(n)) return n;
    if (isError(k)) return k;
    const s = [...n].sort((x, y) => x - y);
    return k >= 1 && k <= s.length ? s[Math.floor(k) - 1] : err("#NUM!");
  },
  RANK: (a, ev) => {
    const x = numArg(ev, a[0]);
    const n = collectNumbers([a[1]], ev);
    const order = numArg(ev, a[2], 0);
    if (isError(x)) return x;
    if (isError(n)) return n;
    if (isError(order)) return order;
    if (!n.includes(x)) return err("#N/A");
    return 1 + n.filter((v) => (order ? v < x : v > x)).length;
  },
  STDEV: (a, ev) => {
    const n = collectNumbers(a, ev);
    if (isError(n)) return n;
    if (n.length < 2) return err("#DIV/0!");
    const mean = n.reduce((s, x) => s + x, 0) / n.length;
    return Math.sqrt(n.reduce((s, x) => s + (x - mean) ** 2, 0) / (n.length - 1));
  },

  // ----- Conditional aggregation -----
  SUMIF: (a, ev) => {
    const range = flatten(ev(a[0]));
    const sumRange = a[2] ? flatten(ev(a[2])) : range;
    const pred = makeCriteria(scalarArg(ev, a[1]));
    let total = 0;
    range.forEach((v, i) => {
      const s = sumRange[i];
      if (pred(v) && typeof s === "number") total += s;
    });
    return total;
  },
  COUNTIF: (a, ev) => {
    const pred = makeCriteria(scalarArg(ev, a[1]));
    return flatten(ev(a[0])).filter((v) => pred(v)).length;
  },
  AVERAGEIF: (a, ev) => {
    const range = flatten(ev(a[0]));
    const avgRange = a[2] ? flatten(ev(a[2])) : range;
    const pred = makeCriteria(scalarArg(ev, a[1]));
    const nums: number[] = [];
    range.forEach((v, i) => {
      const s = avgRange[i];
      if (pred(v) && typeof s === "number") nums.push(s);
    });
    return nums.length ? nums.reduce((s, x) => s + x, 0) / nums.length : err("#DIV/0!");
  },
  SUMIFS: (a, ev) => {
    const idx = matchingIndexes(a.slice(1), ev);
    if (isError(idx)) return idx;
    return numbersAt(flatten(ev(a[0])), idx).reduce((s, x) => s + x, 0);
  },
  COUNTIFS: (a, ev) => {
    const idx = matchingIndexes(a, ev);
    return isError(idx) ? idx : idx.length;
  },
  AVERAGEIFS: (a, ev) => {
    const idx = matchingIndexes(a.slice(1), ev);
    if (isError(idx)) return idx;
    const n = numbersAt(flatten(ev(a[0])), idx);
    return n.length ? n.reduce((s, x) => s + x, 0) / n.length : err("#DIV/0!");
  },
  MAXIFS: (a, ev) => {
    const idx = matchingIndexes(a.slice(1), ev);
    if (isError(idx)) return idx;
    const n = numbersAt(flatten(ev(a[0])), idx);
    return n.length ? Math.max(...n) : 0;
  },
  MINIFS: (a, ev) => {
    const idx = matchingIndexes(a.slice(1), ev);
    if (isError(idx)) return idx;
    const n = numbersAt(flatten(ev(a[0])), idx);
    return n.length ? Math.min(...n) : 0;
  },

  // ----- Logical -----
  IF: (a, ev) => {
    const c = toBool(scalarArg(ev, a[0]));
    if (isError(c)) return c;
    if (c) return a[1] ? ev(a[1]) : true;
    return a[2] ? ev(a[2]) : false;
  },
  IFS: (a, ev) => {
    for (let i = 0; i + 1 < a.length; i += 2) {
      const c = toBool(scalarArg(ev, a[i]));
      if (isError(c)) return c;
      if (c) return ev(a[i + 1]);
    }
    return err("#N/A");
  },
  IFERROR: (a, ev) => {
    const v = ev(a[0]);
    return isError(toScalar(v)) ? (a[1] ? ev(a[1]) : "") : v;
  },
  IFNA: (a, ev) => {
    const v = ev(a[0]);
    const s = toScalar(v);
    return isError(s) && s.code === "#N/A" ? (a[1] ? ev(a[1]) : "") : v;
  },
  AND: (a, ev) => {
    let result = true;
    for (const n of a) {
      for (const v of flatten(ev(n))) {
        if (v === null || typeof v === "string") continue;
        const b = toBool(v);
        if (isError(b)) return b;
        result = result && b;
      }
    }
    return result;
  },
  OR: (a, ev) => {
    let result = false;
    for (const n of a) {
      for (const v of flatten(ev(n))) {
        if (v === null || typeof v === "string") continue;
        const b = toBool(v);
        if (isError(b)) return b;
        result = result || b;
      }
    }
    return result;
  },
  NOT: (a, ev) => {
    const b = toBool(scalarArg(ev, a[0]));
    return isError(b) ? b : !b;
  },
  TRUE: () => true,
  FALSE: () => false,

  // ----- Lookup -----
  VLOOKUP: (a, ev) => {
    const value = scalarArg(ev, a[0]);
    const table = asMatrix(ev(a[1]));
    const col = numArg(ev, a[2]);
    if (isError(col)) return col;
    const approx = a[3] ? toBool(scalarArg(ev, a[3])) : true;
    if (isError(approx)) return approx;
    if (col < 1 || col > (table[0]?.length ?? 0)) return err("#REF!");
    const first = table.map((r) => r[0]);
    const i = approx ? approxFind(first, value) : exactFind(first, value);
    return i < 0 ? err("#N/A") : table[i][Math.floor(col) - 1];
  },
  HLOOKUP: (a, ev) => {
    const value = scalarArg(ev, a[0]);
    const table = asMatrix(ev(a[1]));
    const row = numArg(ev, a[2]);
    if (isError(row)) return row;
    const approx = a[3] ? toBool(scalarArg(ev, a[3])) : true;
    if (isError(approx)) return approx;
    if (row < 1 || row > table.length) return err("#REF!");
    const first = table[0] ?? [];
    const i = approx ? approxFind(first, value) : exactFind(first, value);
    return i < 0 ? err("#N/A") : table[Math.floor(row) - 1][i];
  },
  XLOOKUP: (a, ev) => {
    const value = scalarArg(ev, a[0]);
    const lookup = asMatrix(ev(a[1]));
    const ret = asMatrix(ev(a[2]));
    const mode = numArg(ev, a[4], 0);
    if (isError(mode)) return mode;
    const vertical = lookup.length > 1 || (lookup[0]?.length ?? 0) === 1;
    const list = vertical ? lookup.map((r) => r[0]) : lookup[0];
    let i = exactFind(list, value);
    if (i < 0 && (mode === -1 || mode === 1)) {
      let best = -1;
      list.forEach((v, idx) => {
        if (typeof v !== typeof value || v === null) return;
        const c = compareValues(v, value);
        if (mode === -1 && c <= 0 && (best < 0 || compareValues(v, list[best]) > 0)) best = idx;
        if (mode === 1 && c >= 0 && (best < 0 || compareValues(v, list[best]) < 0)) best = idx;
      });
      i = best;
    }
    if (i < 0) return a[3] ? ev(a[3]) : err("#N/A");
    if (vertical) return ret[i] ? (ret[i].length === 1 ? ret[i][0] : [ret[i]]) : err("#REF!");
    return ret.length === 1 ? (ret[0][i] ?? err("#REF!")) : ret.map((r) => [r[i]]);
  },
  INDEX: (a, ev) => {
    const m = asMatrix(ev(a[0]));
    const r = numArg(ev, a[1], 0);
    const c = numArg(ev, a[2], 0);
    if (isError(r)) return r;
    if (isError(c)) return c;
    // Single row/column ranges accept a single index
    if (m.length === 1 && c === 0 && a.length < 3) return m[0][r - 1] ?? err("#REF!");
    if (r === 0) return m.map((row) => [row[c - 1]]);
    if (c === 0 && (m[0]?.length ?? 0) > 1) return [m[r - 1] ?? []];
    return m[r - 1]?.[Math.max(c, 1) - 1] ?? err("#REF!");
  },
  MATCH: (a, ev) => {
    const value = scalarArg(ev, a[0]);
    const list = flatten(ev(a[1]));
    const type = numArg(ev, a[2], 1);
    if (isError(type)) return type;
    let i = -1;
    if (type === 0) i = exactFind(list, value);
    else if (type > 0) i = approxFind(list, value);
    else {
      for (let k = 0; k < list.length; k++) {
        if (compareValues(list[k], value) >= 0) i = k;
        else break;
      }
    }
    return i < 0 ? err("#N/A") : i + 1;
  },

  // ----- Text -----
  LEFT: (a, ev) => {
    const s = textArg(ev, a[0]);
    const n = numArg(ev, a[1], 1);
    if (isError(s)) return s;
    if (isError(n)) return n;
    return s.slice(0, Math.max(0, n));
  },
  RIGHT: (a, ev) => {
    const s = textArg(ev, a[0]);
    const n = numArg(ev, a[1], 1);
    if (isError(s)) return s;
    if (isError(n)) return n;
    return n <= 0 ? "" : s.slice(-n);
  },
  MID: (a, ev) => {
    const s = textArg(ev, a[0]);
    const start = numArg(ev, a[1]);
    const n = numArg(ev, a[2]);
    if (isError(s)) return s;
    if (isError(start)) return start;
    if (isError(n)) return n;
    if (start < 1) return err("#VALUE!");
    return s.substr(start - 1, n);
  },
  LEN: (a, ev) => {
    const s = textArg(ev, a[0]);
    return isError(s) ? s : s.length;
  },
  UPPER: (a, ev) => {
    const s = textArg(ev, a[0]);
    return isError(s) ? s : s.toUpperCase();
  },
  LOWER: (a, ev) => {
    const s = textArg(ev, a[0]);
    return isError(s) ? s : s.toLowerCase();
  },
  PROPER: (a, ev) => {
    const s = textArg(ev, a[0]);
    return isError(s) ? s : s.toLowerCase().replace(/(^|[^\p{L}])(\p{L})/gu, (_, p, c) => p + c.toUpperCase());
  },
  TRIM: (a, ev) => {
    const s = textArg(ev, a[0]);
    return isError(s) ? s : s.trim().replace(/\s+/g, " ");
  },
  CONCAT: (a, ev) => {
    let out = "";
    for (const n of a)
      for (const v of flatten(ev(n))) {
        const t = toText(v);
        if (isError(t)) return t;
        out += t;
      }
    return out;
  },
  TEXTJOIN: (a, ev) => {
    const delim = textArg(ev, a[0]);
    const ignoreEmpty = toBool(scalarArg(ev, a[1], true));
    if (isError(delim)) return delim;
    if (isError(ignoreEmpty)) return ignoreEmpty;
    const parts: string[] = [];
    for (const n of a.slice(2))
      for (const v of flatten(ev(n))) {
        const t = toText(v);
        if (isError(t)) return t;
        if (ignoreEmpty && t === "") continue;
        parts.push(t);
      }
    return parts.join(delim);
  },
  SUBSTITUTE: (a, ev) => {
    const s = textArg(ev, a[0]);
    const from = textArg(ev, a[1]);
    const to = textArg(ev, a[2]);
    if (isError(s)) return s;
    if (isError(from)) return from;
    if (isError(to)) return to;
    return from === "" ? s : s.split(from).join(to);
  },
  FIND: (a, ev) => {
    const needle = textArg(ev, a[0]);
    const hay = textArg(ev, a[1]);
    const start = numArg(ev, a[2], 1);
    if (isError(needle)) return needle;
    if (isError(hay)) return hay;
    if (isError(start)) return start;
    const i = hay.indexOf(needle, start - 1);
    return i < 0 ? err("#VALUE!") : i + 1;
  },
  SEARCH: (a, ev) => {
    const needle = textArg(ev, a[0]);
    const hay = textArg(ev, a[1]);
    const start = numArg(ev, a[2], 1);
    if (isError(needle)) return needle;
    if (isError(hay)) return hay;
    if (isError(start)) return start;
    const i = hay.toLowerCase().indexOf(needle.toLowerCase(), start - 1);
    return i < 0 ? err("#VALUE!") : i + 1;
  },
  TEXT: (a, ev) => {
    const v = numArg(ev, a[0]);
    const f = textArg(ev, a[1]);
    if (isError(v)) return v;
    if (isError(f)) return f;
    return formatText(v, f);
  },
  VALUE: (a, ev) => toNumber(scalarArg(ev, a[0])),
  EXACT: (a, ev) => {
    const x = textArg(ev, a[0]);
    const y = textArg(ev, a[1]);
    if (isError(x)) return x;
    if (isError(y)) return y;
    return x === y;
  },
  REPT: (a, ev) => {
    const s = textArg(ev, a[0]);
    const n = numArg(ev, a[1]);
    if (isError(s)) return s;
    if (isError(n)) return n;
    return s.repeat(Math.max(0, Math.floor(n)));
  },

  // ----- Date & time -----
  TODAY: () => todaySerial(),
  NOW: () => {
    const now = new Date();
    return todaySerial() + (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
  },
  DATE: (a, ev) => {
    const y = numArg(ev, a[0]);
    const m = numArg(ev, a[1]);
    const d = numArg(ev, a[2]);
    if (isError(y)) return y;
    if (isError(m)) return m;
    if (isError(d)) return d;
    return dateToSerial(y, m, d);
  },
  YEAR: (a, ev) => {
    const s = dateArg(ev, a[0]);
    return isError(s) ? s : serialToDate(s).getUTCFullYear();
  },
  MONTH: (a, ev) => {
    const s = dateArg(ev, a[0]);
    return isError(s) ? s : serialToDate(s).getUTCMonth() + 1;
  },
  DAY: (a, ev) => {
    const s = dateArg(ev, a[0]);
    return isError(s) ? s : serialToDate(s).getUTCDate();
  },
  WEEKDAY: (a, ev) => {
    const s = dateArg(ev, a[0]);
    const type = numArg(ev, a[1], 1);
    if (isError(s)) return s;
    if (isError(type)) return type;
    const dow = serialToDate(s).getUTCDay(); // 0 = Sunday
    if (type === 2) return dow === 0 ? 7 : dow;
    if (type === 3) return dow === 0 ? 6 : dow - 1;
    return dow + 1;
  },
  EOMONTH: (a, ev) => {
    const s = dateArg(ev, a[0]);
    const m = numArg(ev, a[1], 0);
    if (isError(s)) return s;
    if (isError(m)) return m;
    const d = serialToDate(s);
    return dateToSerial(d.getUTCFullYear(), d.getUTCMonth() + 2 + Math.trunc(m), 0);
  },
  EDATE: (a, ev) => {
    const s = dateArg(ev, a[0]);
    const m = numArg(ev, a[1], 0);
    if (isError(s)) return s;
    if (isError(m)) return m;
    const d = serialToDate(s);
    return dateToSerial(d.getUTCFullYear(), d.getUTCMonth() + 1 + Math.trunc(m), d.getUTCDate());
  },
  DAYS: (a, ev) => {
    const e = dateArg(ev, a[0]);
    const s = dateArg(ev, a[1]);
    if (isError(e)) return e;
    if (isError(s)) return s;
    return Math.floor(e) - Math.floor(s);
  },
  DATEDIF: (a, ev) => {
    const s = dateArg(ev, a[0]);
    const e = dateArg(ev, a[1]);
    const unit = textArg(ev, a[2], "D");
    if (isError(s)) return s;
    if (isError(e)) return e;
    if (isError(unit)) return unit;
    if (e < s) return err("#NUM!");
    const ds = serialToDate(s);
    const de = serialToDate(e);
    let months = (de.getUTCFullYear() - ds.getUTCFullYear()) * 12 + de.getUTCMonth() - ds.getUTCMonth();
    if (de.getUTCDate() < ds.getUTCDate()) months--;
    switch (unit.toUpperCase()) {
      case "Y": return Math.floor(months / 12);
      case "M": return months;
      case "D": return Math.floor(e) - Math.floor(s);
      default: return err("#NUM!");
    }
  },
  NETWORKDAYS: (a, ev) => {
    const s = dateArg(ev, a[0]);
    const e = dateArg(ev, a[1]);
    if (isError(s)) return s;
    if (isError(e)) return e;
    const [from, to, sign] = s <= e ? [s, e, 1] : [e, s, -1];
    let count = 0;
    for (let d = Math.floor(from); d <= Math.floor(to); d++) {
      const dow = serialToDate(d).getUTCDay();
      if (dow !== 0 && dow !== 6) count++;
    }
    return count * sign;
  },

  // ----- Information -----
  ISBLANK: (a, ev) => {
    const v = scalarArg(ev, a[0]);
    return v === null;
  },
  ISNUMBER: (a, ev) => typeof scalarArg(ev, a[0]) === "number",
  ISTEXT: (a, ev) => typeof scalarArg(ev, a[0]) === "string",
  ISERROR: (a, ev) => isError(scalarArg(ev, a[0])),
  NA: () => err("#N/A"),
};

// Common aliases / modern Excel names
F["CONCATENATE"] = F.CONCAT;
F["RANK.EQ"] = F.RANK;
F["STDEV.S"] = F.STDEV;
F["CEILING.MATH"] = F.CEILING;
F["FLOOR.MATH"] = F.FLOOR;

export const FUNCTIONS = F;
export const SUPPORTED_FUNCTIONS = Object.keys(F).sort();

/** Formats a date serial for display (used by the date number format). */
export { formatSerialDate, formatGeneral };
