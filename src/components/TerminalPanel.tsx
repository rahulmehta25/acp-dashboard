"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { StreamLine } from "@/types";

interface TerminalPanelProps {
  sessionId: string;
  agentColor: string;
  onClose: () => void;
}

export function TerminalPanel({ sessionId, agentColor, onClose }: TerminalPanelProps) {
  const [lines, setLines] = useState<StreamLine[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/stream/${encodeURIComponent(sessionId)}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          setConnected(true);
        } else if (data.type !== "heartbeat") {
          setLines((prev) => [...prev.slice(-200), data]);
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
    };
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 200 }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        marginTop: "12px",
        background: "rgba(0, 0, 0, 0.6)",
        border: `1px solid ${agentColor}22`,
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 12px",
        background: "rgba(0, 0, 0, 0.4)",
        borderBottom: `1px solid ${agentColor}11`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: connected ? "#00ff88" : "#ff6b6b",
            boxShadow: connected ? "0 0 6px #00ff88" : "0 0 6px #ff6b6b",
          }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#444", letterSpacing: "1px" }}>
            TERMINAL OUTPUT
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", color: "#444",
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
          }}
        >
          CLOSE
        </button>
      </div>
      <div
        ref={scrollRef}
        style={{
          height: "168px",
          overflowY: "auto",
          padding: "8px 12px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "11px",
          lineHeight: "1.6",
        }}
      >
        {lines.length === 0 ? (
          <span style={{ color: "#333" }}>Waiting for output...</span>
        ) : (
          lines.map((line, i) => (
            <div key={i} style={{
              color: line.type === "error" ? "#ff6b6b" : line.type === "info" ? "#00d4ff" : line.type === "stats" ? "#444" : "#888",
            }}>
              <span style={{ color: "#222", marginRight: "8px" }}>
                {new Date(line.timestamp).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              {line.line || line.data || ""}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
