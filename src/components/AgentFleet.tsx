"use client";

import { motion } from "framer-motion";
import { AgentSlot } from "./AgentSlot";

interface AgentFleetProps {
  allAgents: string[];
  activeAgents: Map<string, number>;
  selectedAgent: string | null;
  onSelectAgent: (agent: string | null) => void;
  onSpawn: (agent?: string) => void;
}

export function AgentFleet({ allAgents, activeAgents, selectedAgent, onSelectAgent, onSpawn }: AgentFleetProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} style={{ marginBottom: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#52525b", letterSpacing: "4px", margin: 0, textTransform: "uppercase" }}>Agent Fleet</h2>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {selectedAgent && (
            <button
              onClick={() => onSelectAgent(null)}
              style={{ background: "none", border: "1px solid #333", borderRadius: "6px", padding: "4px 12px", color: "#666", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}
            >
              SHOW ALL
            </button>
          )}
          <motion.button
            whileHover={{ scale: 1.05, borderColor: "#00d4ff44" }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSpawn()}
            style={{ background: "rgba(0,212,255,0.08)", border: "1px solid #00d4ff22", borderRadius: "6px", padding: "6px 14px", color: "#00d4ff", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "2px", transition: "all 0.2s ease" }}
          >
            + SPAWN NEW
          </motion.button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "12px" }}>
        {allAgents.map((agent) => (
          <AgentSlot
            key={agent}
            name={agent}
            isActive={activeAgents.has(agent)}
            sessionCount={activeAgents.get(agent) || 0}
            onClick={() => onSelectAgent(selectedAgent === agent ? null : agent)}
            onSpawn={() => onSpawn(agent)}
          />
        ))}
      </div>
    </motion.div>
  );
}
