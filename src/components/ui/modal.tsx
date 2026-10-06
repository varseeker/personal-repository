"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export function Modal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const onCloseRef = useRef(onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("input, textarea, select")?.focus();

    const armFrame = window.requestAnimationFrame(() => {
      readyRef.current = true;
    });

    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCloseRef.current();
    }

    document.addEventListener("keydown", onKey);
    return () => {
      readyRef.current = false;
      window.cancelAnimationFrame(armFrame);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (!readyRef.current || event.target !== event.currentTarget) return;
        onCloseRef.current();
      }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true" ref={panelRef} onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
