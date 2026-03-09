"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard render error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0a0a0f",
        color: "#d8d8d8",
        fontFamily: "'JetBrains Mono', monospace",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "560px",
          width: "100%",
          background: "rgba(15, 15, 25, 0.85)",
          border: "1px solid #1a1a2e",
          borderRadius: "12px",
          padding: "24px",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            color: "#ff6b6b",
            letterSpacing: "2px",
            fontSize: "16px",
          }}
        >
          DASHBOARD ERROR
        </h2>
        <p style={{ color: "#888", lineHeight: 1.6, marginBottom: "18px" }}>
          The dashboard hit an unexpected error. Retry to recover, or refresh the page.
        </p>
        <button
          onClick={reset}
          style={{
            background: "rgba(0, 212, 255, 0.1)",
            border: "1px solid #00d4ff44",
            borderRadius: "8px",
            color: "#00d4ff",
            padding: "10px 16px",
            cursor: "pointer",
            letterSpacing: "1px",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          RETRY
        </button>
      </div>
    </div>
  );
}
