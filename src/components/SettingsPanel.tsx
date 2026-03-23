"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { DashboardConfig } from "@/types";

interface SettingsPanelProps {
  config: DashboardConfig;
  onSave: (cfg: DashboardConfig) => void;
  onClose: () => void;
}

export function SettingsPanel({
  config,
  onSave,
  onClose,
}: SettingsPanelProps) {
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
        <SettingToggle label="Sound Effects" value={local?.notifications?.sound} onChange={(v) => update("notifications.sound", v)} />
        <SettingRange label="Volume" value={local?.notifications?.volume} min={0} max={1} step={0.1} onChange={(v) => update("notifications.volume", v)} />
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
