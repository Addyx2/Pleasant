"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 360, textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 20, margin: 0 }}>Pleasant hit an unexpected error</h1>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Please try again. {error.digest ? `Reference: ${error.digest}` : null}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{ background: "#237670", color: "white", border: 0, borderRadius: 8, padding: "10px 16px", fontWeight: 600, cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
