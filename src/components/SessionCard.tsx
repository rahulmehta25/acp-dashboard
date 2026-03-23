"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AcpSession } from "@/types";
import { getAgentTheme, STATUS_COLORS } from "@/lib/constants";
import { getElapsed } from "@/lib/utils";
import { HexRing } from "./ui/HexRing";
import { ControlButton } from "./ControlButton";
import { Metric } from "./Metric";
import { TerminalPanel } from "./TerminalPanel";

interface SessionCardProps {
  session: AcpSession;
  index: number;
  compact?: boolean;
  onSteer: (id: string) => void;
  onCancel: (id: string) => void;
  onClose: (id: string) => void;
}

export function SessionCard({
  session,
  index,
  compact = false,
  onSteer,
  onCancel,
  onClose,
}: SessionCardProps) {
  const theme = getAgentTheme(session.agent);
  const statusColor = STATUS_COLORS[session.status] || STATUS_COLORS.unknown;
  const isActive = ["running", "active"].includes(session.status);
  const elapsed = session.elapsed || getElapsed(session.startedAt);
  const [showTerminal, setShowTerminal] = useState(false);
  const [steerInput, setSteerInput] = useState("");
  const [showSteerInput, setShowSteerInput] = useState(false);

  const sessionIdentifier = session.pid ? `pid-${session.pid}` : session.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ delay: index * 0.08, duration: 0.5, ease: "easeOut" }}
      whileHover={{ scale: 1.01, borderColor: `${theme.color}66` }}
      style={{
        background: "rgba(15, 15, 25, 0.8)",
        border: `1px solid ${theme.color}22`,
        borderRadius: "12px",
        padding: compact ? "16px" : "24px",
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(10px)",
        cursor: "default",
        transition: "border-color 0.3s ease",
      }}
    >
      {/* Top glow line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "10%",
          right: "10%",
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${theme.color}88, transparent)`,
        }}
      />

      {/* Animated side accent for active sessions */}
      {isActive && (
        <motion.div
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            position: "absolute",
            left: 0,
            top: "20%",
            bottom: "20%",
            width: "2px",
            background: theme.color,
            borderRadius: "1px",
          }}
        />
      )}

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: compact ? "12px" : "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ position: "relative" }}>
            <HexRing color={theme.color} size={compact ? 40 : 48} pulse={isActive} />
            <span
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                fontSize: compact ? "14px" : "18px",
              }}
            >
              {theme.icon}
            </span>
          </div>
          <div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: compact ? "13px" : "16px",
                fontWeight: 600,
                color: theme.color,
                textTransform: "uppercase",
                letterSpacing: "2px",
              }}
            >
              {theme.label}
            </div>
            <div
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10px",
                color: "#444",
                marginTop: "2px",
              }}
            >
              {session.mode.toUpperCase()} MODE
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <motion.div
            animate={isActive ? { opacity: [1, 0.3, 1] } : {}}
            transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: statusColor,
              boxShadow: `0 0 8px ${statusColor}`,
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              color: statusColor,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {session.status}
          </span>
        </div>
      </div>

      {/* Task */}
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: "13px",
          color: "#999",
          lineHeight: "1.6",
          marginBottom: "16px",
          padding: "12px",
          background: "rgba(0,0,0,0.3)",
          borderRadius: "8px",
          borderLeft: `2px solid ${theme.color}33`,
          maxHeight: compact ? "40px" : "60px",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {session.task || "No task description"}
      </div>

      {/* Session Controls */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <ControlButton
          label="STEER"
          color="#00d4ff"
          onClick={() => setShowSteerInput(!showSteerInput)}
        />
        <ControlButton
          label="TERMINAL"
          color="#4ecdc4"
          onClick={() => setShowTerminal(!showTerminal)}
        />
        {isActive && (
          <ControlButton
            label="CANCEL"
            color="#f9c74f"
            onClick={() => onCancel(sessionIdentifier)}
          />
        )}
        <ControlButton
          label="CLOSE"
          color="#ff6b6b"
          onClick={() => onClose(sessionIdentifier)}
        />
      </div>

      {/* Steer Input */}
      <AnimatePresence>
        {showSteerInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginBottom: "12px" }}
          >
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                value={steerInput}
                onChange={(e) => setSteerInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && steerInput.trim()) {
                    onSteer(sessionIdentifier);
                    fetch(`/api/sessions/${encodeURIComponent(sessionIdentifier)}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ instruction: steerInput }),
                    });
                    setSteerInput("");
                    setShowSteerInput(false);
                  }
                }}
                placeholder="Enter new instructions..."
                style={{
                  flex: 1,
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid #00d4ff22",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#ccc",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  outline: "none",
                }}
              />
              <button
                onClick={() => {
                  if (steerInput.trim()) {
                    fetch(`/api/sessions/${encodeURIComponent(sessionIdentifier)}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ instruction: steerInput }),
                    });
                    setSteerInput("");
                    setShowSteerInput(false);
                  }
                }}
                style={{
                  background: "rgba(0,212,255,0.1)",
                  border: "1px solid #00d4ff33",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  color: "#00d4ff",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "1px",
                }}
              >
                SEND
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer metrics */}
      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
        <Metric label="ELAPSED" value={elapsed} color={theme.color} />
        <Metric label="SESSION" value={session.key.split(":").pop()?.slice(0, 8) || "--"} color="#555" />
        {session.thread && <Metric label="THREAD" value="BOUND" color="#00ff88" />}
        {session.pid && <Metric label="PID" value={session.pid} color="#444" />}
      </div>

      {/* Terminal Output */}
      <AnimatePresence>
        {showTerminal && (
          <TerminalPanel
            sessionId={sessionIdentifier}
            agentColor={theme.color}
            onClose={() => setShowTerminal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
