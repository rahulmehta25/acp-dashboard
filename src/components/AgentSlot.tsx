"use client";

import { motion } from "framer-motion";
import { getAgentTheme } from "@/lib/constants";
import { HexRing } from "./ui/HexRing";

interface AgentSlotProps {
  name: string;
  isActive: boolean;
  sessionCount: number;
  onClick?: () => void;
  onSpawn?: () => void;
}

export function AgentSlot({
  name,
  isActive,
  sessionCount,
  onClick,
  onSpawn,
}: AgentSlotProps) {
  const theme = getAgentTheme(name);
  return (
    <motion.div
      whileHover={{ scale: 1.05, borderColor: `${theme.color}44` }}
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
        padding: "16px 12px",
        background: isActive ? `${theme.color}08` : "rgba(15,15,25,0.5)",
        border: `1px solid ${isActive ? theme.color + "33" : "#27272a"}`,
        borderRadius: "12px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.3s ease",
        position: "relative",
      }}
    >
      {/* Session count badge */}
      {sessionCount > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            background: theme.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "10px",
            fontWeight: 700,
            color: "#0a0a0f",
          }}
        >
          {sessionCount}
        </motion.div>
      )}

      <div style={{ position: "relative" }}>
        <HexRing color={isActive ? theme.color : "#333"} size={56} pulse={isActive} />
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "20px",
            opacity: isActive ? 1 : 0.4,
          }}
        >
          {theme.icon}
        </span>
      </div>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px",
          color: isActive ? theme.color : "#444",
          textTransform: "uppercase",
          letterSpacing: "2px",
        }}
      >
        {name}
      </span>
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "9px",
          color: isActive ? "#00ff88" : "#333",
        }}
      >
        {isActive ? "● ACTIVE" : "○ STANDBY"}
      </span>

      {/* Spawn button */}
      <motion.button
        whileHover={{ scale: 1.1, background: `${theme.color}22` }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation();
          onSpawn?.();
        }}
        style={{
          marginTop: "4px",
          background: `${theme.color}0a`,
          border: `1px solid ${theme.color}22`,
          borderRadius: "6px",
          padding: "4px 12px",
          color: `${theme.color}99`,
          cursor: "pointer",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "8px",
          letterSpacing: "2px",
          transition: "all 0.2s ease",
        }}
      >
        + SPAWN
      </motion.button>
    </motion.div>
  );
}
