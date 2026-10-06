import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell" style={{ padding: "4rem 0" }}>
      <h1>Page not found</h1>
      <p className="muted">That page is unavailable, or you do not have access to it.</p>
      <Link className="btn" href="/">Back home</Link>
    </main>
  );
}
