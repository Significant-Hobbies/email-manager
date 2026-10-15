export function SessionLoading() {
  return (
    <main className="session-loading" aria-busy="true">
      <h1>Kinetic</h1>
      <p role="status">Checking your session…</p>
    </main>
  );
}

export function SessionError({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="session-loading">
      <h1>Kinetic</h1>
      <p role="alert">Could not check your session. Check your connection and try again.</p>
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    </main>
  );
}
