"use client";

import { localizeFormula } from "@/lib/formula";
import { cn } from "@/lib/utils";
import { useFormulaStyle } from "@/store/settings-store";

/** Formula text in the user's preferred style (Russian names / semicolons), with light syntax colouring. */
export function useLocalizedFormula() {
  const style = useFormulaStyle();
  return (formula: string) => localizeFormula(formula, style);
}

export function FormulaCode({ formula, className }: { formula: string; className?: string }) {
  const localize = useLocalizedFormula();
  const text = localize(formula);
  const parts = text.split(/("(?:[^"]|"")*")/g);
  return (
    <code className={cn("break-all font-mono text-sm", className)}>
      {parts.map((part, i) =>
        part.startsWith('"') ? (
          <span key={i} className="text-success">
            {part}
          </span>
        ) : (
          part.split(/(\$?[A-Z]{1,3}\$?\d+)/g).map((seg, j) =>
            /^\$?[A-Z]{1,3}\$?\d+$/.test(seg) ? (
              <span key={`${i}-${j}`} className="font-semibold text-primary">
                {seg}
              </span>
            ) : (
              <span key={`${i}-${j}`}>{seg}</span>
            ),
          )
        ),
      )}
    </code>
  );
}
