"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { logoutAction } from "@/actions/auth.actions";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/repositories", label: "All repositories" },
  { href: "/dashboard/repositories/public", label: "My public repositories" },
  { href: "/dashboard/repositories/private", label: "My private repositories" },
  { href: "/public-repositories", label: "Public repositories" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children, username }: { children: React.ReactNode; username: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="app-frame">
      <aside className={open ? "sidebar open" : "sidebar"}>
        <Link href="/" className="brand" style={{ marginBottom: "1rem" }}>
          <span className="brand-mark" aria-hidden="true">R</span>
          Repository
        </Link>
        <p className="sidebar-group">Workspace</p>
        {links.slice(0, 1).map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        <p className="sidebar-group">Repositories</p>
        {links.slice(1, 4).map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        <p className="sidebar-group">Discover</p>
        {links.slice(4).map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} onClick={() => setOpen(false)}>
            {link.label}
          </Link>
        ))}
        <div style={{ marginTop: "auto", display: "grid", gap: "0.6rem" }}>
          <span className="muted">Signed in as {username}</span>
          <form action={logoutAction}>
            <button className="btn" type="submit">Log out</button>
          </form>
        </div>
      </aside>
      <div>
        <div className="content" style={{ display: "flex", justifyContent: "space-between", paddingBottom: 0 }}>
          <button type="button" className="icon-btn mobile-only" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((value) => !value)}>
            {open ? <X size={16} aria-hidden="true" /> : <Menu size={16} aria-hidden="true" />}
          </button>
          <span />
          <ThemeToggle />
        </div>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
