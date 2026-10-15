"use client";

import { useRef, type ComponentProps } from "react";
import { DialogContent } from "@/components/ui/dialog";

/** These dialogs open from workspace actions rather than Radix DialogTrigger. */
export function StudentDialogContent({
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: ComponentProps<typeof DialogContent>) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <DialogContent
      {...props}
      onOpenAutoFocus={(event) => {
        const active = document.activeElement;
        opener.current = active instanceof HTMLElement && active !== document.body && !active.closest('[role="dialog"]') ? active : null;
        onOpenAutoFocus?.(event);
      }}
      onCloseAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        if (!event.defaultPrevented && opener.current?.isConnected && opener.current.getClientRects().length) {
          event.preventDefault();
          opener.current.focus({ preventScroll: true });
        }
      }}
    />
  );
}
