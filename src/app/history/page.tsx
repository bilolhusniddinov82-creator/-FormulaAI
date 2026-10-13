"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { History, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tip } from "@/components/ui/tooltip";
import { useHydrated } from "@/components/layout/providers";
import { HistoryCard } from "@/components/generator/recent-list";
import { ConfirmButton } from "@/components/shared/confirm-dialog";
import { EmptyState, PageHeader } from "@/components/shared/page-header";
import { useGenerator } from "@/store/generator-store";
import { useHistory } from "@/store/history-store";
import { useT } from "@/store/settings-store";

export default function HistoryPage() {
  const t = useT();
  const router = useRouter();
  const ready = useHydrated((s) => s.ready);
  const { items, remove, clear } = useHistory();
  const show = useGenerator((s) => s.show);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      [i.prompt, i.result.title, ...i.result.formulas.map((f) => f.formula)].join(" ").toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="container max-w-5xl pb-16">
      <PageHeader
        icon={History}
        title={t("history.title")}
        subtitle={t("history.subtitle")}
        actions={
          items.length > 0 && (
            <ConfirmButton
              variant="outline"
              message={t("history.confirmClear")}
              onConfirm={() => {
                clear();
                toast.success(t("history.cleared"));
              }}
            >
              <Trash2 /> {t("history.clear")}
            </ConfirmButton>
          )
        }
      />

      {!ready ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={History}
          title={t("history.empty")}
          hint={t("history.emptyHint")}
          action={<Button onClick={() => router.push("/formula-generator")}>{t("nav.generator")}</Button>}
        />
      ) : (
        <>
          <div className="relative mb-5">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("history.search")} className="pl-10" />
          </div>
          {filtered.length === 0 ? (
            <EmptyState icon={Search} title={t("library.noResults")} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((item) => (
                <div key={item.id} className="group relative">
                  <HistoryCard
                    item={item}
                    onOpen={() => {
                      show(item);
                      router.push("/formula-generator");
                    }}
                  />
                  <Tip label={t("history.delete")}>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="absolute bottom-3 right-3 opacity-60 hover:text-destructive group-hover:opacity-100"
                      onClick={() => {
                        remove(item.id);
                        toast.success(t("history.deleted"));
                      }}
                      aria-label={t("history.delete")}
                    >
                      <Trash2 />
                    </Button>
                  </Tip>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
