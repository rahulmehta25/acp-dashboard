"use client";

import { useState } from "react";
import { motion } from "framer-motion";

interface AgentStats {
  agent: string;
  color: string;
  icon: string;
  tokensUsed: number;
  avgDuration: string;
  avgDurationMs: number;
  sessions: number;
  success: number;
  failure: number;
}

const MOCK_STATS: AgentStats[] = [
  { agent: "claude", color: "#d4a0ff", icon: "\u{1F9E0}", tokensUsed: 284300, avgDuration: "12m 34s", avgDurationMs: 754000, sessions: 47, success: 42, failure: 5 },
  { agent: "codex", color: "#00d4ff", icon: "\u26A1", tokensUsed: 198700, avgDuration: "8m 12s", avgDurationMs: 492000, sessions: 31, success: 29, failure: 2 },
  { agent: "gemini", color: "#4ecdc4", icon: "\u{1F48E}", tokensUsed: 156200, avgDuration: "6m 45s", avgDurationMs: 405000, sessions: 24, success: 21, failure: 3 },
  { agent: "devin", color: "#6c5ce7", icon: "\u{1F916}", tokensUsed: 112400, avgDuration: "18m 22s", avgDurationMs: 1102000, sessions: 12, success: 10, failure: 2 },
  { agent: "amp", color: "#ff8c42", icon: "\u26A1", tokensUsed: 87600, avgDuration: "5m 08s", avgDurationMs: 308000, sessions: 18, success: 17, failure: 1 },
  { agent: "pi", color: "#ff6b6b", icon: "\u{1F534}", tokensUsed: 43200, avgDuration: "3m 50s", avgDurationMs: 230000, sessions: 8, success: 7, failure: 1 },
  { agent: "opencode", color: "#f9c74f", icon: "\u{1F513}", tokensUsed: 29800, avgDuration: "4m 15s", avgDurationMs: 255000, sessions: 6, success: 5, failure: 1 },
];

type MetricKey = "tokens" | "duration" | "sessions";

export default function AgentAnalytics() {
  const [activeMetric, setActiveMetric] = useState<MetricKey>("tokens");

  const maxTokens = Math.max(...MOCK_STATS.map((s) => s.tokensUsed));
  const maxDuration = Math.max(...MOCK_STATS.map((s) => s.avgDurationMs));
  const maxSessions = Math.max(...MOCK_STATS.map((s) => s.sessions));

  const getBarWidth = (stat: AgentStats): number => {
    if (activeMetric === "tokens") return (stat.tokensUsed / maxTokens) * 100;
    if (activeMetric === "duration") return (stat.avgDurationMs / maxDuration) * 100;
    return (stat.sessions / maxSessions) * 100;
  };

  const getBarLabel = (stat: AgentStats): string => {
    if (activeMetric === "tokens") return `${(stat.tokensUsed / 1000).toFixed(1)}k`;
    if (activeMetric === "duration") return stat.avgDuration;
    return `${stat.sessions}`;
  };

  const totalTokens = MOCK_STATS.reduce((a, s) => a + s.tokensUsed, 0);
  const totalSessions = MOCK_STATS.reduce((a, s) => a + s.sessions, 0);
  const totalSuccess = MOCK_STATS.reduce((a, s) => a + s.success, 0);
  const totalFailure = MOCK_STATS.reduce((a, s) => a + s.failure, 0);
  const successRate = totalSessions > 0 ? ((totalSuccess / totalSessions) * 100).toFixed(1) : "0";

  const metrics: { key: MetricKey; label: string }[] = [
    { key: "tokens", label: "TOKENS USED" },
    { key: "duration", label: "AVG DURATION" },
    { key: "sessions", label: "SESSIONS" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      style={{ marginBottom: "40px" }}
    >
      <h2 style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "12px",
        color: "#52525b",
        letterSpacing: "4px",
        marginBottom: "16px",
        textTransform: "uppercase",
      }}>
        Agent Performance
      </h2>

      {/* Summary cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "12px",
        marginBottom: "20px",
      }}>
        {[
          { label: "TOTAL TOKENS", value: `${(totalTokens / 1000).toFixed(0)}k`, color: "#00d4ff" },
          { label: "TOTAL SESSIONS", value: `${totalSessions}`, color: "#d4a0ff" },
          { label: "SUCCESS RATE", value: `${successRate}%`, color: "#00ff88" },
          { label: "FAILURES", value: `${totalFailure}`, color: totalFailure > 0 ? "#ff6b6b" : "#52525b" },
        ].map((card) => (
          <div key={card.label} style={{
            padding: "16px",
            background: "rgba(15, 15, 25, 0.6)",
            border: "1px solid #27272a",
            borderRadius: "10px",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "9px",
              color: "#52525b",
              letterSpacing: "2px",
              marginBottom: "6px",
            }}>
              {card.label}
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "22px",
              fontWeight: 600,
              color: card.color,
            }}>
              {card.value}
            </div>
          </div>
        ))}
      </div>

      {/* Metric selector */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {metrics.map((m) => (
          <button
            key={m.key}
            onClick={() => setActiveMetric(m.key)}
            style={{
              background: activeMetric === m.key ? "rgba(0, 212, 255, 0.08)" : "transparent",
              border: `1px solid ${activeMetric === m.key ? "#00d4ff33" : "#27272a"}`,
              borderRadius: "6px",
              padding: "6px 14px",
              color: activeMetric === m.key ? "#00d4ff" : "#52525b",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "10px",
              letterSpacing: "1px",
              transition: "all 0.2s ease",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{
        background: "rgba(15, 15, 25, 0.6)",
        border: "1px solid #27272a",
        borderRadius: "12px",
        padding: "20px",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {MOCK_STATS.map((stat, i) => (
            <div key={stat.agent} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                minWidth: "100px",
              }}>
                <span style={{ fontSize: "14px" }}>{stat.icon}</span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  color: stat.color,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}>
                  {stat.agent}
                </span>
              </div>
              <div style={{
                flex: 1,
                height: "24px",
                background: "rgba(0, 0, 0, 0.3)",
                borderRadius: "4px",
                overflow: "hidden",
                position: "relative",
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${getBarWidth(stat)}%` }}
                  transition={{ duration: 0.8, delay: i * 0.08, ease: "easeOut" }}
                  style={{
                    height: "100%",
                    background: `linear-gradient(90deg, ${stat.color}33, ${stat.color}66)`,
                    borderRadius: "4px",
                    position: "relative",
                  }}
                />
                <span style={{
                  position: "absolute",
                  right: "8px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  color: "#a1a1aa",
                  zIndex: 1,
                }}>
                  {getBarLabel(stat)}
                </span>
              </div>
              {/* Success/Failure mini indicators */}
              <div style={{ display: "flex", gap: "6px", minWidth: "60px", justifyContent: "flex-end" }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  color: "#00ff88",
                }}>
                  {stat.success}
                </span>
                <span style={{ color: "#27272a", fontSize: "10px" }}>/</span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "10px",
                  color: stat.failure > 0 ? "#ff6b6b" : "#27272a",
                }}>
                  {stat.failure}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
