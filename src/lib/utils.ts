export function getElapsed(startedAt: string): string {
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

export function parseVoiceCommand(transcript: string): { action: string; agent?: string; target?: string } | null {
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
