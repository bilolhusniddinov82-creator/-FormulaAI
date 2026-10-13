"use client";

import { create } from "zustand";
import { describeSheet } from "@/lib/sheet-ops";
import type { GenerationResponse, HistoryItem, Language, SheetContext } from "@/lib/types";
import { useHistory } from "./history-store";
import { useSheet } from "./sheet-store";

export type GenerateStatus = "idle" | "loading" | "success" | "error";

interface GeneratorState {
  prompt: string;
  status: GenerateStatus;
  response: GenerationResponse | null;
  /** Prompt the current response belongs to. */
  answeredPrompt: string;
  error: string | null;
  setPrompt: (p: string) => void;
  generate: (opts: { prompt: string; language: Language; withSheet: boolean; selectedColumns?: string[] }) => Promise<GenerationResponse | null>;
  show: (item: HistoryItem) => void;
  reset: () => void;
}

export const useGenerator = create<GeneratorState>()((set) => ({
  prompt: "",
  status: "idle",
  response: null,
  answeredPrompt: "",
  error: null,
  setPrompt: (prompt) => set({ prompt }),
  reset: () => set({ prompt: "", status: "idle", response: null, error: null, answeredPrompt: "" }),
  show: (item) =>
    set({
      prompt: item.prompt,
      answeredPrompt: item.prompt,
      status: "success",
      error: null,
      response: { result: item.result, source: item.source },
    }),
  generate: async ({ prompt, language, withSheet, selectedColumns = [] }) => {
    set({ status: "loading", error: null, prompt });
    const context: SheetContext | null = withSheet ? describeSheet(useSheet.getState().sheet, selectedColumns) : null;
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, language, context }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        set({ status: "error", error: data?.error ?? "generic" });
        return null;
      }
      const response = data as GenerationResponse;
      set({ status: "success", response, answeredPrompt: prompt });
      useHistory.getState().add({
        prompt,
        language,
        source: response.source,
        usedSheetContext: Boolean(context),
        result: response.result,
      });
      return response;
    } catch {
      set({ status: "error", error: "network" });
      return null;
    }
  },
}));

