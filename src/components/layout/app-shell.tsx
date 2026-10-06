"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { logoutAction } from "@/actions/auth.actions";
import { SubmitButton } from "@/components/ui/submit-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { dashboardNav, isNavActive } from "@/components/layout/nav-items";

export function AppShell({
  children,
  username,
  displayName,
}: {
  children: React.ReactNode;
  username: string;
  displayName: string;
}) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const current = dashboardNav.find((item) => isNavActive(pathname, item));

  return (
    <div className="app-frame">
      <aside className={open ? "sidebar open" : "sidebar"} id="dashboard-nav">
        <Link href="/dashboard" className="brand sidebar-brand" onClick={() => setOpenPath(null)}>
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>Dashboard</span>
        </Link>
        <nav aria-label="Dashboard">
          <p className="sidebar-group">Your workspace</p>
          {dashboardNav.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-item"
                aria-current={active ? "page" : undefined}
                onClick={() => setOpenPath(null)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-foot">
          <p className="muted" style={{ margin: 0 }}>
            {displayName}
            <br />
            @{username}
          </p>
          <form action={logoutAction}>
            <SubmitButton className="btn" pendingLabel="Logging out…">Log out</SubmitButton>
          </form>
        </div>
      </aside>
      <button
        type="button"
        className={open ? "sidebar-backdrop show" : "sidebar-backdrop"}
        aria-label="Close menu"
        onClick={() => setOpenPath(null)}
      />
      <div className="app-main">
        <header className="app-topbar">
          <button
            type="button"
            className="icon-btn mobile-only"
            aria-label={open ? "Close menu" : "Open dashboard menu"}
            aria-expanded={open}
            aria-controls="dashboard-nav"
            onClick={() => setOpenPath(open ? null : pathname)}
          >
            {open ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
          </button>
          <div className="app-topbar-title">
            <span className="muted">Dashboard</span>
            <strong>{current?.label ?? "Dashboard"}</strong>
          </div>
          <nav className="feature-nav" aria-label="Dashboard features">
            <span className="feature-nav-label">Features</span>
            {dashboardNav.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isNavActive(pathname, item) ? "page" : undefined}>
                {item.shortLabel}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
