"use client";

import { motion } from "framer-motion";
import type { AcpSession, DashboardConfig } from "@/types";
import { HistoryRow } from "./HistoryRow";

interface SessionHistoryProps {
  history: AcpSession[];
  config: DashboardConfig | null;
}

export function SessionHistory({ history, config }: SessionHistoryProps) {
  if (config?.display.showHistory === false || history.length === 0) {
    return null;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
      <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#52525b", letterSpacing: "4px", marginBottom: "16px", textTransform: "uppercase" }}>
        Recent History
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {history.slice(0, config?.display.historyLimit ?? 10).map((session, i) => (
          <HistoryRow key={session.key} session={session} index={i} />
        ))}
      </div>
    </motion.div>
  );
}
