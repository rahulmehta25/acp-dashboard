import type { AgentTheme } from "@/types";

export const AGENT_THEME: Record<string, AgentTheme> = {
  codex:    { color: "#00d4ff", glow: "0 0 12px rgba(0,212,255,0.2)",   icon: "⚡", label: "Codex" },
  claude:   { color: "#d4a0ff", glow: "0 0 12px rgba(212,160,255,0.2)", icon: "🧠", label: "Claude Code" },
  pi:       { color: "#ff6b6b", glow: "0 0 12px rgba(255,107,107,0.2)", icon: "🔴", label: "Pi" },
  gemini:   { color: "#4ecdc4", glow: "0 0 12px rgba(78,205,196,0.2)",  icon: "💎", label: "Gemini CLI" },
  opencode: { color: "#f9c74f", glow: "0 0 12px rgba(249,199,79,0.2)",  icon: "🔓", label: "OpenCode" },
  amp:      { color: "#ff8c42", glow: "0 0 12px rgba(255,140,66,0.2)",  icon: "⚡", label: "Amp" },
  devin:    { color: "#6c5ce7", glow: "0 0 12px rgba(108,92,231,0.2)",  icon: "🤖", label: "Devin" },
};

export const getAgentTheme = (agent: string): AgentTheme =>
  AGENT_THEME[agent] || { color: "#888", glow: "0 0 12px rgba(136,136,136,0.15)", icon: "🤖", label: agent };

export const STATUS_COLORS: Record<string, string> = {
  running: "#00ff88", active: "#00ff88",
  idle: "#f9c74f", waiting: "#f9c74f",
  completed: "#4ecdc4", done: "#4ecdc4",
  error: "#ff6b6b", failed: "#ff6b6b",
  cancelled: "#666", unknown: "#444",
};

export const RECENT_PROJECTS = [
  "~/Desktop/Projects/acp-dashboard",
  "~/Desktop/Projects/osmoti-backend",
  "~/Desktop/Projects/openclaw-railway",
  "~/Desktop/Projects/rung",
  "~/Desktop/Projects/analytics-pro",
  "~/Desktop/Projects/clipora-mvp-fix",
];
