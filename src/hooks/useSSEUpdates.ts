"use client";

import { useState, useEffect, useRef } from "react";
import type { DashboardData } from "@/types";

export function useSSEUpdates(
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
