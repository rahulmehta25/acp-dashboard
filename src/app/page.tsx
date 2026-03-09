"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AgentAnalytics from "@/components/AgentAnalytics";
import FleetHeatmap from "@/components/FleetHeatmap";
import DiffViewer from "@/components/DiffViewer";

// ─── Types ───────────────────────────────────────────────────────────
interface AcpSession {
  id: string;
  key: string;
  agent: string;
  status: string;
  task: string;
  mode: string;
  startedAt: string;
  elapsed: string;
  thread?: string;
  pid?: string;
  cwd?: string;
}

interface GatewayInfo {
  status: string;
  pid: string | null;
  port: number;
  uptime: string | null;
}

interface OpenClawConfig {
  maxConcurrent: number;
  defaultAgent: string;
  allowedAgents: string[];
  ttlMinutes: number;
  backend: string;
  dispatchEnabled: boolean;
}

interface DashboardConfig {
  branding: { title: string; subtitle: string; version: string };
  refresh: { intervalMs: number; sessionHistoryLimit: number };
  notifications: { sound: boolean; onComplete: boolean; onError: boolean; volume: number };
  display: { showHistory: boolean; historyLimit: number; compactMode: boolean };
}

interface DashboardData {
  gateway: GatewayInfo;
  sessions: AcpSession[];
  history: AcpSession[];
  timestamp: string;
  config: OpenClawConfig;
}

interface SystemVitals {
  cpu: { usage: number; cores: number; model: string };
  memory: { usage: number; total: string; used: string; free: string };
  disk: { usage: number; total: string; used: string };
  load: { avg1: string; avg5: string; avg15: string };
  uptime: string;
  network: boolean;
  processes: number;
}

interface StreamLine {
  type: string;
  line?: string;
  data?: string;
  timestamp: string;
}

// ─── Agent Colors & Icons ────────────────────────────────────────────
const AGENT_THEME: Record<string, { color: string; glow: string; icon: string; label: string }> = {
  codex:    { color: "#00d4ff", glow: "0 0 12px rgba(0,212,255,0.2)",   icon: "⚡", label: "Codex" },
  claude:   { color: "#d4a0ff", glow: "0 0 12px rgba(212,160,255,0.2)", icon: "🧠", label: "Claude Code" },
  pi:       { color: "#ff6b6b", glow: "0 0 12px rgba(255,107,107,0.2)", icon: "🔴", label: "Pi" },
  gemini:   { color: "#4ecdc4", glow: "0 0 12px rgba(78,205,196,0.2)",  icon: "💎", label: "Gemini CLI" },
  opencode: { color: "#f9c74f", glow: "0 0 12px rgba(249,199,79,0.2)",  icon: "🔓", label: "OpenCode" },
  amp:      { color: "#ff8c42", glow: "0 0 12px rgba(255,140,66,0.2)",  icon: "⚡", label: "Amp" },
  devin:    { color: "#6c5ce7", glow: "0 0 12px rgba(108,92,231,0.2)",  icon: "🤖", label: "Devin" },
};

const getAgentTheme = (agent: string) =>
  AGENT_THEME[agent] || { color: "#888", glow: "0 0 12px rgba(136,136,136,0.15)", icon: "🤖", label: agent };

const STATUS_COLORS: Record<string, string> = {
  running: "#00ff88", active: "#00ff88",
  idle: "#f9c74f", waiting: "#f9c74f",
  completed: "#4ecdc4", done: "#4ecdc4",
  error: "#ff6b6b", failed: "#ff6b6b",
  cancelled: "#666", unknown: "#444",
};

const RECENT_PROJECTS = [
  "~/Desktop/Projects/acp-dashboard",
  "~/Desktop/Projects/osmoti-backend",
  "~/Desktop/Projects/openclaw-railway",
  "~/Desktop/Projects/rung",
  "~/Desktop/Projects/analytics-pro",
  "~/Desktop/Projects/clipora-mvp-fix",
];

// ─── Sound Effects ───────────────────────────────────────────────────
function useNotificationSound(volume: number) {
  const audioCtxRef = useRef<AudioContext | null>(null);

  const play = useCallback((type: "complete" | "error" | "spawn") => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.value = volume;

      if (type === "complete") {
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
      } else if (type === "error") {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(554, ctx.currentTime + 0.08);
      }

      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.4);
    } catch {
      // Audio not available
    }
  }, [volume]);

  return play;
}

// ─── Elapsed time helper ─────────────────────────────────────────────
function getElapsed(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  if (isNaN(start)) return "--:--";
  const diff = Math.floor((Date.now() - start) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// ─── Hex Ring SVG ────────────────────────────────────────────────────
function HexRing({ color, size = 120, pulse = false }: { color: string; size?: number; pulse?: boolean }) {
  const id = `glow-${color.replace("#", "")}-${size}`;
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      animate={pulse ? { opacity: [0.6, 1, 0.6] } : {}}
      transition={pulse ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
    >
      <defs>
        <filter id={id}>
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polygon
        points="60,5 110,30 110,90 60,115 10,90 10,30"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        opacity="0.6"
        filter={`url(#${id})`}
      />
      <polygon
        points="60,15 100,35 100,85 60,105 20,85 20,35"
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        opacity="0.3"
      />
    </motion.svg>
  );
}

// ─── Scanning Line ───────────────────────────────────────────────────
function ScanLine() {
  return (
    <motion.div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        height: "1px",
        background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.3), transparent)",
        pointerEvents: "none",
      }}
      animate={{ top: ["0%", "100%", "0%"] }}
      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
    />
  );
}

// ─── Grid Background ─────────────────────────────────────────────────
function GridBg() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "40px 40px",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

// ─── Corner Brackets ─────────────────────────────────────────────────
function CornerBrackets({ color = "#00d4ff", children }: { color?: string; children: React.ReactNode }) {
  const bracketStyle = {
    position: "absolute" as const,
    width: "12px",
    height: "12px",
    border: `1px solid ${color}33`,
  };
  return (
    <div style={{ position: "relative", padding: "2px" }}>
      <div style={{ ...bracketStyle, top: 0, left: 0, borderRight: "none", borderBottom: "none" }} />
      <div style={{ ...bracketStyle, top: 0, right: 0, borderLeft: "none", borderBottom: "none" }} />
      <div style={{ ...bracketStyle, bottom: 0, left: 0, borderRight: "none", borderTop: "none" }} />
      <div style={{ ...bracketStyle, bottom: 0, right: 0, borderLeft: "none", borderTop: "none" }} />
      {children}
    </div>
  );
}

// ─── System Vitals Bar ──────────────────────────────────────────────
function SystemVitalsBar({ vitals }: { vitals: SystemVitals | null }) {
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

// ─── Terminal Output Panel ──────────────────────────────────────────
function TerminalPanel({ sessionId, agentColor, onClose }: { sessionId: string; agentColor: string; onClose: () => void }) {
  const [lines, setLines] = useState<StreamLine[]>([]);
  const [connected, setConnected] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/stream/${encodeURIComponent(sessionId)}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          setConnected(true);
        } else if (data.type !== "heartbeat") {
          setLines((prev) => [...prev.slice(-200), data]);
        }
      } catch { /* ignore */ }
    };

    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
    };
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 200 }}
      exit={{ opacity: 0, height: 0 }}
      style={{
        marginTop: "12px",
        background: "rgba(0, 0, 0, 0.6)",
        border: `1px solid ${agentColor}22`,
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "6px 12px",
        background: "rgba(0, 0, 0, 0.4)",
        borderBottom: `1px solid ${agentColor}11`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{
            width: "6px", height: "6px", borderRadius: "50%",
            background: connected ? "#00ff88" : "#ff6b6b",
            boxShadow: connected ? "0 0 6px #00ff88" : "0 0 6px #ff6b6b",
          }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#444", letterSpacing: "1px" }}>
            TERMINAL OUTPUT
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none", border: "none", color: "#444",
            cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px",
          }}
        >
          CLOSE
        </button>
      </div>
      <div
        ref={scrollRef}
        style={{
          height: "168px",
          overflowY: "auto",
          padding: "8px 12px",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "11px",
          lineHeight: "1.6",
        }}
      >
        {lines.length === 0 ? (
          <span style={{ color: "#333" }}>Waiting for output...</span>
        ) : (
          lines.map((line, i) => (
            <div key={i} style={{
              color: line.type === "error" ? "#ff6b6b" : line.type === "info" ? "#00d4ff" : line.type === "stats" ? "#444" : "#888",
            }}>
              <span style={{ color: "#222", marginRight: "8px" }}>
                {new Date(line.timestamp).toLocaleTimeString("en-US", { hour12: false })}
              </span>
              {line.line || line.data || ""}
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

// ─── Session Card ────────────────────────────────────────────────────
function SessionCard({
  session,
  index,
  compact = false,
  onSteer,
  onCancel,
  onClose,
}: {
  session: AcpSession;
  index: number;
  compact?: boolean;
  onSteer: (id: string) => void;
  onCancel: (id: string) => void;
  onClose: (id: string) => void;
}) {
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

function ControlButton({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
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

function Metric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#333", letterSpacing: "2px", marginBottom: "2px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color, fontWeight: 500 }}>
        {value}
      </div>
    </div>
  );
}

// ─── Agent Slot ──────────────────────────────────────────────────────
function AgentSlot({
  name,
  isActive,
  sessionCount,
  onClick,
  onSpawn,
}: {
  name: string;
  isActive: boolean;
  sessionCount: number;
  onClick?: () => void;
  onSpawn?: () => void;
}) {
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

// ─── History Row ─────────────────────────────────────────────────────
function HistoryRow({ session, index }: { session: AcpSession; index: number }) {
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

// ─── Spawn Modal ─────────────────────────────────────────────────────
function SpawnModal({
  preselectedAgent,
  onSpawn,
  onClose,
}: {
  preselectedAgent?: string;
  onSpawn: (agent: string, task: string, mode: string, cwd: string) => void;
  onClose: () => void;
}) {
  const [agent, setAgent] = useState(preselectedAgent || "codex");
  const [task, setTask] = useState("");
  const [mode, setMode] = useState<"one-shot" | "persistent">("persistent");
  const [cwd, setCwd] = useState(RECENT_PROJECTS[0]);
  const [isSpawning, setIsSpawning] = useState(false);
  const theme = getAgentTheme(agent);

  const handleSpawn = async () => {
    if (!task.trim()) return;
    setIsSpawning(true);
    onSpawn(agent, task, mode, cwd);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "520px",
          maxWidth: "95vw",
          background: "rgba(10, 10, 18, 0.98)",
          border: `1px solid ${theme.color}33`,
          borderRadius: "20px",
          padding: "32px",
          boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 20px ${theme.color}08`,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <HexRing color={theme.color} size={40} pulse />
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "14px", color: "#00d4ff", letterSpacing: "3px" }}>
                SPAWN AGENT
              </div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#333", letterSpacing: "2px", marginTop: "4px" }}>
                NEW SESSION CONFIGURATION
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none", border: "1px solid #333", borderRadius: "8px",
              color: "#666", padding: "6px 14px", cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "1px",
            }}
          >
            ESC
          </button>
        </div>

        {/* Agent Picker */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#52525b", letterSpacing: "2px", display: "block", marginBottom: "8px" }}>
            SELECT AGENT
          </label>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {["codex", "claude", "gemini", "pi", "opencode", "amp", "devin"].map((a) => {
              const t = getAgentTheme(a);
              const selected = agent === a;
              return (
                <motion.button
                  key={a}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setAgent(a)}
                  style={{
                    background: selected ? `${t.color}15` : "rgba(0,0,0,0.3)",
                    border: `1px solid ${selected ? t.color + "66" : "#222"}`,
                    borderRadius: "8px",
                    padding: "10px 16px",
                    color: selected ? t.color : "#555",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11px",
                    letterSpacing: "1px",
                    textTransform: "uppercase",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    transition: "all 0.2s ease",
                  }}
                >
                  <span>{t.icon}</span>
                  {a}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Quick Templates */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#52525b", letterSpacing: "2px", display: "block", marginBottom: "8px" }}>
            QUICK TEMPLATES
          </label>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              { label: "Security Audit", task: "Run a comprehensive security audit on this codebase. Check for OWASP top 10 vulnerabilities, insecure dependencies, hardcoded secrets, and injection risks. Provide a report with severity ratings and remediation steps." },
              { label: "Add Tests", task: "Analyze the existing code and add comprehensive test coverage. Write unit tests for core functions and integration tests for API endpoints. Use the project's existing test framework." },
              { label: "Code Review", task: "Perform a thorough code review of recent changes. Check for bugs, performance issues, code style violations, and potential improvements. Provide actionable feedback." },
              { label: "Deploy to Vercel", task: "Prepare and verify the project for Vercel deployment. Check build output, environment variables, and configuration. Run the build process and fix any errors." },
              { label: "Refactor", task: "Identify code that needs refactoring: large files, duplicated logic, complex functions, poor naming. Refactor incrementally while preserving existing behavior. Run tests after each change." },
            ].map((tmpl) => (
              <button
                key={tmpl.label}
                onClick={() => setTask(tmpl.task)}
                style={{
                  background: task === tmpl.task ? `${theme.color}12` : "rgba(0,0,0,0.25)",
                  border: `1px solid ${task === tmpl.task ? theme.color + "44" : "#27272a"}`,
                  borderRadius: "6px",
                  padding: "6px 12px",
                  color: task === tmpl.task ? theme.color : "#71717a",
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                  fontSize: "11px",
                  transition: "all 0.2s ease",
                }}
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>

        {/* Task Input */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#52525b", letterSpacing: "2px", display: "block", marginBottom: "8px" }}>
            TASK DESCRIPTION
          </label>
          <textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Describe what the agent should do..."
            rows={3}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.4)",
              border: `1px solid ${theme.color}22`,
              borderRadius: "8px",
              padding: "12px",
              color: "#ccc",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "12px",
              lineHeight: "1.6",
              outline: "none",
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Mode Toggle */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#52525b", letterSpacing: "2px", display: "block", marginBottom: "8px" }}>
            SESSION MODE
          </label>
          <div style={{ display: "flex", gap: "8px" }}>
            {(["one-shot", "persistent"] as const).map((m) => (
              <motion.button
                key={m}
                whileHover={{ scale: 1.02 }}
                onClick={() => setMode(m)}
                style={{
                  flex: 1,
                  background: mode === m ? `${theme.color}12` : "rgba(0,0,0,0.3)",
                  border: `1px solid ${mode === m ? theme.color + "44" : "#222"}`,
                  borderRadius: "8px",
                  padding: "10px",
                  color: mode === m ? theme.color : "#555",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  transition: "all 0.2s ease",
                }}
              >
                {m}
                <div style={{ fontSize: "8px", color: "#333", marginTop: "4px", letterSpacing: "0.5px", textTransform: "none" }}>
                  {m === "one-shot" ? "Execute once and exit" : "Keep session alive"}
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Working Directory */}
        <div style={{ marginBottom: "24px" }}>
          <label style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#52525b", letterSpacing: "2px", display: "block", marginBottom: "8px" }}>
            WORKING DIRECTORY
          </label>
          <select
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid #222",
              borderRadius: "8px",
              padding: "10px 12px",
              color: "#888",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "11px",
              outline: "none",
              appearance: "none",
              boxSizing: "border-box",
            }}
          >
            {RECENT_PROJECTS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Spawn Button */}
        <motion.button
          whileHover={{ scale: 1.02, boxShadow: `0 0 30px ${theme.color}22` }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSpawn}
          disabled={!task.trim() || isSpawning}
          style={{
            width: "100%",
            padding: "14px",
            background: task.trim() ? `linear-gradient(135deg, ${theme.color}22, ${theme.color}0a)` : "rgba(0,0,0,0.2)",
            border: `1px solid ${task.trim() ? theme.color + "44" : "#222"}`,
            borderRadius: "10px",
            color: task.trim() ? theme.color : "#333",
            cursor: task.trim() ? "pointer" : "not-allowed",
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "13px",
            fontWeight: 600,
            letterSpacing: "3px",
            transition: "all 0.3s ease",
          }}
        >
          {isSpawning ? "SPAWNING..." : `DEPLOY ${agent.toUpperCase()}`}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ─── Voice Orb ──────────────────────────────────────────────────────
function VoiceOrb({
  isListening,
  isSpeaking,
  onClick,
  voiceLevel,
}: {
  isListening: boolean;
  isSpeaking: boolean;
  onClick: () => void;
  voiceLevel: number;
}) {
  const activeColor = isListening ? "#00d4ff" : isSpeaking ? "#00ff88" : "#333";
  const scale = 1 + voiceLevel * 0.3;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      style={{
        position: "relative",
        width: "48px",
        height: "48px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Outer ring */}
      <motion.div
        animate={{
          scale: isListening || isSpeaking ? [1, 1.2, 1] : 1,
          opacity: isListening || isSpeaking ? [0.3, 0.6, 0.3] : 0.2,
        }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: -6,
          borderRadius: "50%",
          border: `1px solid ${activeColor}`,
        }}
      />
      {/* Middle ring */}
      <motion.div
        animate={{
          scale: isListening || isSpeaking ? [1, scale, 1] : 1,
          opacity: isListening || isSpeaking ? [0.4, 0.8, 0.4] : 0.1,
        }}
        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: -2,
          borderRadius: "50%",
          border: `1px solid ${activeColor}`,
        }}
      />
      {/* Core orb */}
      <motion.div
        animate={{
          boxShadow: isListening
            ? [`0 0 20px ${activeColor}44`, `0 0 40px ${activeColor}88`, `0 0 20px ${activeColor}44`]
            : isSpeaking
              ? [`0 0 15px ${activeColor}33`, `0 0 30px ${activeColor}66`, `0 0 15px ${activeColor}33`]
              : `0 0 10px ${activeColor}22`,
        }}
        transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          background: `radial-gradient(circle at 40% 40%, ${activeColor}44, ${activeColor}11)`,
          border: `1.5px solid ${activeColor}66`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Mic / Speaker icon via SVG */}
        {isListening ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        ) : isSpeaking ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2" strokeLinecap="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={activeColor} strokeWidth="2" strokeLinecap="round">
            <rect x="9" y="1" width="6" height="12" rx="3" />
            <path d="M5 10a7 7 0 0 0 14 0" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        )}
      </motion.div>

      {/* Label */}
      <div style={{
        position: "absolute",
        bottom: -16,
        left: "50%",
        transform: "translateX(-50%)",
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "7px",
        color: activeColor,
        letterSpacing: "1px",
        whiteSpace: "nowrap",
      }}>
        {isListening ? "LISTENING" : isSpeaking ? "SPEAKING" : "VOICE"}
      </div>
    </motion.div>
  );
}

// ─── Voice Command Parser ───────────────────────────────────────────
function parseVoiceCommand(transcript: string): { action: string; agent?: string; target?: string } | null {
  const lower = transcript.toLowerCase().trim();

  // "spawn [agent] on [project]"
  const spawnMatch = lower.match(/spawn\s+(codex|claude|gemini|pi|opencode|amp|devin)\s*(?:on|for|in)?\s*(.*)/);
  if (spawnMatch) {
    return { action: "spawn", agent: spawnMatch[1], target: spawnMatch[2] || "" };
  }

  // "cancel [the] [agent] session"
  const cancelMatch = lower.match(/cancel\s+(?:the\s+)?(codex|claude|gemini|pi|opencode|amp|devin)?\s*session/);
  if (cancelMatch) {
    return { action: "cancel", agent: cancelMatch[1] };
  }

  // "close [the] [agent] session"
  const closeMatch = lower.match(/close\s+(?:the\s+)?(codex|claude|gemini|pi|opencode|amp|devin)?\s*session/);
  if (closeMatch) {
    return { action: "close", agent: closeMatch[1] };
  }

  // "status report" or "give me status"
  if (lower.includes("status") && (lower.includes("report") || lower.includes("give") || lower.includes("what"))) {
    return { action: "status" };
  }

  // "show settings" / "open settings"
  if (lower.includes("settings") || lower.includes("config")) {
    return { action: "settings" };
  }

  return null;
}

// ─── Settings Panel ──────────────────────────────────────────────────
function SettingsPanel({
  config,
  onSave,
  onClose,
}: {
  config: DashboardConfig;
  onSave: (cfg: DashboardConfig) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState(config);

  const update = (path: string, value: unknown) => {
    setLocal((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next as Record<string, unknown>;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]] as Record<string, unknown>;
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      style={{
        position: "fixed",
        bottom: "24px",
        right: "24px",
        width: "380px",
        background: "rgba(10, 10, 18, 0.95)",
        border: "1px solid #27272a",
        borderRadius: "16px",
        padding: "24px",
        zIndex: 100,
        backdropFilter: "blur(20px)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color: "#00d4ff", letterSpacing: "2px" }}>
          SETTINGS
        </span>
        <button
          onClick={onClose}
          style={{ background: "none", border: "1px solid #333", borderRadius: "6px", color: "#666", padding: "4px 12px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}
        >
          CLOSE
        </button>
      </div>

      <SettingGroup label="BRANDING">
        <SettingInput label="Title" value={local.branding.title} onChange={(v) => update("branding.title", v)} />
        <SettingInput label="Subtitle" value={local.branding.subtitle} onChange={(v) => update("branding.subtitle", v)} />
      </SettingGroup>

      <SettingGroup label="REFRESH">
        <SettingRange label="Interval" value={local.refresh.intervalMs} min={1000} max={30000} step={1000} unit="ms" onChange={(v) => update("refresh.intervalMs", v)} />
      </SettingGroup>

      <SettingGroup label="NOTIFICATIONS">
        <SettingToggle label="Sound Effects" value={local.notifications.sound} onChange={(v) => update("notifications.sound", v)} />
        <SettingRange label="Volume" value={local.notifications.volume} min={0} max={1} step={0.1} onChange={(v) => update("notifications.volume", v)} />
      </SettingGroup>

      <SettingGroup label="DISPLAY">
        <SettingToggle label="Show History" value={local.display.showHistory} onChange={(v) => update("display.showHistory", v)} />
        <SettingToggle label="Compact Mode" value={local.display.compactMode} onChange={(v) => update("display.compactMode", v)} />
      </SettingGroup>

      <button
        onClick={() => onSave(local)}
        style={{
          width: "100%",
          marginTop: "16px",
          padding: "10px",
          background: "rgba(0,212,255,0.1)",
          border: "1px solid #00d4ff44",
          borderRadius: "8px",
          color: "#00d4ff",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "12px",
          letterSpacing: "2px",
          cursor: "pointer",
        }}
      >
        SAVE CONFIGURATION
      </button>
    </motion.div>
  );
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#333", letterSpacing: "2px", marginBottom: "8px" }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{children}</div>
    </div>
  );
}

function SettingInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#888" }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          background: "rgba(0,0,0,0.4)",
          border: "1px solid #222",
          borderRadius: "4px",
          padding: "4px 8px",
          color: "#ccc",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "11px",
          width: "180px",
          outline: "none",
        }}
      />
    </div>
  );
}

function SettingToggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#888" }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: "40px",
          height: "22px",
          borderRadius: "11px",
          border: `1px solid ${value ? "#00d4ff44" : "#333"}`,
          background: value ? "rgba(0,212,255,0.2)" : "rgba(0,0,0,0.3)",
          cursor: "pointer",
          position: "relative",
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: value ? "#00d4ff" : "#444",
            position: "absolute",
            top: "2px",
            left: value ? "20px" : "2px",
            transition: "all 0.2s ease",
          }}
        />
      </button>
    </div>
  );
}

function SettingRange({ label, value, min, max, step, unit, onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "12px", color: "#888" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ width: "100px", accentColor: "#00d4ff" }}
        />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#666", minWidth: "45px" }}>
          {value}{unit || ""}
        </span>
      </div>
    </div>
  );
}

// ─── Voice Toast ────────────────────────────────────────────────────
function VoiceToast({ message, type }: { message: string; type: "info" | "success" | "error" }) {
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

// ─── useVoice Hook ──────────────────────────────────────────────────
function useVoice(onCommand: (cmd: { action: string; agent?: string; target?: string }) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  const startListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        const cmd = parseVoiceCommand(finalTranscript);
        if (cmd) {
          onCommand(cmd);
        }
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Clean up audio stream when recognition ends
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setVoiceLevel(0);
      // Keep transcript visible for 3 seconds after recognition ends
      setTimeout(() => setTranscript(""), 3000);
      // If wake word is enabled, restart listening
      if (wakeWordEnabled) {
        setTimeout(() => startWakeWordListening(), 500);
      }
    };

    recognition.onerror = (e: Event) => {
      setIsListening(false);
      setTranscript(`Error: ${(e as ErrorEvent).message || "mic failed"}`);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      setVoiceLevel(0);
      setTimeout(() => setTranscript(""), 3000);
    };

    recognitionRef.current = recognition;
    recognition.start();

    // Start audio level monitoring
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      audioStreamRef.current = stream;
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setVoiceLevel(Math.min(avg / 128, 1));
        animFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();
    }).catch(() => {});
  }, [onCommand, wakeWordEnabled]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
    setVoiceLevel(0);
  }, []);

  const startWakeWordListening = useCallback(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.toLowerCase();
        if (text.includes("hey jarvis") || text.includes("jarvis")) {
          recognition.stop();
          startListening();
          return;
        }
      }
    };

    recognition.onend = () => {
      if (wakeWordEnabled && !isListening) {
        setTimeout(() => startWakeWordListening(), 500);
      }
    };

    recognition.onerror = () => {};

    recognition.start();
  }, [wakeWordEnabled, isListening, startListening]);

  const speak = useCallback(async (text: string) => {
    setIsSpeaking(true);
    try {
      // Try ElevenLabs first
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (response.ok && response.headers.get("Content-Type")?.includes("audio")) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(url);
        };
        await audio.play();
        return;
      }
    } catch { /* fall through to browser TTS */ }

    // Fallback: browser speech synthesis
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 0.8;
      utterance.volume = 0.8;
      // Try to find a deep male voice
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find((v) => v.name.includes("Daniel") || v.name.includes("Alex") || v.name.includes("Google UK English Male"));
      if (preferred) utterance.voice = preferred;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsSpeaking(false);
    }
  }, []);

  const toggleWakeWord = useCallback(() => {
    if (wakeWordEnabled) {
      setWakeWordEnabled(false);
      stopListening();
    } else {
      setWakeWordEnabled(true);
      startWakeWordListening();
    }
  }, [wakeWordEnabled, stopListening, startWakeWordListening]);

  return {
    isListening,
    isSpeaking,
    voiceLevel,
    transcript,
    wakeWordEnabled,
    startListening,
    stopListening,
    speak,
    toggleWakeWord,
  };
}

// ─── SSE Hook for real-time dashboard updates ───────────────────────
function useSSEUpdates(
  onUpdate: (data: DashboardData) => void,
  fallbackFetch: () => Promise<void>,
  intervalMs: number
) {
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const connectSSE = () => {
      const es = new EventSource("/api/events");
      eventSourceRef.current = es;

      es.addEventListener("connected", () => {
        if (!cancelled) setConnected(true);
      });

      es.addEventListener("update", (event) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(event.data);
          onUpdate(data);
        } catch { /* ignore parse errors */ }
      });

      es.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        es.close();
        // Fall back to polling on SSE failure
        if (!fallbackIntervalRef.current) {
          fallbackFetch();
          fallbackIntervalRef.current = setInterval(fallbackFetch, intervalMs);
        }
        // Retry SSE after a delay
        setTimeout(() => {
          if (!cancelled) {
            if (fallbackIntervalRef.current) {
              clearInterval(fallbackIntervalRef.current);
              fallbackIntervalRef.current = null;
            }
            connectSSE();
          }
        }, 5000);
      };
    };

    connectSSE();

    return () => {
      cancelled = true;
      eventSourceRef.current?.close();
      if (fallbackIntervalRef.current) clearInterval(fallbackIntervalRef.current);
    };
  }, [onUpdate, fallbackFetch, intervalMs]);

  return { connected };
}

// ─── Main Dashboard ──────────────────────────────────────────────────
export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [dashConfig, setDashConfig] = useState<DashboardConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [time, setTime] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [spawnAgent, setSpawnAgent] = useState<string | undefined>();
  const [systemVitals, setSystemVitals] = useState<SystemVitals | null>(null);
  const [voiceToast, setVoiceToast] = useState<{ message: string; type: "info" | "success" | "error" } | null>(null);
  const prevSessionsRef = useRef<AcpSession[]>([]);

  const playSound = useNotificationSound(dashConfig?.notifications.volume ?? 0.3);

  // Voice command handler
  const handleVoiceCommand = useCallback((cmd: { action: string; agent?: string; target?: string }) => {
    switch (cmd.action) {
      case "spawn":
        setSpawnAgent(cmd.agent);
        setShowSpawnModal(true);
        setVoiceToast({ message: `Opening spawn for ${cmd.agent?.toUpperCase() || "agent"}...`, type: "info" });
        voice.speak(`Opening spawn configuration for ${cmd.agent}`);
        break;
      case "cancel": {
        const session = data?.sessions.find((s) => !cmd.agent || s.agent === cmd.agent);
        if (session) {
          const id = session.pid ? `pid-${session.pid}` : session.id;
          fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: "PATCH" });
          setVoiceToast({ message: `Cancelling ${session.agent} session`, type: "info" });
          voice.speak(`Cancelling ${session.agent} session`);
        } else {
          setVoiceToast({ message: "No matching session found", type: "error" });
          voice.speak("No matching session found");
        }
        break;
      }
      case "close": {
        const session = data?.sessions.find((s) => !cmd.agent || s.agent === cmd.agent);
        if (session) {
          const id = session.pid ? `pid-${session.pid}` : session.id;
          fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
          setVoiceToast({ message: `Closing ${session.agent} session`, type: "info" });
          voice.speak(`Closing ${session.agent} session`);
        } else {
          setVoiceToast({ message: "No matching session found", type: "error" });
          voice.speak("No matching session found");
        }
        break;
      }
      case "status": {
        const count = data?.sessions.length || 0;
        const agents = [...new Set(data?.sessions.map((s) => s.agent) || [])];
        const msg = count === 0
          ? "All systems nominal. No active sessions."
          : `${count} active session${count > 1 ? "s" : ""} running. Agents: ${agents.join(", ")}.`;
        setVoiceToast({ message: msg, type: "info" });
        voice.speak(msg);
        break;
      }
      case "settings":
        setShowSettings(true);
        setVoiceToast({ message: "Opening settings panel", type: "info" });
        break;
    }
    setTimeout(() => setVoiceToast(null), 4000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const voice = useVoice(handleVoiceCommand);

  // Load dashboard config
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then(setDashConfig)
      .catch(() => {});
  }, []);

  const processUpdate = useCallback((json: DashboardData) => {
    setData(json);
    setError(null);
    setLastUpdate(new Date().toLocaleTimeString());

    if (dashConfig?.notifications.sound && prevSessionsRef.current.length > 0) {
      const prevKeys = new Map(prevSessionsRef.current.map((s) => [s.key, s]));
      for (const s of json.sessions) {
        const prev = prevKeys.get(s.key);
        if (!prev) {
          playSound("spawn");
        } else if (prev.status !== s.status) {
          if (["completed", "done"].includes(s.status)) playSound("complete");
          else if (["error", "failed"].includes(s.status)) playSound("error");
        }
      }
    }
    prevSessionsRef.current = json.sessions;
  }, [dashConfig?.notifications.sound, playSound]);

  const fetchData = useCallback(async () => {
    try {
      const resp = await fetch("/api/sessions", { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json: DashboardData = await resp.json();
      processUpdate(json);
    } catch (e) {
      setError(String(e));
    }
  }, [processUpdate]);

  // Use SSE for real-time updates with polling fallback
  const { connected: sseConnected } = useSSEUpdates(processUpdate, fetchData, dashConfig?.refresh.intervalMs ?? 3000);

  // Fetch system vitals
  useEffect(() => {
    const fetchVitals = async () => {
      try {
        const resp = await fetch("/api/system");
        if (resp.ok) {
          setSystemVitals(await resp.json());
        }
      } catch { /* ignore */ }
    };
    fetchVitals();
    const interval = setInterval(fetchVitals, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSaveConfig = async (cfg: DashboardConfig) => {
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      setDashConfig(cfg);
      setShowSettings(false);
    } catch {
      // handle error
    }
  };

  const handleSpawn = async (agent: string, task: string, mode: string, cwd: string) => {
    try {
      const resp = await fetch("/api/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent, task, mode, workingDirectory: cwd }),
      });
      const result = await resp.json();
      if (result.success) {
        playSound("spawn");
        voice.speak(`${agent} session deployed successfully`);
        setVoiceToast({ message: `${agent.toUpperCase()} deployed!`, type: "success" });
        setTimeout(() => setVoiceToast(null), 3000);
        // Refresh data
        fetchData();
      }
    } catch {
      voice.speak("Failed to deploy agent");
      setVoiceToast({ message: "Spawn failed", type: "error" });
      setTimeout(() => setVoiceToast(null), 3000);
    }
    setShowSpawnModal(false);
  };

  const handleSessionCancel = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: "PATCH" });
      setVoiceToast({ message: "Cancel signal sent", type: "info" });
      setTimeout(() => setVoiceToast(null), 3000);
    } catch { /* ignore */ }
  };

  const handleSessionClose = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
      setVoiceToast({ message: "Session terminated", type: "info" });
      setTimeout(() => setVoiceToast(null), 3000);
      fetchData();
    } catch { /* ignore */ }
  };

  const activeAgents = new Map<string, number>();
  for (const s of data?.sessions || []) {
    activeAgents.set(s.agent, (activeAgents.get(s.agent) || 0) + 1);
  }

  const allAgents = data?.config.allowedAgents || ["pi", "claude", "codex", "opencode", "gemini", "amp", "devin"];
  const gatewayColor = data?.gateway.status === "online" ? "#00ff88" : data?.gateway.status === "degraded" ? "#f9c74f" : "#ff6b6b";
  const compact = dashConfig?.display.compactMode ?? false;

  // Filter sessions by selected agent
  const filteredSessions = selectedAgent
    ? (data?.sessions || []).filter((s) => s.agent === selectedAgent)
    : data?.sessions || [];

  const title = dashConfig?.branding.title || "ACP MISSION CONTROL";
  const subtitle = dashConfig?.branding.subtitle || "OPENCLAW AGENT DISPATCH SYSTEM";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0a0f 100%)",
        color: "#e0e0e0",
        fontFamily: "'Inter', sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <GridBg />
      <ScanLine />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1400px", margin: "0 auto", padding: "clamp(16px, 3vw, 32px)" }}>
        {/* ─── Header ─── */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          style={{ marginBottom: "40px" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                >
                  <HexRing color="#00d4ff" size={48} />
                </motion.div>
                <h1
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "28px",
                    fontWeight: 700,
                    color: "#00d4ff",
                    margin: 0,
                    letterSpacing: "4px",
                    textShadow: "0 0 20px rgba(0,212,255,0.15)",
                  }}
                >
                  {title}
                </h1>
              </div>
              <p
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  color: "#444",
                  margin: 0,
                  letterSpacing: "3px",
                }}
              >
                {subtitle}
              </p>
            </div>

            {/* Clock + Voice Orb + Settings */}
            <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                {/* Voice Orb */}
                <VoiceOrb
                  isListening={voice.isListening}
                  isSpeaking={voice.isSpeaking}
                  onClick={() => {
                    if (voice.isListening) {
                      voice.stopListening();
                    } else {
                      voice.startListening();
                    }
                  }}
                  voiceLevel={voice.voiceLevel}
                />
                <div>
                  <div
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "24px",
                      color: "#00d4ff",
                      fontWeight: 300,
                      letterSpacing: "2px",
                    }}
                    suppressHydrationWarning
                  >
                    {time.toLocaleTimeString("en-US", { hour12: false })}
                  </div>
                  <div
                    suppressHydrationWarning
                    style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "10px",
                      color: "#444",
                      letterSpacing: "2px",
                    }}
                  >
                    {time.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" }).toUpperCase()}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {/* Wake word toggle */}
                <button
                  onClick={voice.toggleWakeWord}
                  style={{
                    background: voice.wakeWordEnabled ? "rgba(0,255,136,0.08)" : "rgba(0,212,255,0.05)",
                    border: `1px solid ${voice.wakeWordEnabled ? "#00ff8844" : "#27272a"}`,
                    borderRadius: "6px",
                    padding: "6px 12px",
                    color: voice.wakeWordEnabled ? "#00ff88" : "#555",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    letterSpacing: "2px",
                    transition: "all 0.2s ease",
                  }}
                >
                  {voice.wakeWordEnabled ? "JARVIS ON" : "WAKE WORD"}
                </button>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  style={{
                    background: "rgba(0,212,255,0.05)",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                    padding: "6px 12px",
                    color: "#555",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                    letterSpacing: "2px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#00d4ff44";
                    e.currentTarget.style.color = "#00d4ff";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#27272a";
                    e.currentTarget.style.color = "#555";
                  }}
                >
                  CONFIG
                </button>
              </div>
            </div>
          </div>

          {/* Voice Transcript */}
          <AnimatePresence>
            {voice.transcript && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  marginTop: "16px",
                  padding: "12px 20px",
                  background: "rgba(0, 212, 255, 0.05)",
                  border: "1px solid #00d4ff22",
                  borderRadius: "8px",
                }}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#00d4ff", letterSpacing: "2px" }}>
                  TRANSCRIPT
                </span>
                <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "#ccc", marginTop: "4px" }}>
                  {voice.transcript}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ─── System Vitals ─── */}
        <SystemVitalsBar vitals={systemVitals} />

        {/* ─── Status Bar ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <CornerBrackets>
            <div
              style={{
                display: "flex",
                gap: "clamp(12px, 2vw, 32px)",
                padding: "clamp(12px, 2vw, 20px) clamp(16px, 2vw, 28px)",
                background: "rgba(15, 15, 25, 0.6)",
                border: "1px solid #27272a",
                borderRadius: "12px",
                marginBottom: "32px",
                backdropFilter: "blur(10px)",
                flexWrap: "wrap",
              }}
            >
              <StatusItem
                label="GATEWAY"
                value={data?.gateway.status?.toUpperCase() || "CHECKING..."}
                color={gatewayColor}
                pulse={data?.gateway.status === "online"}
              />
              {data?.gateway.pid && (
                <StatusItem label="PID" value={data.gateway.pid} color="#444" />
              )}
              <StatusItem
                label="ACTIVE SESSIONS"
                value={`${data?.sessions.length || 0} / ${data?.config.maxConcurrent || 8}`}
                color={data?.sessions.length ? "#00d4ff" : "#444"}
              />
              <StatusItem
                label="DEFAULT AGENT"
                value={(data?.config.defaultAgent || "codex").toUpperCase()}
                color={getAgentTheme(data?.config.defaultAgent || "codex").color}
              />
              <StatusItem
                label="BACKEND"
                value={(data?.config.backend || "acpx").toUpperCase()}
                color="#555"
              />
              <StatusItem label="TTL" value={`${data?.config.ttlMinutes || 120}m`} color="#555" />
              <StatusItem
                label="DISPATCH"
                value={data?.config.dispatchEnabled ? "ON" : "OFF"}
                color={data?.config.dispatchEnabled ? "#00ff88" : "#ff6b6b"}
              />
              <StatusItem
                label="FEED"
                value={sseConnected ? "SSE LIVE" : "POLLING"}
                color={sseConnected ? "#00ff88" : "#f9c74f"}
                pulse={sseConnected}
              />
              <StatusItem label="LAST SYNC" value={lastUpdate || "--:--:--"} color="#333" />
              {error && <StatusItem label="ERROR" value="FETCH FAILED" color="#ff6b6b" />}
            </div>
          </CornerBrackets>
        </motion.div>

        {/* ─── Agent Fleet ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ marginBottom: "40px" }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#52525b", letterSpacing: "4px", margin: 0, textTransform: "uppercase" }}>
              Agent Fleet
            </h2>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {selectedAgent && (
                <button
                  onClick={() => setSelectedAgent(null)}
                  style={{
                    background: "none",
                    border: "1px solid #333",
                    borderRadius: "6px",
                    padding: "4px 12px",
                    color: "#666",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px",
                  }}
                >
                  SHOW ALL
                </button>
              )}
              <motion.button
                whileHover={{ scale: 1.05, borderColor: "#00d4ff44" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  setSpawnAgent(undefined);
                  setShowSpawnModal(true);
                }}
                style={{
                  background: "rgba(0,212,255,0.08)",
                  border: "1px solid #00d4ff22",
                  borderRadius: "6px",
                  padding: "6px 14px",
                  color: "#00d4ff",
                  cursor: "pointer",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  letterSpacing: "2px",
                  transition: "all 0.2s ease",
                }}
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
                onClick={() => setSelectedAgent(selectedAgent === agent ? null : agent)}
                onSpawn={() => {
                  setSpawnAgent(agent);
                  setShowSpawnModal(true);
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* ─── Active Sessions ─── */}
        <div style={{ marginBottom: "40px" }}>
          <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#52525b", letterSpacing: "4px", marginBottom: "16px", textTransform: "uppercase" }}>
            Active Sessions {selectedAgent && <span style={{ color: getAgentTheme(selectedAgent).color }}>/ {selectedAgent.toUpperCase()}</span>}
          </h2>

          <AnimatePresence mode="popLayout">
            {filteredSessions.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(auto-fill, minmax(360px, 1fr))" : "repeat(auto-fill, minmax(420px, 1fr))", gap: "16px" }}>
                {filteredSessions.map((session, i) => (
                  <SessionCard
                    key={session.key || session.id}
                    session={session}
                    index={i}
                    compact={compact}
                    onSteer={() => {}}
                    onCancel={handleSessionCancel}
                    onClose={handleSessionClose}
                  />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  padding: "64px",
                  textAlign: "center",
                  background: "rgba(15, 15, 25, 0.4)",
                  border: "1px solid #27272a",
                  borderRadius: "12px",
                }}
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
                  onClick={() => {
                    setSpawnAgent(undefined);
                    setShowSpawnModal(true);
                  }}
                  style={{
                    marginTop: "20px",
                    background: "rgba(0,212,255,0.08)",
                    border: "1px solid #00d4ff22",
                    borderRadius: "8px",
                    padding: "10px 24px",
                    color: "#00d4ff88",
                    cursor: "pointer",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11px",
                    letterSpacing: "2px",
                  }}
                >
                  + SPAWN AGENT
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── Agent Performance Analytics ─── */}
        <AgentAnalytics />

        {/* ─── Fleet Activity Heatmap ─── */}
        <FleetHeatmap />

        {/* ─── Session History ─── */}
        {dashConfig?.display.showHistory !== false && (data?.history?.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <h2 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#52525b", letterSpacing: "4px", marginBottom: "16px", textTransform: "uppercase" }}>
              Recent History
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {data!.history.slice(0, dashConfig?.display.historyLimit ?? 10).map((session, i) => (
                <HistoryRow key={session.key} session={session} index={i} />
              ))}
            </div>
          </motion.div>
        )}

        {/* ─── Footer ─── */}
        <div
          style={{
            marginTop: "48px",
            paddingTop: "20px",
            borderTop: "1px solid #111",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#222", letterSpacing: "3px" }}>
            OPENCLAW ACP DASHBOARD v{dashConfig?.branding.version || "0.1.0"}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#222", letterSpacing: "2px" }}>
            REAL-TIME | VOICE ENABLED
          </span>
        </div>
      </div>

      {/* ─── Spawn Modal ─── */}
      <AnimatePresence>
        {showSpawnModal && (
          <SpawnModal
            preselectedAgent={spawnAgent}
            onSpawn={handleSpawn}
            onClose={() => setShowSpawnModal(false)}
          />
        )}
      </AnimatePresence>

      {/* ─── Settings Panel ─── */}
      <AnimatePresence>
        {showSettings && dashConfig && (
          <SettingsPanel config={dashConfig} onSave={handleSaveConfig} onClose={() => setShowSettings(false)} />
        )}
      </AnimatePresence>

      {/* ─── Voice Toast ─── */}
      <AnimatePresence>
        {voiceToast && (
          <VoiceToast message={voiceToast.message} type={voiceToast.type} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Status Item ─────────────────────────────────────────────────────
function StatusItem({ label, value, color, pulse = false }: { label: string; value: string; color: string; pulse?: boolean }) {
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

// ─── Web Speech API Types ──────────────────────────────────────────
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: { transcript: string; confidence: number };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}
