"use client";

import { motion } from "framer-motion";
import type { AcpSession } from "@/types";
import { getAgentTheme, STATUS_COLORS } from "@/lib/constants";
import { getElapsed } from "@/lib/utils";
import DiffViewer from "./DiffViewer";

interface HistoryRowProps {
  session: AcpSession;
  index: number;
}

export function HistoryRow({ session, index }: HistoryRowProps) {
  const theme = getAgentTheme(session.agent);
  const statusColor = STATUS_COLORS[session.status] || STATUS_COLORS.unknown;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "12px 16px",
        background: "rgba(15,15,25,0.4)",
        borderRadius: "8px",
        borderLeft: `2px solid ${statusColor}44`,
      }}
    >
      <span style={{ fontSize: "16px" }}>{theme.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: theme.color, textTransform: "uppercase", letterSpacing: "1px" }}>
            {session.agent}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: statusColor }}>
            {session.status.toUpperCase()}
          </span>
        </div>
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#555", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
          {session.task || "No description"}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {["completed", "done"].includes(session.status) && (
          <DiffViewer sessionId={session.id} agentColor={theme.color} />
        )}
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#3f3f46" }}>
          {session.elapsed || getElapsed(session.startedAt)}
        </div>
      </div>
    </motion.div>
  );
}
