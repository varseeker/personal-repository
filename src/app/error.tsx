"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="shell" style={{ padding: "4rem 0" }}>
      <h1>Something went wrong</h1>
      <p className="muted">The page could not be loaded. Try again, or go back home.</p>
      <div className="inline-actions">
        <button className="btn btn-primary" type="button" onClick={reset}>Try again</button>
        <Link className="btn" href="/">Back home</Link>
      </div>
    </main>
  );
}
