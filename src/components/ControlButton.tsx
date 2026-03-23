"use client";

import { motion } from "framer-motion";

interface ControlButtonProps {
  label: string;
  color: string;
  onClick: () => void;
}

export function ControlButton({ label, color, onClick }: ControlButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05, borderColor: `${color}66` }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        background: `${color}08`,
        border: `1px solid ${color}22`,
        borderRadius: "6px",
        padding: "4px 10px",
        color: `${color}cc`,
        cursor: "pointer",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "9px",
        letterSpacing: "1px",
        transition: "all 0.2s ease",
      }}
    >
      {label}
    </motion.button>
  );
}
