"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  History,
  Home,
  LayoutTemplate,
  Menu,
  Settings,
  Sparkles,
  Table2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiStatusBadge } from "@/components/shared/ai-status";
import { LanguageSwitcher } from "@/components/shared/language-select";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { useT } from "@/store/settings-store";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n";

const TOOLS: { href: string; label: TranslationKey; desc: TranslationKey; icon: typeof Table2 }[] = [
  { href: "/spreadsheet", label: "nav.spreadsheet", desc: "nav.spreadsheetDesc", icon: Table2 },
  { href: "/templates", label: "nav.templates", desc: "nav.templatesDesc", icon: LayoutTemplate },
  { href: "/formula-library", label: "nav.library", desc: "nav.libraryDesc", icon: BookOpen },
];

const MAIN: { href: string; label: TranslationKey; icon: typeof Home }[] = [
  { href: "/formula-generator", label: "nav.generator", icon: Sparkles },
  { href: "/history", label: "nav.history", icon: History },
  { href: "/settings", label: "nav.settings", icon: Settings },
];

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5">
      <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary via-violet to-pink text-white shadow-glow transition-transform group-hover:rotate-6">
        <span className="font-mono text-sm font-bold">fx</span>
      </span>
      <span className="font-display text-[15px] font-semibold tracking-tight">
        Formula<span className="text-gradient">AI</span>
      </span>
    </Link>
  );
}

export function Navbar() {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const toolsActive = TOOLS.some((x) => isActive(x.href));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const linkClass = (active: boolean) =>
    cn(
      "relative flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all",
      active
        ? "bg-foreground text-background shadow-sm"
        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
    );

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div
        className={cn(
          "glass mx-auto flex h-14 max-w-6xl items-center gap-3 rounded-full pl-3 pr-2 transition-all duration-300",
          scrolled && "shadow-lg",
        )}
      >
        <Logo />

        <nav className="mx-auto hidden items-center gap-0.5 rounded-full bg-foreground/[0.04] p-1 lg:flex">
          <Link href="/" className={linkClass(isActive("/"))}>
            {t("nav.home")}
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger className={cn(linkClass(toolsActive), "outline-none")}>
              {t("nav.tools")}
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-80 rounded-2xl p-2">
              {TOOLS.map(({ href, label, desc, icon: Icon }) => (
                <DropdownMenuItem key={href} asChild className="rounded-xl p-2.5">
                  <Link href={href} className="items-start">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary/15 to-violet/15 text-primary">
                      <Icon />
                    </span>
                    <span className="flex flex-col">
                      <span className="font-medium">{t(label)}</span>
                      <span className="text-xs text-muted-foreground">{t(desc)}</span>
                    </span>
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {MAIN.map(({ href, label }) => (
            <Link key={href} href={href} className={linkClass(isActive(href))}>
              {t(label)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <AiStatusBadge className="hidden sm:inline-flex" />
          <LanguageSwitcher />
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full lg:hidden"
            onClick={() => setOpen((o) => !o)}
            aria-label={t("nav.menu")}
            aria-expanded={open}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <nav className="glass mx-auto mt-2 grid max-w-6xl gap-1 rounded-3xl p-2 animate-fade-up lg:hidden">
          {[{ href: "/", label: "nav.home" as TranslationKey, icon: Home }, ...TOOLS, ...MAIN].map(
            ({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors",
                  isActive(href) ? "bg-foreground text-background" : "hover:bg-foreground/5",
                )}
              >
                <Icon className="h-4 w-4" />
                {t(label)}
              </Link>
            ),
          )}
          <AiStatusBadge className="m-2 w-fit sm:hidden" />
        </nav>
      )}
    </header>
  );
}
