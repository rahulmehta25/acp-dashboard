"use client";

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import type { DashboardConfig } from "@/types";
import { useDashboardData, useVoice } from "@/hooks";
import { ScanLine, GridBg } from "@/components/ui";
import { DashboardHeader } from "@/components/DashboardHeader";
import { StatusBar } from "@/components/StatusBar";
import { SystemVitalsBar } from "@/components/SystemVitalsBar";
import { AgentFleet } from "@/components/AgentFleet";
import { ActiveSessions } from "@/components/ActiveSessions";
import { SessionHistory } from "@/components/SessionHistory";
import { SpawnModal } from "@/components/SpawnModal";
import { SettingsPanel } from "@/components/SettingsPanel";
import { VoiceToast } from "@/components/VoiceToast";
import AgentAnalytics from "@/components/AgentAnalytics";
import FleetHeatmap from "@/components/FleetHeatmap";

export default function Dashboard() {
  const { data, dashConfig, error, lastUpdate, systemVitals, sseConnected, playSound, fetchData, saveConfig } = useDashboardData();
  const [time, setTime] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [showSpawnModal, setShowSpawnModal] = useState(false);
  const [spawnAgent, setSpawnAgent] = useState<string | undefined>();
  const [voiceToast, setVoiceToast] = useState<{ message: string; type: "info" | "success" | "error" } | null>(null);

  const showToast = useCallback((message: string, type: "info" | "success" | "error") => {
    setVoiceToast({ message, type });
    setTimeout(() => setVoiceToast(null), 4000);
  }, []);

  const handleVoiceCommand = useCallback((cmd: { action: string; agent?: string; target?: string }) => {
    switch (cmd.action) {
      case "spawn":
        setSpawnAgent(cmd.agent);
        setShowSpawnModal(true);
        showToast(`Opening spawn for ${cmd.agent?.toUpperCase() || "agent"}...`, "info");
        voice.speak(`Opening spawn configuration for ${cmd.agent}`);
        break;
      case "cancel": {
        const session = data?.sessions.find((s) => !cmd.agent || s.agent === cmd.agent);
        if (session) {
          const id = session.pid ? `pid-${session.pid}` : session.id;
          fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: "PATCH" });
          showToast(`Cancelling ${session.agent} session`, "info");
          voice.speak(`Cancelling ${session.agent} session`);
        } else {
          showToast("No matching session found", "error");
          voice.speak("No matching session found");
        }
        break;
      }
      case "close": {
        const session = data?.sessions.find((s) => !cmd.agent || s.agent === cmd.agent);
        if (session) {
          const id = session.pid ? `pid-${session.pid}` : session.id;
          fetch(`/api/sessions/${encodeURIComponent(id)}`, { method: "DELETE" });
          showToast(`Closing ${session.agent} session`, "info");
          voice.speak(`Closing ${session.agent} session`);
        } else {
          showToast("No matching session found", "error");
          voice.speak("No matching session found");
        }
        break;
      }
      case "status": {
        const count = data?.sessions.length || 0;
        const agents = [...new Set(data?.sessions.map((s) => s.agent) || [])];
        const msg = count === 0 ? "All systems nominal. No active sessions." : `${count} active session${count > 1 ? "s" : ""} running. Agents: ${agents.join(", ")}.`;
        showToast(msg, "info");
        voice.speak(msg);
        break;
      }
      case "settings":
        setShowSettings(true);
        showToast("Opening settings panel", "info");
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, showToast]);

  const voice = useVoice(handleVoiceCommand);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleSaveConfig = async (cfg: DashboardConfig) => {
    const success = await saveConfig(cfg);
    if (success) setShowSettings(false);
  };

  const handleSpawn = async (agent: string, task: string, mode: string, cwd: string) => {
    try {
      const resp = await fetch("/api/spawn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agent, task, mode, workingDirectory: cwd }) });
      const result = await resp.json();
      if (result.success) {
        playSound("spawn");
        voice.speak(`${agent} session deployed successfully`);
        showToast(`${agent.toUpperCase()} deployed!`, "success");
        fetchData();
      }
    } catch {
      voice.speak("Failed to deploy agent");
      showToast("Spawn failed", "error");
    }
    setShowSpawnModal(false);
  };

  const handleSessionCancel = async (sessionId: string) => {
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: "PATCH" });
    showToast("Cancel signal sent", "info");
  };

  const handleSessionClose = async (sessionId: string) => {
    await fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE" });
    showToast("Session terminated", "info");
    fetchData();
  };

  const activeAgents = new Map<string, number>();
  for (const s of data?.sessions || []) {
    activeAgents.set(s.agent, (activeAgents.get(s.agent) || 0) + 1);
  }

  const allAgents = data?.config.allowedAgents || ["pi", "claude", "codex", "opencode", "gemini", "amp", "devin"];
  const filteredSessions = selectedAgent ? (data?.sessions || []).filter((s) => s.agent === selectedAgent) : data?.sessions || [];
  const title = dashConfig?.branding.title || "ACP MISSION CONTROL";
  const subtitle = dashConfig?.branding.subtitle || "OPENCLAW AGENT DISPATCH SYSTEM";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0a0f 100%)", color: "#e0e0e0", fontFamily: "'Inter', sans-serif", position: "relative", overflow: "hidden" }}>
      <GridBg />
      <ScanLine />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "1400px", margin: "0 auto", padding: "clamp(16px, 3vw, 32px)" }}>
        <DashboardHeader title={title} subtitle={subtitle} time={time} voice={voice} onSettingsClick={() => setShowSettings(!showSettings)} />
        <SystemVitalsBar vitals={systemVitals} />
        <StatusBar data={data} sseConnected={sseConnected} lastUpdate={lastUpdate} error={error} />
        <AgentFleet allAgents={allAgents} activeAgents={activeAgents} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} onSpawn={(agent) => { setSpawnAgent(agent); setShowSpawnModal(true); }} />
        <ActiveSessions sessions={filteredSessions} selectedAgent={selectedAgent} compact={dashConfig?.display.compactMode ?? false} onCancel={handleSessionCancel} onClose={handleSessionClose} onSpawn={() => { setSpawnAgent(undefined); setShowSpawnModal(true); }} />
        <AgentAnalytics />
        <FleetHeatmap />
        <SessionHistory history={data?.history || []} config={dashConfig} />

        <div style={{ marginTop: "48px", paddingTop: "20px", borderTop: "1px solid #111", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#222", letterSpacing: "3px" }}>OPENCLAW ACP DASHBOARD v{dashConfig?.branding.version || "0.1.0"}</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#222", letterSpacing: "2px" }}>REAL-TIME | VOICE ENABLED</span>
        </div>
      </div>

      <AnimatePresence>{showSpawnModal && <SpawnModal preselectedAgent={spawnAgent} onSpawn={handleSpawn} onClose={() => setShowSpawnModal(false)} />}</AnimatePresence>
      <AnimatePresence>{showSettings && dashConfig && <SettingsPanel config={dashConfig} onSave={handleSaveConfig} onClose={() => setShowSettings(false)} />}</AnimatePresence>
      <AnimatePresence>{voiceToast && <VoiceToast message={voiceToast.message} type={voiceToast.type} />}</AnimatePresence>
    </div>
  );
}
