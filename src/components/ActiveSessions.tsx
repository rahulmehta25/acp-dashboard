"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { AcpSession } from "@/types";
import { getAgentTheme } from "@/lib/constants";
import { HexRing } from "./ui/HexRing";
import { SessionCard } from "./SessionCard";

interface ActiveSessionsProps {
  sessions: AcpSession[];
  selectedAgent: string | null;
  compact: boolean;
  onCancel: (id: string) => void;
  onClose: (id: string) => void;
  onSpawn: () => void;
}

export function ActiveSessions({ sessions, selectedAgent, compact, onCancel, onClose, onSpawn }: ActiveSessionsProps) {
  return (
    <div style={{ marginBottom: "40px" }}>
      <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#52525b", letterSpacing: "4px", marginBottom: "16px", textTransform: "uppercase" }}>
        Active Sessions {selectedAgent && <span style={{ color: getAgentTheme(selectedAgent).color }}>/ {selectedAgent.toUpperCase()}</span>}
      </h2>
      <AnimatePresence mode="popLayout">
        {sessions.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(auto-fill, minmax(360px, 1fr))" : "repeat(auto-fill, minmax(420px, 1fr))", gap: "16px" }}>
            {sessions.map((session, i) => (
              <SessionCard
                key={session.key || session.id}
                session={session}
                index={i}
                compact={compact}
                onSteer={() => {}}
                onCancel={onCancel}
                onClose={onClose}
              />
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ padding: "64px", textAlign: "center", background: "rgba(15, 15, 25, 0.4)", border: "1px solid #27272a", borderRadius: "12px" }}
          >
            <motion.div animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 3, repeat: Infinity }}>
              <HexRing color="#222" size={80} />
            </motion.div>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", color: "#333", marginTop: "20px", letterSpacing: "3px" }}>
              NO ACTIVE SESSIONS
            </p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#222", marginTop: "8px" }}>
              {selectedAgent ? `No ${selectedAgent} sessions running` : "Click an agent or use voice to spawn"}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSpawn}
              style={{ marginTop: "20px", background: "rgba(0,212,255,0.08)", border: "1px solid #00d4ff22", borderRadius: "8px", padding: "10px 24px", color: "#00d4ff88", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", letterSpacing: "2px" }}
            >
              + SPAWN AGENT
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
