"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { dashboardNav, isNavActive } from "@/components/layout/nav-items";
import type { Profile } from "@/types/user";

export function SiteHeader({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;

  return (
    <header className="site-header">
      <div className="shell topbar">
        <Link href={profile ? "/dashboard" : "/"} className="brand" onClick={() => setOpenPath(null)}>
          <span className="brand-mark" aria-hidden="true">R</span>
          <span className="brand-label">Personal Repository</span>
        </Link>
        <nav className="nav-links" aria-label="Primary">
          {profile ? dashboardNav.map((item) => (
            <Link key={item.href} href={item.href} aria-current={isNavActive(pathname, item) ? "page" : undefined}>
              {item.shortLabel}
            </Link>
          )) : (
            <Link href="/public-repositories" aria-current={pathname.startsWith("/public-repositories") ? "page" : undefined}>
              Public repositories
            </Link>
          )}
        </nav>
        <div className="inline-actions">
          <button
            type="button"
            className="icon-btn nav-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpenPath(open ? null : pathname)}
          >
            {open ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
          </button>
          <ThemeToggle />
          {profile ? (
            <Link className="btn btn-primary" href="/dashboard">Dashboard</Link>
          ) : (
            <>
              <Link className="btn hide-sm" href="/login">Log in</Link>
              <Link className="btn btn-primary" href="/register">Get started</Link>
            </>
          )}
        </div>
      </div>
      {open ? (
        <nav className="mobile-nav shell" aria-label="Mobile">
          {profile ? dashboardNav.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isNavActive(pathname, item) ? "page" : undefined}
                onClick={() => setOpenPath(null)}
              >
                <Icon size={16} aria-hidden="true" />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </Link>
            );
          }) : (
            <>
              <Link href="/public-repositories" onClick={() => setOpenPath(null)}>Public repositories</Link>
              <Link href="/login" onClick={() => setOpenPath(null)}>Log in</Link>
              <Link href="/register" onClick={() => setOpenPath(null)}>Create account</Link>
            </>
          )}
        </nav>
      ) : null}
    </header>
  );
}
