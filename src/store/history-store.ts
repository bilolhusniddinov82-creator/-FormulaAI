"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HistoryItem } from "@/lib/types";

const MAX_ITEMS = 100;

interface HistoryState {
  items: HistoryItem[];
  add: (item: Omit<HistoryItem, "id" | "createdAt">) => HistoryItem;
  remove: (id: string) => void;
  clear: () => void;
}

export const useHistory = create<HistoryState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => {
        const full: HistoryItem = {
          ...item,
          id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()),
          createdAt: Date.now(),
        };
        set((s) => ({ items: [full, ...s.items].slice(0, MAX_ITEMS) }));
        return full;
      },
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      clear: () => set({ items: [] }),
    }),
    { name: "formulaai-history", skipHydration: true },
  ),
);
