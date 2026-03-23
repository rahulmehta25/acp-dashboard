"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { getAgentTheme, RECENT_PROJECTS } from "@/lib/constants";
import { HexRing } from "./ui/HexRing";

interface SpawnModalProps {
  preselectedAgent?: string;
  onSpawn: (agent: string, task: string, mode: string, cwd: string) => void;
  onClose: () => void;
}

export function SpawnModal({
  preselectedAgent,
  onSpawn,
  onClose,
}: SpawnModalProps) {
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
