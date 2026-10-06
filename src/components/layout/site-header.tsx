import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { Profile } from "@/types/user";

export function SiteHeader({ profile }: { profile: Profile | null }) {
  return (
    <header className="shell topbar">
      <Link href="/" className="brand">
        <span className="brand-mark" aria-hidden="true">R</span>
        Personal Repository
      </Link>
      <nav className="nav-links" aria-label="Primary">
        <Link href="/public-repositories">Public repositories</Link>
        {profile ? <Link href="/dashboard">Dashboard</Link> : <Link href="/login">Log in</Link>}
      </nav>
      <div className="inline-actions">
        <ThemeToggle />
        {profile ? (
          <Link className="btn btn-primary" href="/dashboard">Open dashboard</Link>
        ) : (
          <Link className="btn btn-primary" href="/register">Get started</Link>
        )}
      </div>
    </header>
  );
}
