"use client";

import { useEffect } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { create } from "zustand";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useHistory } from "@/store/history-store";
import { useSettings } from "@/store/settings-store";
import { useSheet } from "@/store/sheet-store";

/** True once persisted stores have been restored from localStorage. */
export const useHydrated = create<{ ready: boolean }>(() => ({ ready: false }));

function StoreHydration() {
  const language = useSettings((s) => s.language);

  useEffect(() => {
    Promise.all([
      useSettings.persist.rehydrate(),
      useHistory.persist.rehydrate(),
      useSheet.persist.rehydrate(),
    ]).finally(() => useHydrated.setState({ ready: true }));
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider>
        <StoreHydration />
        {children}
        <Toaster richColors closeButton position="bottom-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
