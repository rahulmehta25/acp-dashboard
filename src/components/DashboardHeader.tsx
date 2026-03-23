"use client";

import { motion, AnimatePresence } from "framer-motion";
import { HexRing } from "./ui/HexRing";
import { VoiceOrb } from "./VoiceOrb";

interface DashboardHeaderProps {
  title: string;
  subtitle: string;
  time: Date;
  voice: {
    isListening: boolean;
    isSpeaking: boolean;
    voiceLevel: number;
    transcript: string;
    wakeWordEnabled: boolean;
    startListening: () => void;
    stopListening: () => void;
    toggleWakeWord: () => void;
  };
  onSettingsClick: () => void;
}

export function DashboardHeader({ title, subtitle, time, voice, onSettingsClick }: DashboardHeaderProps) {
  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} style={{ marginBottom: "40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "8px" }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
              <HexRing color="#00d4ff" size={48} />
            </motion.div>
            <h1 style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "28px", fontWeight: 700, color: "#00d4ff", margin: 0, letterSpacing: "4px", textShadow: "0 0 20px rgba(0,212,255,0.15)" }}>
              {title}
            </h1>
          </div>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#444", margin: 0, letterSpacing: "3px" }}>
            {subtitle}
          </p>
        </div>

        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <VoiceOrb
              isListening={voice.isListening}
              isSpeaking={voice.isSpeaking}
              onClick={() => voice.isListening ? voice.stopListening() : voice.startListening()}
              voiceLevel={voice.voiceLevel}
            />
            <div>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "24px", color: "#00d4ff", fontWeight: 300, letterSpacing: "2px" }} suppressHydrationWarning>
                {time.toLocaleTimeString("en-US", { hour12: false })}
              </div>
              <div suppressHydrationWarning style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "#444", letterSpacing: "2px" }}>
                {time.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "short", day: "numeric" }).toUpperCase()}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
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
                transition: "all 0.2s ease"
              }}
            >
              {voice.wakeWordEnabled ? "JARVIS ON" : "WAKE WORD"}
            </button>
            <button
              onClick={onSettingsClick}
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
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#00d4ff44"; e.currentTarget.style.color = "#00d4ff"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#27272a"; e.currentTarget.style.color = "#555"; }}
            >
              CONFIG
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {voice.transcript && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginTop: "16px", padding: "12px 20px", background: "rgba(0, 212, 255, 0.05)", border: "1px solid #00d4ff22", borderRadius: "8px" }}
          >
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "#00d4ff", letterSpacing: "2px" }}>TRANSCRIPT</span>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: "14px", color: "#ccc", marginTop: "4px" }}>{voice.transcript}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
