"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tip } from "@/components/ui/tooltip";
import { useT } from "@/store/settings-store";

async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  // Fallback for non-secure contexts
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  const ok = document.execCommand("copy");
  ta.remove();
  if (!ok) throw new Error("copy failed");
}

export function CopyButton({
  text,
  label,
  successMessage,
  showLabel = false,
  ...props
}: { text: string; label?: string; successMessage?: string; showLabel?: boolean } & ButtonProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const title = label ?? t("result.copy");

  const copy = async () => {
    try {
      await writeClipboard(text);
      setCopied(true);
      toast.success(successMessage ?? t("result.copied"), { description: text.length < 120 ? text : undefined });
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("common.copyFailed"));
    }
  };

  const button = (
    <Button variant="outline" size={showLabel ? "sm" : "icon-sm"} onClick={copy} aria-label={title} {...props}>
      {copied ? <Check className="text-success" /> : <Copy />}
      {showLabel && (copied ? t("common.copied") : t("common.copy"))}
    </Button>
  );
  return showLabel ? button : <Tip label={title}>{button}</Tip>;
}
