"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="shell" style={{ padding: "4rem 0" }}>
      <h1>Something went wrong</h1>
      <p className="muted">Please try again. If this keeps happening, check your connection and try later.</p>
      <button className="btn" type="button" onClick={reset}>Try again</button>
    </main>
  );
}
