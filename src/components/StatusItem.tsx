"use client";

import { motion } from "framer-motion";

interface StatusItemProps {
  label: string;
  value: string;
  color: string;
  pulse?: boolean;
}

export function StatusItem({ label, value, color, pulse = false }: StatusItemProps) {
  return (
    <div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#333", letterSpacing: "2px", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {pulse && (
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }}
          />
        )}
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color, fontWeight: 500 }}>
          {value}
        </span>
      </div>
    </div>
  );
}
