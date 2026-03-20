export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

const now = () => new Date().toISOString();

function minutesAgo(m: number): string {
  return new Date(Date.now() - m * 60_000).toISOString();
}

export function getDemoSessions() {
  return {
    gateway: { status: "online", pid: "48201", port: 18789 },
    sessions: [
      {
        id: "pid-48312",
        key: "agent:claude:acp:pid-48312",
        agent: "claude",
        status: "running",
        task: "Reviewing PR #42: auth middleware refactor",
        mode: "session",
        startedAt: minutesAgo(14),
        elapsed: "",
        pid: "48312",
      },
      {
        id: "pid-48450",
        key: "agent:codex:acp:pid-48450",
        agent: "codex",
        status: "running",
        task: "Fixing token validation bug in /api/auth",
        mode: "session",
        startedAt: minutesAgo(7),
        elapsed: "",
        pid: "48450",
      },
      {
        id: "pid-48523",
        key: "agent:gemini:acp:pid-48523",
        agent: "gemini",
        status: "running",
        task: "Generating OpenAPI docs for v2 endpoints",
        mode: "session",
        startedAt: minutesAgo(3),
        elapsed: "",
        pid: "48523",
      },
      {
        id: "pid-48601",
        key: "agent:amp:acp:pid-48601",
        agent: "amp",
        status: "running",
        task: "Migrating user schema to PostgreSQL 16",
        mode: "persistent",
        startedAt: minutesAgo(22),
        elapsed: "",
        pid: "48601",
      },
    ],
    history: [
      {
        id: "pid-47801",
        key: "agent:claude:acp:pid-47801",
        agent: "claude",
        status: "completed",
        task: "Security audit on payments middleware",
        mode: "one-shot",
        startedAt: minutesAgo(82),
        elapsed: "",
        pid: "47801",
      },
      {
        id: "pid-47650",
        key: "agent:devin:acp:pid-47650",
        agent: "devin",
        status: "completed",
        task: "Add E2E tests for checkout flow",
        mode: "one-shot",
        startedAt: minutesAgo(120),
        elapsed: "",
        pid: "47650",
      },
      {
        id: "pid-47500",
        key: "agent:codex:acp:pid-47500",
        agent: "codex",
        status: "failed",
        task: "Deploy canary to us-east-1",
        mode: "one-shot",
        startedAt: minutesAgo(145),
        elapsed: "",
        pid: "47500",
      },
      {
        id: "pid-47320",
        key: "agent:opencode:acp:pid-47320",
        agent: "opencode",
        status: "completed",
        task: "Refactor connection pool with pgBouncer",
        mode: "persistent",
        startedAt: minutesAgo(200),
        elapsed: "",
        pid: "47320",
      },
    ],
    timestamp: now(),
    config: {
      maxConcurrent: 8,
      defaultAgent: "codex",
      allowedAgents: ["pi", "claude", "codex", "opencode", "gemini", "amp", "devin"],
      ttlMinutes: 120,
      backend: "acpx",
      dispatchEnabled: true,
    },
  };
}

export function getDemoSystemVitals() {
  const base = {
    cpu: { usage: 34, cores: 10, model: "Apple M1 Pro" },
    memory: { usage: 61, total: "16.0GB", used: "9.8GB", free: "6.2GB" },
    disk: { usage: 47, total: "460.4GB", used: "216.4GB" },
    load: { avg1: "3.42", avg5: "2.81", avg15: "2.14" },
    uptime: "4h 12m",
    network: true,
    processes: 487,
    timestamp: now(),
  };

  // Add slight jitter so the dashboard feels alive
  base.cpu.usage = clamp(base.cpu.usage + jitter(5), 0, 100);
  base.memory.usage = clamp(base.memory.usage + jitter(3), 0, 100);
  base.processes = base.processes + Math.floor(jitter(10));

  return base;
}

export function getDemoConfig() {
  return {
    branding: {
      title: "ACP MISSION CONTROL",
      subtitle: "OPENCLAW AGENT DISPATCH SYSTEM",
      version: "0.1.0",
    },
    refresh: { intervalMs: 3000, sessionHistoryLimit: 20 },
    notifications: { sound: true, onComplete: true, onError: true, volume: 0.3 },
    display: { showHistory: true, historyLimit: 10, compactMode: false },
  };
}

export function getDemoSpawnResult(agent: string, task: string, mode: string) {
  const pid = 48000 + Math.floor(Math.random() * 1000);
  return {
    success: true,
    sessionId: `spawn-${agent}-pid-${pid}`,
    pid,
    agent,
    task,
    mode,
    workingDirectory: "~/Desktop/Projects/acp-dashboard",
    message: `${agent} session spawned successfully`,
  };
}

export function getDemoStreamLines(): Array<{ type: string; line?: string; data?: string; timestamp: string }> {
  return [
    { type: "connected", line: "Stream connected", timestamp: now() },
    { type: "output", line: "⟩ Analyzing codebase structure...", timestamp: now() },
    { type: "output", line: "  Found 14 source files across 3 modules", timestamp: now() },
    { type: "output", line: "  Scanning for patterns and dependencies...", timestamp: now() },
    { type: "output", line: "⟩ Running static analysis pass 1/3", timestamp: now() },
    { type: "stats", data: "12.4  3.1  0:14", timestamp: now() },
    { type: "output", line: "  ✓ No critical issues detected", timestamp: now() },
    { type: "output", line: "⟩ Generating implementation plan...", timestamp: now() },
    { type: "output", line: "  Estimated changes: 4 files, +127 -34 lines", timestamp: now() },
    { type: "output", line: "⟩ Applying changes to src/lib/auth.ts", timestamp: now() },
    { type: "output", line: "  ✓ Updated token validation logic", timestamp: now() },
    { type: "output", line: "⟩ Running test suite...", timestamp: now() },
    { type: "output", line: "  Tests: 23 passed, 0 failed", timestamp: now() },
  ];
}

function jitter(range: number): number {
  return (Math.random() - 0.5) * 2 * range;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
