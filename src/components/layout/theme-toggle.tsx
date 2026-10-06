"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => undefined;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const current = mounted ? theme : "dark";
  const next = current === "dark" ? "light" : current === "light" ? "system" : "dark";
  const label = current === "light" ? "Light theme" : current === "system" ? "System theme" : "Dark theme";
  const Icon = current === "light" ? Sun : current === "system" ? Monitor : Moon;

  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} onClick={() => setTheme(next)}>
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
