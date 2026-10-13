export type ErrorCode =
  | "#DIV/0!"
  | "#VALUE!"
  | "#REF!"
  | "#NAME?"
  | "#N/A"
  | "#NUM!"
  | "#NULL!"
  | "#CIRC!"
  | "#ERROR!";

export class FormulaError {
  constructor(public readonly code: ErrorCode) {}
  toString() {
    return this.code;
  }
}

export type Scalar = number | string | boolean | null | FormulaError;
export type Matrix = Scalar[][];
export type EvalResult = Scalar | Matrix;

export const err = (code: ErrorCode) => new FormulaError(code);
export const isError = (v: unknown): v is FormulaError => v instanceof FormulaError;
export const isMatrix = (v: EvalResult): v is Matrix => Array.isArray(v);

/** Picks a single value from a matrix the way Excel's implicit intersection does (top-left). */
export function toScalar(v: EvalResult): Scalar {
  if (isMatrix(v)) return v[0]?.[0] ?? null;
  return v;
}

export function flatten(v: EvalResult): Scalar[] {
  if (isMatrix(v)) return v.flat();
  return [v];
}

/** Parses a raw cell input into a literal value (numbers, percents, booleans, text). */
export function parseLiteral(raw: string): Scalar {
  const s = raw.trim();
  if (s === "") return null;
  if (/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) return parseFloat(s);
  // 1,500,000 or 1,500.25 (comma thousands)
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return parseFloat(s.replace(/,/g, ""));
  // 1 500 000 or 1 500,25 (space / nbsp thousands)
  if (/^-?\d{1,3}([   ]\d{3})+([.,]\d+)?$/.test(s))
    return parseFloat(s.replace(/[   ]/g, "").replace(",", "."));
  // 1,5 (decimal comma)
  if (/^-?\d+,\d{1,2}$|^-?\d+,\d{4,}$/.test(s)) return parseFloat(s.replace(",", "."));
  const pct = /^([-+]?\d+(?:[.,]\d+)?)\s*%$/.exec(s);
  if (pct) return parseFloat(pct[1].replace(",", ".")) / 100;
  const up = s.toUpperCase();
  if (up === "TRUE" || up === "ИСТИНА") return true;
  if (up === "FALSE" || up === "ЛОЖЬ") return false;
  return s;
}

/** Coerces a value to a number following Excel rules. Text that looks numeric is accepted. */
export function toNumber(v: Scalar): number | FormulaError {
  if (v === null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (isError(v)) return v;
  if (v.trim() === "") return 0;
  const lit = parseLiteral(v);
  return typeof lit === "number" ? lit : err("#VALUE!");
}

export function toText(v: Scalar): string | FormulaError {
  if (v === null) return "";
  if (isError(v)) return v;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return formatGeneral(v);
  return v;
}

export function toBool(v: Scalar): boolean | FormulaError {
  if (v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (isError(v)) return v;
  const up = v.toUpperCase();
  if (up === "TRUE") return true;
  if (up === "FALSE") return false;
  return err("#VALUE!");
}

/** Formats a number the way Excel's "General" format roughly does (max ~11 significant digits). */
export function formatGeneral(n: number): string {
  if (!isFinite(n)) return "#NUM!";
  if (Number.isInteger(n)) return String(n);
  const rounded = parseFloat(n.toPrecision(12));
  return String(rounded);
}

/** Excel-style comparison: returns negative, 0, or positive. Numbers < text < booleans. */
export function compareValues(a: Scalar, b: Scalar): number {
  const rank = (v: Scalar) =>
    typeof v === "number" || v === null ? 0 : typeof v === "string" ? 1 : 2;
  if (a === null && typeof b === "string") a = "";
  if (b === null && typeof a === "string") b = "";
  const ra = rank(a);
  const rb = rank(b);
  if (ra !== rb) return ra - rb;
  if (ra === 0) return ((a as number) ?? 0) - ((b as number) ?? 0);
  if (ra === 1) {
    const x = (a as string).toLowerCase();
    const y = (b as string).toLowerCase();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  return Number(a) - Number(b);
}

// ---------- Dates (Excel serial numbers, 1900 date system) ----------

const EPOCH = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

export function dateToSerial(y: number, m: number, d: number): number {
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / DAY_MS);
}

export function serialToDate(serial: number): Date {
  return new Date(EPOCH + Math.floor(serial) * DAY_MS);
}

export function todaySerial(): number {
  const now = new Date();
  return dateToSerial(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function formatSerialDate(serial: number): string {
  const d = serialToDate(serial);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

/** Parses "2024-03-15", "15.03.2024" or "15/03/2024" into a serial number. */
export function parseDateText(s: string): number | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  if (m) return dateToSerial(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s.trim());
  if (m) return dateToSerial(+m[3], +m[2], +m[1]);
  return null;
}
