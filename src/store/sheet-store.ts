"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FormulaItem } from "@/lib/ai/schema";
import * as ops from "@/lib/sheet-ops";
import type { OriginalFile } from "@/lib/spreadsheet-io";
import { sampleSheet } from "@/lib/templates";
import type { SheetData } from "@/lib/types";

const MAX_UNDO = 50;

interface SheetState {
  sheet: SheetData;
  /** Uploaded file kept unchanged for "download original" (memory only). */
  original: OriginalFile | null;
  past: SheetData[];
  future: SheetData[];
  /** Cell to select/highlight after navigation (e.g. after inserting a formula). */
  focus: { row: number; col: number; at: number } | null;

  /** Applies a change and records it for undo. */
  apply: (fn: (s: SheetData) => SheetData) => void;
  load: (sheet: SheetData, original?: OriginalFile | null) => void;
  undo: () => void;
  redo: () => void;
  insertFormula: (item: Pick<FormulaItem, "formula" | "targetCell" | "fillDown" | "label">) => ops.InsertResult;
  setFocus: (row: number, col: number) => void;
}

export const useSheet = create<SheetState>()(
  persist(
    (set, get) => ({
      sheet: ops.normalize(sampleSheet("uz")),
      original: null,
      past: [],
      future: [],
      focus: null,

      apply: (fn) => {
        const current = get().sheet;
        const next = fn(current);
        if (next === current) return;
        set((s) => ({ sheet: next, past: [...s.past, current].slice(-MAX_UNDO), future: [] }));
      },
      load: (sheet, original = null) =>
        set((s) => ({
          sheet: ops.normalize(sheet),
          original,
          past: [...s.past, s.sheet].slice(-MAX_UNDO),
          future: [],
          focus: null,
        })),
      undo: () => {
        const { past, sheet, future } = get();
        if (!past.length) return;
        set({ sheet: past[past.length - 1], past: past.slice(0, -1), future: [sheet, ...future] });
      },
      redo: () => {
        const { past, sheet, future } = get();
        if (!future.length) return;
        set({ sheet: future[0], past: [...past, sheet], future: future.slice(1) });
      },
      insertFormula: (item) => {
        const result = ops.insertFormula(get().sheet, item);
        get().apply(() => ops.normalize(result.sheet));
        set({ focus: { row: result.row, col: result.col, at: Date.now() } });
        return result;
      },
      setFocus: (row, col) => set({ focus: { row, col, at: Date.now() } }),
    }),
    {
      name: "formulaai-sheet",
      skipHydration: true,
      partialize: (s) => ({ sheet: s.sheet }),
    },
  ),
);
