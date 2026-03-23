"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AcpSession, DashboardData, DashboardConfig, SystemVitals } from "@/types";
import { useNotificationSound } from "./useNotificationSound";
import { useSSEUpdates } from "./useSSEUpdates";

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [dashConfig, setDashConfig] = useState<DashboardConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string>("");
  const [systemVitals, setSystemVitals] = useState<SystemVitals | null>(null);
  const prevSessionsRef = useRef<AcpSession[]>([]);

  const playSound = useNotificationSound(dashConfig?.notifications.volume ?? 0.3);

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

  const saveConfig = async (cfg: DashboardConfig) => {
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cfg),
      });
      setDashConfig(cfg);
      return true;
    } catch {
      return false;
    }
  };

  return {
    data,
    dashConfig,
    error,
    lastUpdate,
    systemVitals,
    sseConnected,
    playSound,
    fetchData,
    saveConfig,
  };
}
