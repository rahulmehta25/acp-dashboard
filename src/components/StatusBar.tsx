"use client";

import { motion } from "framer-motion";
import type { DashboardData } from "@/types";
import { getAgentTheme } from "@/lib/constants";
import { CornerBrackets } from "./ui/CornerBrackets";
import { StatusItem } from "./StatusItem";

interface StatusBarProps {
  data: DashboardData | null;
  sseConnected: boolean;
  lastUpdate: string;
  error: string | null;
}

export function StatusBar({ data, sseConnected, lastUpdate, error }: StatusBarProps) {
  const gatewayColor = data?.gateway.status === "online" ? "#00ff88" : data?.gateway.status === "degraded" ? "#f9c74f" : "#ff6b6b";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
      <CornerBrackets>
        <div style={{ display: "flex", gap: "clamp(12px, 2vw, 32px)", padding: "clamp(12px, 2vw, 20px) clamp(16px, 2vw, 28px)", background: "rgba(15, 15, 25, 0.6)", border: "1px solid #27272a", borderRadius: "12px", marginBottom: "32px", backdropFilter: "blur(10px)", flexWrap: "wrap" }}>
          <StatusItem label="GATEWAY" value={data?.gateway.status?.toUpperCase() || "CHECKING..."} color={gatewayColor} pulse={data?.gateway.status === "online"} />
          {data?.gateway.pid && <StatusItem label="PID" value={data.gateway.pid} color="#444" />}
          <StatusItem label="ACTIVE SESSIONS" value={`${data?.sessions.length || 0} / ${data?.config.maxConcurrent || 8}`} color={data?.sessions.length ? "#00d4ff" : "#444"} />
          <StatusItem label="DEFAULT AGENT" value={(data?.config.defaultAgent || "codex").toUpperCase()} color={getAgentTheme(data?.config.defaultAgent || "codex").color} />
          <StatusItem label="BACKEND" value={(data?.config.backend || "acpx").toUpperCase()} color="#555" />
          <StatusItem label="TTL" value={`${data?.config.ttlMinutes || 120}m`} color="#555" />
          <StatusItem label="DISPATCH" value={data?.config.dispatchEnabled ? "ON" : "OFF"} color={data?.config.dispatchEnabled ? "#00ff88" : "#ff6b6b"} />
          <StatusItem label="FEED" value={sseConnected ? "SSE LIVE" : "POLLING"} color={sseConnected ? "#00ff88" : "#f9c74f"} pulse={sseConnected} />
          <StatusItem label="LAST SYNC" value={lastUpdate || "--:--:--"} color="#333" />
          {error && <StatusItem label="ERROR" value="FETCH FAILED" color="#ff6b6b" />}
        </div>
      </CornerBrackets>
    </motion.div>
  );
}
