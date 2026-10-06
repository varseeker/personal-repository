"use client";

import { useEffect, useRef } from "react";

export function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    let ignoreClose = false;
    let acceptBackdrop = false;
    if (!dialog.open) dialog.showModal();
    const armBackdrop = () => { acceptBackdrop = true; };
    const armTimer = window.setTimeout(armBackdrop, 250);
    window.addEventListener("pointerup", armBackdrop, { once: true });
    function handleClose() {
      if (!ignoreClose) onCloseRef.current();
    }
    function handleClick(event: MouseEvent) {
      if (!acceptBackdrop) return;
      if (event.target === dialog) onCloseRef.current();
    }
    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("click", handleClick);
    return () => {
      ignoreClose = true;
      window.clearTimeout(armTimer);
      window.removeEventListener("pointerup", armBackdrop);
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("click", handleClick);
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog ref={ref}>
      {children}
    </dialog>
  );
}
