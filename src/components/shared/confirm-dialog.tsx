"use client";

import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useT } from "@/store/settings-store";

/** Button that asks for confirmation in a dialog before running `onConfirm`. */
export function ConfirmButton({
  message,
  onConfirm,
  children,
  confirmVariant = "destructive",
  ...props
}: {
  message: string;
  onConfirm: () => void;
  confirmVariant?: ButtonProps["variant"];
} & ButtonProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button {...props} onClick={() => setOpen(true)}>
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{t("common.confirm")}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant={confirmVariant}
              onClick={() => {
                setOpen(false);
                onConfirm();
              }}
            >
              {t("common.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
