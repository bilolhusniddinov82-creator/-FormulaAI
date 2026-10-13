"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ArrowDownToLine,
  ArrowDownZA,
  ChevronDown,
  Columns3,
  Download,
  FileDown,
  FileSpreadsheet,
  FileText,
  FunctionSquare,
  PanelRightClose,
  PanelRightOpen,
  PencilLine,
  Redo2,
  RotateCcw,
  Rows3,
  Search,
  Sigma,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, Select } from "@/components/ui/input";
import { Tip } from "@/components/ui/tooltip";
import { useHydrated } from "@/components/layout/providers";
import { UploadButton } from "@/components/shared/upload-button";
import {
  colToLetters,
  evaluateGrid,
  isError,
  toAddress,
  validateFormula,
  type Scalar,
} from "@/lib/formula";
import { parseFormula, collectRefs } from "@/lib/formula/parser";
import { formatValue } from "@/lib/format";
import * as ops from "@/lib/sheet-ops";
import { downloadOriginal, exportCsv, exportXlsx } from "@/lib/spreadsheet-io";
import { sampleSheet } from "@/lib/templates";
import type { ColumnFormat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSettings, useT } from "@/store/settings-store";
import { useSheet } from "@/store/sheet-store";
import { AssistantPanel } from "./assistant-panel";
import { ColumnHeaders, GridRow, ROW_HEADER_WIDTH, COL_WIDTH, type Pos } from "./grid";

type Editing = { row: number; col: number; value: string; source: "cell" | "bar" } | null;

const FORMATS: ColumnFormat[] = ["general", "number", "currency", "percent", "date"];
const PAGE = 200;

export function SpreadsheetEditor() {
  const t = useT();
  const ready = useHydrated((s) => s.ready);
  const { sheet, apply, undo, redo, past, future, original, focus, load } = useSheet();
  const lang = useSettings((s) => s.language);
  const currency = useSettings((s) => s.currency);
  const decimals = useSettings((s) => s.decimals);
  const display = useMemo(() => ({ lang, currency, decimals }), [lang, currency, decimals]);

  const values = useMemo(() => evaluateGrid(sheet.cells), [sheet.cells]);
  const rows = sheet.cells.length;
  const cols = sheet.formats.length;

  const [anchor, setAnchor] = useState<Pos>({ row: 1, col: 0 });
  const [cursor, setCursor] = useState<Pos>({ row: 1, col: 0 });
  const [editing, setEditing] = useState<Editing>(null);
  const [search, setSearch] = useState("");
  const [totalsMode, setTotalsMode] = useState<"sum" | "avg" | "count">("sum");
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [visibleRows, setVisibleRows] = useState(PAGE);
  const [rename, setRename] = useState<{ col: number; value: string } | null>(null);
  const [flash, setFlash] = useState<Pos | null>(null);
  const dragging = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const range = {
    r1: Math.min(anchor.row, cursor.row),
    r2: Math.max(anchor.row, cursor.row),
    c1: Math.min(anchor.col, cursor.col),
    c2: Math.max(anchor.col, cursor.col),
  };
  const rawAt = (p: Pos) => sheet.cells[p.row]?.[p.col] ?? "";
  const lastData = ops.lastDataRow(sheet.cells);

  // Keep selection inside the grid after structural changes
  useEffect(() => {
    const clamp = (p: Pos) => ({ row: Math.min(p.row, rows - 1), col: Math.min(p.col, cols - 1) });
    setCursor((c) => clamp(c));
    setAnchor((a) => clamp(a));
  }, [rows, cols]);

  const focusGrid = () => requestAnimationFrame(() => gridRef.current?.focus({ preventScroll: true }));

  const scrollTo = useCallback((p: Pos) => {
    requestAnimationFrame(() => {
      const el = gridRef.current?.querySelector<HTMLElement>(`td[data-row="${p.row}"][data-col="${p.col}"]`);
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }, []);

  // Select and flash a cell requested elsewhere (e.g. "Insert into spreadsheet")
  useEffect(() => {
    if (!focus) return;
    const p = { row: focus.row, col: focus.col };
    setAnchor(p);
    setCursor(p);
    setFlash(p);
    if (p.row >= visibleRows) setVisibleRows(p.row + PAGE);
    scrollTo(p);
    const id = setTimeout(() => setFlash(null), 1800);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.at]);

  // ---------- editing ----------

  const startEdit = (p: Pos, initial?: string, source: "cell" | "bar" = "cell") =>
    setEditing({ row: p.row, col: p.col, value: initial ?? rawAt(p), source });

  /** Commits the edit; returns false when the formula is invalid (editing continues). */
  const commitEdit = (): boolean => {
    if (!editing) return true;
    const { row, col, value } = editing;
    if (value.startsWith("=") && value.length > 1) {
      const problem = validateFormula(value);
      if (problem) {
        toast.error(t("sheet.invalidFormula"), { description: problem });
        return false;
      }
    }
    if (value !== rawAt({ row, col })) apply((s) => ops.setCell(s, row, col, value));
    setEditing(null);
    return true;
  };

  const cancelEdit = () => {
    setEditing(null);
    focusGrid();
  };

  const move = (dr: number, dc: number, extend = false) => {
    let row = Math.max(0, cursor.row + dr);
    const col = Math.max(0, Math.min(cols - 1, cursor.col + dc));
    if (row > rows - 1) {
      apply((s) => ops.normalize(s, row + 1));
    }
    row = Math.max(0, row);
    const p = { row, col };
    setCursor(p);
    if (!extend) setAnchor(p);
    if (row >= visibleRows) setVisibleRows(row + PAGE);
    scrollTo(p);
  };

  const clearRange = () => {
    apply((s) => {
      const next = ops.cloneSheet(s);
      for (let r = range.r1; r <= range.r2; r++) for (let c = range.c1; c <= range.c2; c++) next.cells[r][c] = "";
      return next;
    });
  };

  const copyRange = async () => {
    const text = [];
    for (let r = range.r1; r <= range.r2; r++) {
      const line = [];
      for (let c = range.c1; c <= range.c2; c++) {
        const v = values[r]?.[c];
        line.push(v === null || v === undefined ? "" : isError(v) ? v.code : String(v));
      }
      text.push(line.join("\t"));
    }
    try {
      await navigator.clipboard.writeText(text.join("\n"));
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    if (editing) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;
    if (mod && key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && key.toLowerCase() === "y") {
      e.preventDefault();
      redo();
      return;
    }
    if (mod && key.toLowerCase() === "c") {
      e.preventDefault();
      void copyRange();
      return;
    }
    if (mod && key.toLowerCase() === "a") {
      e.preventDefault();
      setAnchor({ row: 0, col: 0 });
      setCursor({ row: rows - 1, col: cols - 1 });
      return;
    }
    if (mod) return;
    switch (key) {
      case "ArrowUp": e.preventDefault(); move(-1, 0, e.shiftKey); return;
      case "ArrowDown": e.preventDefault(); move(1, 0, e.shiftKey); return;
      case "ArrowLeft": e.preventDefault(); move(0, -1, e.shiftKey); return;
      case "ArrowRight": e.preventDefault(); move(0, 1, e.shiftKey); return;
      case "Tab": e.preventDefault(); move(0, e.shiftKey ? -1 : 1); return;
      case "Enter":
      case "F2": e.preventDefault(); startEdit(cursor); return;
      case "Delete":
      case "Backspace": e.preventDefault(); clearRange(); return;
      case "Escape": setAnchor(cursor); return;
    }
    if (key.length === 1) {
      e.preventDefault();
      setAnchor(cursor);
      startEdit(cursor, key);
    }
  };

  const onEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (commitEdit()) {
        move(1, 0);
        focusGrid();
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (commitEdit()) {
        move(0, e.shiftKey ? -1 : 1);
        focusGrid();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (editing) return;
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;
    e.preventDefault();
    const block = ops.parseClipboard(text);
    apply((s) => ops.pasteBlock(s, cursor.row, cursor.col, block));
    const count = block.reduce((n, r) => n + r.length, 0);
    setCursor({ row: cursor.row + block.length - 1, col: cursor.col + Math.max(...block.map((r) => r.length)) - 1 });
    toast.success(`${t("sheet.pasted")}: ${count} ${t("sheet.cells")}`);
  };

  // ---------- mouse ----------

  useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const onCellMouseDown = useCallback(
    (p: Pos, e: React.MouseEvent) => {
      // While typing a formula, clicking another cell inserts its address
      if (editing && editing.value.startsWith("=") && (editing.row !== p.row || editing.col !== p.col)) {
        e.preventDefault();
        setEditing({ ...editing, value: editing.value + toAddress(p.row, p.col) });
        return;
      }
      if (editing && (editing.row !== p.row || editing.col !== p.col)) {
        if (!commitEdit()) {
          e.preventDefault();
          return;
        }
      }
      if (editing && editing.row === p.row && editing.col === p.col) return;
      e.preventDefault();
      gridRef.current?.focus({ preventScroll: true });
      setCursor(p);
      if (!e.shiftKey) setAnchor(p);
      dragging.current = true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing, sheet],
  );

  const onCellMouseEnter = useCallback((p: Pos) => {
    if (dragging.current) setCursor(p);
  }, []);

  const onCellDoubleClick = useCallback((p: Pos) => {
    setAnchor(p);
    setCursor(p);
    setEditing({ row: p.row, col: p.col, value: useSheet.getState().sheet.cells[p.row]?.[p.col] ?? "", source: "cell" });
  }, []);

  const onRowHeaderClick = useCallback(
    (row: number, e: React.MouseEvent) => {
      e.preventDefault();
      if (editing && !commitEdit()) return;
      gridRef.current?.focus({ preventScroll: true });
      if (e.shiftKey) setCursor({ row, col: cols - 1 });
      else {
        setAnchor({ row, col: 0 });
        setCursor({ row, col: cols - 1 });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cols, editing, sheet],
  );

  const onColumnClick = (col: number, e: React.MouseEvent) => {
    e.preventDefault();
    if (editing && !commitEdit()) return;
    gridRef.current?.focus({ preventScroll: true });
    if (e.shiftKey) setCursor({ row: Math.max(lastData, 1), col });
    else {
      setAnchor({ row: 0, col });
      setCursor({ row: Math.max(lastData, 1), col });
    }
  };

  const onEditChange = useCallback((value: string) => setEditing((ed) => (ed ? { ...ed, value } : ed)), []);
  const onEditBlur = useCallback(() => {
    // Blur happens when clicking elsewhere on the page; commit unless the formula is invalid
    setTimeout(() => {
      const ed = editingRef.current;
      if (ed && ed.source === "cell" && document.activeElement?.tagName !== "INPUT") commitRef.current();
    }, 0);
  }, []);
  const editingRef = useRef(editing);
  editingRef.current = editing;
  const commitRef = useRef(commitEdit);
  commitRef.current = commitEdit;

  // ---------- derived ----------

  const activeFormula = editing ? editing.value : rawAt(cursor);
  const refMap = useMemo(() => {
    const map = new Map<number, number[]>();
    if (!activeFormula.startsWith("=")) return map;
    try {
      const refs = collectRefs(parseFormula(activeFormula.slice(1)));
      for (const n of refs) {
        const [r1, c1, r2, c2] =
          n.kind === "ref" ? [n.row, n.col, n.row, n.col] : n.kind === "range" ? [n.r1 === -1 ? 0 : n.r1, n.c1, n.r2 === -1 ? rows - 1 : n.r2, n.c2] : [0, 0, -1, -1];
        if ((r2 - r1 + 1) * (c2 - c1 + 1) > 5000) continue;
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) map.set(r, [...(map.get(r) ?? []), c]);
      }
    } catch {
      /* incomplete formula while typing */
    }
    return map;
  }, [activeFormula, rows]);

  const matchMap = useMemo(() => {
    const map = new Map<number, number[]>();
    const q = search.trim().toLowerCase();
    if (!q) return map;
    sheet.cells.forEach((row, r) =>
      row.forEach((raw, c) => {
        const shown = r === 0 ? raw : formatValue(values[r][c], sheet.formats[c], display);
        if (shown.toLowerCase().includes(q) || raw.toLowerCase().includes(q)) map.set(r, [...(map.get(r) ?? []), c]);
      }),
    );
    return map;
  }, [search, sheet, values, display]);
  const matchCount = [...matchMap.values()].reduce((n, c) => n + c.length, 0);

  const nextMatch = () => {
    const all: Pos[] = [];
    [...matchMap.entries()].sort((a, b) => a[0] - b[0]).forEach(([row, cs]) => cs.forEach((col) => all.push({ row, col })));
    if (!all.length) return;
    const next = all.find((p) => p.row > cursor.row || (p.row === cursor.row && p.col > cursor.col)) ?? all[0];
    setAnchor(next);
    setCursor(next);
    if (next.row >= visibleRows) setVisibleRows(next.row + PAGE);
    scrollTo(next);
  };

  const totals = useMemo(() => {
    return sheet.formats.map((_, c) => {
      const nums: number[] = [];
      for (let r = 1; r <= lastData; r++) {
        const v = values[r]?.[c];
        if (typeof v === "number") nums.push(v);
      }
      if (!nums.length) return null;
      if (totalsMode === "count") return nums.length;
      const sum = nums.reduce((a, b) => a + b, 0);
      return totalsMode === "sum" ? sum : sum / nums.length;
    });
  }, [values, sheet.formats, lastData, totalsMode]);

  const selStats = useMemo(() => {
    const nums: number[] = [];
    let filled = 0;
    for (let r = range.r1; r <= range.r2; r++)
      for (let c = range.c1; c <= range.c2; c++) {
        const v: Scalar | undefined = values[r]?.[c];
        if (v !== null && v !== undefined && v !== "") filled++;
        if (typeof v === "number" && r > 0) nums.push(v);
      }
    const sum = nums.reduce((a, b) => a + b, 0);
    return { sum, avg: nums.length ? sum / nums.length : 0, count: filled, numeric: nums.length };
  }, [values, range.r1, range.r2, range.c1, range.c2]);

  // ---------- toolbar actions ----------

  const addRow = () => {
    const at = Math.max(1, range.r2 + 1);
    apply((s) => ops.insertRow(s, at));
    const p = { row: at, col: cursor.col };
    setAnchor(p);
    setCursor(p);
    scrollTo(p);
  };
  const deleteRows = () => {
    if (rows - (range.r2 - range.r1 + 1) < 1) return toast.error(t("sheet.cantDeleteLast"));
    apply((s) => {
      let next = s;
      for (let r = range.r2; r >= range.r1; r--) next = ops.deleteRow(next, r);
      return ops.normalize(next);
    });
  };
  const addColumn = () => {
    const at = range.c2 + 1;
    apply((s) => ops.insertCol(s, at));
    setAnchor({ row: 0, col: at });
    setCursor({ row: 0, col: at });
    setRename({ col: at, value: "" });
  };
  const deleteColumns = () => {
    if (cols - (range.c2 - range.c1 + 1) < 1) return toast.error(t("sheet.cantDeleteLast"));
    apply((s) => {
      let next = s;
      for (let c = range.c2; c >= range.c1; c--) next = ops.deleteCol(next, c);
      return ops.normalize(next);
    });
  };
  const setFormat = (format: ColumnFormat) =>
    apply((s) => {
      let next = s;
      for (let c = range.c1; c <= range.c2; c++) next = ops.setFormat(next, c, format);
      return next;
    });
  const sort = (dir: "asc" | "desc") => apply((s) => ops.sortRows(s, cursor.col, dir, values));
  const fillDown = () => {
    if (!rawAt(cursor).startsWith("=")) return;
    apply((s) => ops.fillDown(s, cursor.row, cursor.col, range.r2 > cursor.row ? range.r2 : undefined));
  };
  const exportFile = (kind: "xlsx" | "csv") => {
    try {
      if (kind === "xlsx") exportXlsx(sheet, { currency, decimals, fileName: original ? `${original.name.replace(/\.[^.]+$/, "")}-processed` : undefined });
      else exportCsv(sheet);
      toast.success(t("sheet.exported"));
    } catch {
      toast.error(t("error.generic"));
    }
  };

  const formatOfCursor = sheet.formats[cursor.col] ?? "general";
  const address = range.r1 === range.r2 && range.c1 === range.c2
    ? toAddress(cursor.row, cursor.col)
    : `${toAddress(range.r1, range.c1)}:${toAddress(range.r2, range.c2)}`;
  const barValue = editing ? editing.value : rawAt(cursor);

  if (!ready) {
    return <div className="h-[60vh] animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      <div className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-card shadow-soft">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-1 border-b p-2">
          <Tip label={`${t("sheet.undo")} (Ctrl+Z)`}>
            <Button size="icon-sm" variant="ghost" onClick={undo} disabled={!past.length} aria-label={t("sheet.undo")}>
              <Undo2 />
            </Button>
          </Tip>
          <Tip label={`${t("sheet.redo")} (Ctrl+Y)`}>
            <Button size="icon-sm" variant="ghost" onClick={redo} disabled={!future.length} aria-label={t("sheet.redo")}>
              <Redo2 />
            </Button>
          </Tip>
          <span className="mx-1 h-5 w-px bg-border" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <Rows3 /> {t("sheet.addRow").split(" ")[0]}
                <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={addRow}><Rows3 /> {t("sheet.addRow")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={deleteRows} className="text-destructive focus:text-destructive"><Trash2 /> {t("sheet.deleteRow")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={addColumn}><Columns3 /> {t("sheet.addColumn")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setRename({ col: cursor.col, value: sheet.cells[0]?.[cursor.col] ?? "" })}>
                <PencilLine /> {t("sheet.renameColumn")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={deleteColumns} className="text-destructive focus:text-destructive"><Trash2 /> {t("sheet.deleteColumn")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tip label={t("sheet.format")}>
            <Select
              value={formatOfCursor}
              onChange={(e) => setFormat(e.target.value as ColumnFormat)}
              className="h-8 text-xs"
              aria-label={t("sheet.format")}
            >
              {FORMATS.map((f) => (
                <option key={f} value={f}>
                  {t(`sheet.fmt.${f}` as const)}
                </option>
              ))}
            </Select>
          </Tip>
          <Tip label={t("sheet.sortAsc")}>
            <Button size="icon-sm" variant="ghost" onClick={() => sort("asc")} aria-label={t("sheet.sortAsc")}>
              <ArrowDownAZ />
            </Button>
          </Tip>
          <Tip label={t("sheet.sortDesc")}>
            <Button size="icon-sm" variant="ghost" onClick={() => sort("desc")} aria-label={t("sheet.sortDesc")}>
              <ArrowDownZA />
            </Button>
          </Tip>
          <Tip label={t("sheet.fillDownHint")}>
            <Button size="icon-sm" variant="ghost" onClick={fillDown} disabled={!rawAt(cursor).startsWith("=")} aria-label={t("sheet.fillDown")}>
              <ArrowDownToLine />
            </Button>
          </Tip>

          <div className="relative ml-auto flex items-center">
            <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && nextMatch()}
              placeholder={t("sheet.search")}
              className="h-8 w-36 pl-8 text-xs sm:w-44"
              aria-label={t("sheet.search")}
            />
            {search && (
              <span className="absolute right-2 text-[10px] text-muted-foreground">{matchCount}</span>
            )}
          </div>

          <UploadButton size="sm" variant="ghost" navigate={false} label={t("sheet.import")} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="gradient">
                <Download /> {t("sheet.export")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => exportFile("xlsx")}><FileSpreadsheet /> {t("sheet.exportXlsx")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportFile("csv")}><FileText /> {t("sheet.exportCsv")}</DropdownMenuItem>
              {original && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>{t("sheet.originalKept")}</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => downloadOriginal(original)}><FileDown /> {t("sheet.downloadOriginal")}</DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => { if (window.confirm(t("sheet.confirmReset"))) load(sampleSheet(lang)); }}>
                <RotateCcw /> {t("sheet.reset")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => { if (window.confirm(t("sheet.confirmReset"))) load({ name: "Sheet1", cells: [[""]], formats: [] }); }}>
                <FileSpreadsheet /> {t("sheet.clear")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tip label={t("sheet.assistant")}>
            <Button size="icon-sm" variant="ghost" className="hidden xl:inline-flex" onClick={() => setAssistantOpen((o) => !o)} aria-label={t("sheet.assistant")}>
              {assistantOpen ? <PanelRightClose /> : <PanelRightOpen />}
            </Button>
          </Tip>
        </div>

        {/* Formula bar */}
        <div className="flex items-center gap-2 border-b px-2 py-1.5">
          <span className="w-24 shrink-0 truncate rounded-md border bg-muted/50 px-2 py-1 text-center font-mono text-xs font-semibold">
            {address}
          </span>
          <FunctionSquare className="h-4 w-4 shrink-0 text-violet" />
          <input
            value={barValue}
            onFocus={() => {
              if (!editing) startEdit(cursor, undefined, "bar");
            }}
            onChange={(e) => setEditing((ed) => ({ ...(ed ?? { row: cursor.row, col: cursor.col, source: "bar" as const }), value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (commitEdit()) focusGrid();
              } else if (e.key === "Escape") {
                e.preventDefault();
                cancelEdit();
              }
            }}
            onBlur={() => {
              if (editing?.source === "bar") commitEdit();
            }}
            spellCheck={false}
            aria-label={t("sheet.formulaBar")}
            placeholder={t("sheet.formulaBar")}
            className="h-8 min-w-0 flex-1 rounded-md bg-transparent px-2 font-mono text-sm outline-none focus:bg-muted/50"
          />
        </div>

        {/* Grid */}
        <div
          ref={gridRef}
          tabIndex={0}
          onKeyDown={onGridKeyDown}
          onPaste={onPaste}
          className="scrollbar-thin relative max-h-[62vh] overflow-auto outline-none"
          aria-label={t("sheet.title")}
          role="grid"
        >
          <table className="border-separate border-spacing-0" style={{ width: ROW_HEADER_WIDTH + cols * COL_WIDTH }}>
            <thead>
              <ColumnHeaders
                count={cols}
                selFrom={range.r1 <= 1 && range.r2 >= Math.max(lastData, 1) ? range.c1 : range.c1}
                selTo={range.c2}
                onClick={onColumnClick}
              />
            </thead>
            <tbody>
              {sheet.cells.slice(0, visibleRows).map((raw, r) => {
                const inRows = r >= range.r1 && r <= range.r2;
                return (
                  <GridRow
                    key={r}
                    row={r}
                    raw={raw}
                    values={values[r]}
                    formats={sheet.formats}
                    display={display}
                    selFrom={inRows ? range.c1 : null}
                    selTo={inRows ? range.c2 : null}
                    activeCol={cursor.row === r ? cursor.col : null}
                    editing={editing && editing.source === "cell" && editing.row === r ? { col: editing.col, value: editing.value } : null}
                    matches={(matchMap.get(r) ?? []).join(",")}
                    refCols={(refMap.get(r) ?? []).join(",")}
                    flashCol={flash?.row === r ? flash.col : null}
                    onCellMouseDown={onCellMouseDown}
                    onCellMouseEnter={onCellMouseEnter}
                    onCellDoubleClick={onCellDoubleClick}
                    onRowHeaderClick={onRowHeaderClick}
                    onEditChange={onEditChange}
                    onEditKeyDown={onEditKeyDown}
                    onEditBlur={onEditBlur}
                  />
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th
                  className="sticky bottom-0 left-0 z-20 border-r border-t bg-[hsl(var(--grid-header))] text-[10px] font-semibold text-primary"
                  style={{ width: ROW_HEADER_WIDTH }}
                >
                  <Sigma className="mx-auto h-3.5 w-3.5" />
                </th>
                {totals.map((v, c) => (
                  <td
                    key={c}
                    className="sticky bottom-0 z-10 h-8 truncate border-r border-t bg-[hsl(var(--grid-header))] px-2 text-right text-[13px] font-semibold tabular-nums text-primary"
                    style={{ width: COL_WIDTH, maxWidth: COL_WIDTH }}
                  >
                    {v === null ? "" : totalsMode === "count" ? v : formatValue(v, sheet.formats[c] === "date" ? "number" : sheet.formats[c], display)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
          {rows > visibleRows && (
            <div className="sticky left-0 p-3">
              <Button size="sm" variant="outline" onClick={() => setVisibleRows((v) => v + PAGE)}>
                +{Math.min(PAGE, rows - visibleRows)} ({rows - visibleRows})
              </Button>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            <Sigma className="h-3.5 w-3.5 text-primary" />
            {t("sheet.totals")}:
            <select
              value={totalsMode}
              onChange={(e) => setTotalsMode(e.target.value as typeof totalsMode)}
              className="rounded bg-transparent font-medium text-foreground outline-none"
            >
              <option value="sum">{t("sheet.totalsSum")}</option>
              <option value="avg">{t("sheet.totalsAvg")}</option>
              <option value="count">{t("sheet.totalsCount")}</option>
            </select>
          </label>
          {(range.r1 !== range.r2 || range.c1 !== range.c2) && (
            <span>
              {t("sheet.selection")}: {t("sheet.totalsSum")} <b className="text-foreground">{formatValue(selStats.sum, "number", { ...display, decimals: 2 })}</b>
              {" · "}
              {t("sheet.totalsAvg")} <b className="text-foreground">{formatValue(selStats.avg, "number", { ...display, decimals: 2 })}</b>
              {" · "}
              {t("sheet.totalsCount")} <b className="text-foreground">{selStats.count}</b>
            </span>
          )}
          <span className="ml-auto hidden lg:inline">{t("sheet.help")}</span>
          <span>
            {Math.max(lastData, 0)} × {sheet.cells[0]?.filter((h) => h.trim()).length ?? 0}
          </span>
        </div>
      </div>

      {assistantOpen && (
        <aside className="w-full shrink-0 xl:w-[400px]">
          <AssistantPanel />
        </aside>
      )}

      <Dialog open={!!rename} onOpenChange={(o) => !o && setRename(null)}>
        <DialogContent>
          <DialogTitle>
            {t("sheet.renameColumn")} {rename ? colToLetters(rename.col) : ""}
          </DialogTitle>
          <DialogDescription>{t("sheet.renamePrompt")}</DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!rename) return;
              apply((s) => ops.setCell(s, 0, rename.col, rename.value.trim()));
              setRename(null);
              focusGrid();
            }}
            className="space-y-4"
          >
            <Input autoFocus value={rename?.value ?? ""} onChange={(e) => setRename((r) => (r ? { ...r, value: e.target.value } : r))} maxLength={60} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRename(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit">{t("common.save")}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function SheetNameInput() {
  const t = useT();
  const name = useSheet((s) => s.sheet.name);
  const apply = useSheet((s) => s.apply);
  const ready = useHydrated((s) => s.ready);
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);
  if (!ready) return null;
  return (
    <Input
      value={value}
      aria-label={t("sheet.name")}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value.trim() && value !== name && apply((s) => ({ ...s, name: value.trim().slice(0, 100) }))}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className={cn("h-9 w-48 font-medium")}
    />
  );
}
