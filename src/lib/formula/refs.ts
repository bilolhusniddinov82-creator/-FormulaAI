/** Zero-based column index -> Excel letters (0 -> A, 25 -> Z, 26 -> AA). */
export function colToLetters(col: number): string {
  let n = col + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Excel letters -> zero-based column index (A -> 0). Returns -1 when invalid. */
export function lettersToCol(letters: string): number {
  const up = letters.toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(up)) return -1;
  let n = 0;
  for (const ch of up) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export interface CellAddress {
  row: number;
  col: number;
}

/** Zero-based row/col -> "A1" style address. */
export function toAddress(row: number, col: number): string {
  return `${colToLetters(col)}${row + 1}`;
}

/** "B3" / "$B$3" -> { row: 2, col: 1 }. Returns null when not a valid address. */
export function parseAddress(address: string): CellAddress | null {
  const m = /^\$?([A-Za-z]{1,3})\$?(\d+)$/.exec(address.trim());
  if (!m) return null;
  const col = lettersToCol(m[1]);
  const row = parseInt(m[2], 10) - 1;
  if (col < 0 || row < 0) return null;
  return { row, col };
}
