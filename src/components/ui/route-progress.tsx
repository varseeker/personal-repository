"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function RouteProgress() {
  const pathname = usePathname();
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const active = pendingFrom !== null && pendingFrom === pathname;

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || anchor.getAttribute("target") === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setPendingFrom(window.location.pathname);
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  if (!active) return null;
  return <div className="route-progress" role="status" aria-label="Loading" />;
}
