"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { useT } from "@/store/settings-store";

export function ThemeToggle() {
  const t = useT();
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Tip label={t("theme.toggle")} side="bottom">
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("theme.toggle")}
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        <Sun className="rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
      </Button>
    </Tip>
  );
}
