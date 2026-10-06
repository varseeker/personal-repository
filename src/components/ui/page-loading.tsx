export function PageLoading() {
  return (
    <div className="page-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p>Loading…</p>
    </div>
  );
}
