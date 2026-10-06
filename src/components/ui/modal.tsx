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
    if (!dialog.open) dialog.showModal();
    function handleClose() {
      if (!ignoreClose) onCloseRef.current();
    }
    dialog.addEventListener("close", handleClose);
    return () => {
      ignoreClose = true;
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      {children}
    </dialog>
  );
}
