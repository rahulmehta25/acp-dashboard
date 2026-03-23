"use client";

import { motion } from "framer-motion";
import type { SystemVitals } from "@/types";

interface SystemVitalsBarProps {
  vitals: SystemVitals | null;
}

export function SystemVitalsBar({ vitals }: SystemVitalsBarProps) {
  if (!vitals) return null;

  const bars = [
    { label: "CPU", value: vitals.cpu.usage, color: vitals.cpu.usage > 80 ? "#ff6b6b" : vitals.cpu.usage > 50 ? "#f9c74f" : "#00ff88" },
    { label: "MEM", value: vitals.memory.usage, color: vitals.memory.usage > 80 ? "#ff6b6b" : vitals.memory.usage > 60 ? "#f9c74f" : "#00d4ff" },
    { label: "DISK", value: vitals.disk.usage, color: vitals.disk.usage > 90 ? "#ff6b6b" : vitals.disk.usage > 70 ? "#f9c74f" : "#4ecdc4" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      style={{
        display: "flex",
        gap: "24px",
        padding: "12px 28px",
        background: "rgba(15, 15, 25, 0.4)",
        border: "1px solid #27272a",
        borderRadius: "8px",
        marginBottom: "16px",
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#333", letterSpacing: "2px" }}>
        SYSTEM
      </span>
      {bars.map((bar) => (
        <div key={bar.label} style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: "120px" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#444", letterSpacing: "1px", width: "32px" }}>
            {bar.label}
          </span>
          <div style={{ flex: 1, height: "4px", background: "#111", borderRadius: "2px", minWidth: "60px", position: "relative", overflow: "hidden" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${bar.value}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{
                height: "100%",
                background: bar.color,
                borderRadius: "2px",
                boxShadow: `0 0 6px ${bar.color}66`,
              }}
            />
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: bar.color, minWidth: "30px" }}>
            {bar.value}%
          </span>
        </div>
      ))}
      <div style={{ display: "flex", gap: "16px", marginLeft: "auto" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#333" }}>
          LOAD {vitals.load.avg1}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#333" }}>
          UP {vitals.uptime}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: vitals.network ? "#00ff88" : "#ff6b6b" }}>
          NET {vitals.network ? "OK" : "DOWN"}
        </span>
      </div>
    </motion.div>
  );
}
