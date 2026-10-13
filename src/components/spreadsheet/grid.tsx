"use client";

import { memo, useEffect, useRef } from "react";
import { colToLetters, isError, type Scalar } from "@/lib/formula";
import { formatValue, type DisplayOptions } from "@/lib/format";
import type { ColumnFormat } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface Pos {
  row: number;
  col: number;
}

export interface Range {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
}

export const COL_WIDTH = 132;
export const ROW_HEADER_WIDTH = 48;

interface RowProps {
  row: number;
  raw: string[];
  values: Scalar[];
  formats: ColumnFormat[];
  display: DisplayOptions;
  /** Selected column span in this row, or null. */
  selFrom: number | null;
  selTo: number | null;
  activeCol: number | null;
  editing: { col: number; value: string } | null;
  matches: string; // comma-joined matching column indexes (stable primitive for memo)
  refCols: string; // columns referenced by the active formula in this row
  flashCol: number | null;
  onCellMouseDown: (pos: Pos, e: React.MouseEvent) => void;
  onCellMouseEnter: (pos: Pos, e: React.MouseEvent) => void;
  onCellDoubleClick: (pos: Pos) => void;
  onRowHeaderClick: (row: number, e: React.MouseEvent) => void;
  onEditChange: (value: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onEditBlur: () => void;
}

function EditInput({
  value,
  onChange,
  onKeyDown,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      spellCheck={false}
      className="absolute inset-0 z-20 h-full w-full min-w-full border-2 border-primary bg-card px-2 font-mono text-[13px] outline-none"
      style={{ width: Math.max(COL_WIDTH, value.length * 8 + 24) }}
    />
  );
}

export const GridRow = memo(function GridRow(p: RowProps) {
  const isHeader = p.row === 0;
  const matchSet = p.matches ? new Set(p.matches.split(",").map(Number)) : null;
  const refSet = p.refCols ? new Set(p.refCols.split(",").map(Number)) : null;
  return (
    <tr>
      <th
        scope="row"
        onMouseDown={(e) => p.onRowHeaderClick(p.row, e)}
        className={cn(
          "sticky left-0 z-10 cursor-pointer select-none border-b border-r bg-[hsl(var(--grid-header))] text-center text-xs font-normal text-muted-foreground",
          p.selFrom !== null && "bg-primary/15 font-semibold text-primary",
        )}
        style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH }}
      >
        {p.row + 1}
      </th>
      {p.raw.map((raw, col) => {
        const value = p.values[col] ?? null;
        const format = p.formats[col] ?? "general";
        const text = isHeader && !raw.startsWith("=") ? raw : formatValue(value, format, p.display);
        const numeric = typeof value === "number" && !isHeader;
        const err = isError(value);
        const selected = p.selFrom !== null && col >= p.selFrom && col <= (p.selTo ?? p.selFrom);
        const active = p.activeCol === col;
        const editing = p.editing?.col === col;
        return (
          <td
            key={col}
            data-row={p.row}
            data-col={col}
            onMouseDown={(e) => p.onCellMouseDown({ row: p.row, col }, e)}
            onMouseEnter={(e) => p.onCellMouseEnter({ row: p.row, col }, e)}
            onDoubleClick={() => p.onCellDoubleClick({ row: p.row, col })}
            title={raw.startsWith("=") ? raw : undefined}
            className={cn(
              "relative h-8 cursor-cell select-none overflow-hidden whitespace-nowrap border-b border-r border-[hsl(var(--grid-line))] px-2 text-[13px]",
              isHeader && "bg-[hsl(var(--grid-header))] font-semibold",
              numeric && "text-right tabular-nums",
              err && "text-destructive",
              raw.startsWith("=") && !err && !isHeader && "text-foreground",
              matchSet?.has(col) && "bg-amber-300/40 dark:bg-amber-500/25",
              refSet?.has(col) && "bg-violet/10 ring-1 ring-inset ring-violet/60",
              selected && !active && "bg-primary/10",
              p.flashCol === col && "animate-pulse bg-success/20",
            )}
            style={{ width: COL_WIDTH, minWidth: COL_WIDTH, maxWidth: editing ? undefined : COL_WIDTH }}
          >
            {active && <span className="pointer-events-none absolute inset-0 z-10 border-2 border-primary" />}
            {editing ? (
              <EditInput value={p.editing!.value} onChange={p.onEditChange} onKeyDown={p.onEditKeyDown} onBlur={p.onEditBlur} />
            ) : (
              <span className="block truncate">{text}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
});

export function ColumnHeaders({
  count,
  selFrom,
  selTo,
  onClick,
}: {
  count: number;
  selFrom: number;
  selTo: number;
  onClick: (col: number, e: React.MouseEvent) => void;
}) {
  return (
    <tr>
      <th
        className="sticky left-0 top-0 z-30 border-b border-r bg-[hsl(var(--grid-header))]"
        style={{ width: ROW_HEADER_WIDTH, minWidth: ROW_HEADER_WIDTH }}
      />
      {Array.from({ length: count }, (_, c) => (
        <th
          key={c}
          scope="col"
          onMouseDown={(e) => onClick(c, e)}
          className={cn(
            "sticky top-0 z-20 h-7 cursor-pointer select-none border-b border-r bg-[hsl(var(--grid-header))] text-xs font-medium text-muted-foreground",
            c >= selFrom && c <= selTo && "bg-primary/15 font-semibold text-primary",
          )}
          style={{ width: COL_WIDTH, minWidth: COL_WIDTH }}
        >
          {colToLetters(c)}
        </th>
      ))}
    </tr>
  );
}
