"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "sans-serif", background: "#10120f", color: "#f4f1e8" }}>
        <main style={{ width: "min(32rem, calc(100% - 2rem))" }}>
          <h1 style={{ marginBottom: "0.5rem" }}>Something went wrong</h1>
          <p style={{ color: "#b7b1a4" }}>The page could not be loaded. Try again in a moment.</p>
          <button type="button" onClick={reset} style={{ marginTop: "1rem", padding: "0.7rem 1rem", borderRadius: "0.7rem", border: 0, background: "#e0b06a", color: "#21180c" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
