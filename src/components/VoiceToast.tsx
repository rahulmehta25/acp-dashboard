"use client";

import { motion } from "framer-motion";

interface VoiceToastProps {
  message: string;
  type: "info" | "success" | "error";
}

export function VoiceToast({ message, type }: VoiceToastProps) {
  const colors = { info: "#00d4ff", success: "#00ff88", error: "#ff6b6b" };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: -20, x: "-50%" }}
      style={{
        position: "fixed",
        bottom: "80px",
        left: "50%",
        background: "rgba(10, 10, 18, 0.95)",
        border: `1px solid ${colors[type]}33`,
        borderRadius: "12px",
        padding: "12px 24px",
        zIndex: 300,
        backdropFilter: "blur(20px)",
        boxShadow: `0 10px 40px rgba(0,0,0,0.4), 0 0 20px ${colors[type]}11`,
      }}
    >
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "12px",
        color: colors[type],
        letterSpacing: "1px",
      }}>
        {message}
      </span>
    </motion.div>
  );
}
