import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFileSync } from "fs";
import { join } from "path";
import {
  applyHeaders,
  enforceRateLimit,
  ensureLocalAccess,
} from "@/lib/api-security";
import { isDemoMode, getDemoSessions } from "@/lib/demo-data";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 1024 * 1024;

export const dynamic = "force-dynamic";

interface AcpSession {
  id: string;
  key: string;
  agent: string;
  status: string;
  task: string;
  mode: string;
  startedAt: string;
  elapsed: string;
  thread?: string;
  pid?: string;
}

interface OpenClawConfig {
  maxConcurrent: number;
  defaultAgent: string;
  allowedAgents: string[];
  ttlMinutes: number;
  backend: string;
  dispatchEnabled: boolean;
}

interface ProcessSnapshot {
  pid: string;
  cpu: number;
  memory: number;
  tty: string;
  command: string;
}

let configCache: OpenClawConfig | null = null;
let configCacheTime = 0;
const CONFIG_TTL = 30000;

const AGENT_MATCHERS: Array<{ name: string; include: RegExp; exclude: RegExp[] }> = [
  {
    name: "claude",
    include: /\bclaude\b/i,
    exclude: [/Claude\.app/i, /claude-mem/i],
  },
  {
    name: "codex",
    include: /\bcodex\b/i,
    exclude: [/node_modules/i],
  },
  {
    name: "gemini",
    include: /\bgemini\b/i,
    exclude: [],
  },
  {
    name: "pi",
    include: /\bpi\b/i,
    exclude: [],
  },
  {
    name: "opencode",
    include: /\bopencode\b/i,
    exclude: [],
  },
  {
    name: "amp",
    include: /\bamp\b/i,
    exclude: [/amplif/i, /ample/i],
  },
  {
    name: "devin",
    include: /\bdevin\b/i,
    exclude: [],
  },
];

const sessionHistory: AcpSession[] = [];
const MAX_HISTORY = 50;

async function runCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    timeout: timeoutMs,
    maxBuffer: MAX_BUFFER,
  });
  return stdout ?? "";
}

function asSafeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asSafeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asSafeBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function toIsoOrNow(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function parseProcessSnapshot(line: string): ProcessSnapshot | null {
  const match = line.trim().match(/^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.+)$/);
  if (!match) {
    return null;
  }

  const [, pid, cpuRaw, memoryRaw, tty, command] = match;
  const cpu = Number.parseFloat(cpuRaw);
  const memory = Number.parseFloat(memoryRaw);

  if (!Number.isFinite(cpu) || !Number.isFinite(memory)) {
    return null;
  }

  return {
    pid,
    cpu,
    memory,
    tty,
    command,
  };
}

function findAgentName(command: string): string | null {
  for (const matcher of AGENT_MATCHERS) {
    if (!matcher.include.test(command)) {
      continue;
    }

    if (matcher.exclude.some((pattern) => pattern.test(command))) {
      continue;
    }

    return matcher.name;
  }

  return null;
}

function abbreviatePath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  }
  return parts[0] ?? "workspace";
}

function addToHistory(session: AcpSession) {
  const existing = sessionHistory.find((item) => item.key === session.key);
  if (existing) {
    Object.assign(existing, session);
    return;
  }

  sessionHistory.unshift(session);
  if (sessionHistory.length > MAX_HISTORY) {
    sessionHistory.pop();
  }
}

async function getOpenClawConfig(): Promise<OpenClawConfig> {
  const now = Date.now();
  if (configCache && now - configCacheTime < CONFIG_TTL) {
    return configCache;
  }

  const defaults: OpenClawConfig = {
    maxConcurrent: 8,
    defaultAgent: "codex",
    allowedAgents: ["pi", "claude", "codex", "opencode", "gemini", "amp", "devin"],
    ttlMinutes: 120,
    backend: "acpx",
    dispatchEnabled: true,
  };

  try {
    const homedir = process.env.HOME || "/Users/rahulmehta";
    const raw = readFileSync(join(homedir, ".openclaw/openclaw.json"), "utf-8");
    const cfg = JSON.parse(raw) as { acp?: Record<string, unknown> };
    const acp = cfg.acp ?? {};

    const allowedAgents = Array.isArray(acp.allowedAgents)
      ? acp.allowedAgents.filter((item): item is string => typeof item === "string")
      : defaults.allowedAgents;

    const ttlMinutes =
      asSafeNumber((acp.runtime as { ttlMinutes?: unknown } | undefined)?.ttlMinutes) ??
      defaults.ttlMinutes;

    configCache = {
      maxConcurrent: asSafeNumber(acp.maxConcurrentSessions) ?? defaults.maxConcurrent,
      defaultAgent: asSafeString(acp.defaultAgent) || defaults.defaultAgent,
      allowedAgents: allowedAgents.length > 0 ? allowedAgents : defaults.allowedAgents,
      ttlMinutes,
      backend: asSafeString(acp.backend) || defaults.backend,
      dispatchEnabled:
        asSafeBoolean((acp.dispatch as { enabled?: unknown } | undefined)?.enabled) ??
        defaults.dispatchEnabled,
    };
    configCacheTime = now;
    return configCache;
  } catch {
    return defaults;
  }
}

async function getProcessStartTime(pid: string): Promise<string> {
  try {
    const stdout = await runCommand("ps", ["-p", pid, "-o", "lstart="], 2000);
    const value = stdout.trim();
    if (!value) {
      return new Date().toISOString();
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

async function getProcessWorkingDirectory(pid: string): Promise<string | null> {
  try {
    const stdout = await runCommand("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], 2000);
    const cwdLine = stdout
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("n/"));

    if (!cwdLine) {
      return null;
    }

    const cwd = cwdLine.slice(1).trim();
    return cwd || null;
  } catch {
    return null;
  }
}

async function detectRunningAgents(): Promise<AcpSession[]> {
  const sessions: AcpSession[] = [];
  const seenPids = new Set<string>();

  // Layer 1: Detect acpx-managed ACP sessions (primary source)
  // These are spawned by OpenClaw and show up as: acpx ... <agent> prompt --session <key> --cwd <path>
  try {
    const acpxOutput = await runCommand("ps", ["axo", "pid=,lstart=,command="], 5000);
    for (const line of acpxOutput.split("\n")) {
      if (!line.includes("acpx") || !line.includes("prompt --session")) continue;
      if (line.includes("grep")) continue;

      const agentMatch = line.match(/--ttl\s+[\d.]+\s+(\w+)\s+prompt/);
      const sessionMatch = line.match(/--session\s+(agent:\S+)/);
      const cwdMatch = line.match(/--cwd\s+(\S+)/);
      const pid = line.trim().split(/\s+/)[0];

      if (agentMatch && sessionMatch && pid) {
        const agent = agentMatch[1];
        const sessionKey = sessionMatch[1];
        const cwd = cwdMatch?.[1] || "";

        const startedAt = await getProcessStartTime(pid);
        seenPids.add(pid);

        sessions.push({
          id: pid,
          key: sessionKey,
          agent,
          status: "running",
          task: cwd ? `Working in ${abbreviatePath(cwd)}` : "Active ACP session",
          mode: "session",
          startedAt,
          elapsed: "",
          pid,
        });
      }
    }
  } catch {
    // No acpx sessions
  }

  // Layer 2: Detect interactive CLI sessions on a TTY
  try {
    const stdout = await runCommand("ps", ["-axo", "pid=,pcpu=,pmem=,tty=,command="], 4000);
    for (const line of stdout.split("\n")) {
      const snapshot = parseProcessSnapshot(line);
      if (!snapshot) continue;
      if (!snapshot.tty.startsWith("s") || snapshot.tty.includes("?")) continue;
      if (snapshot.cpu <= 0.05 && snapshot.memory <= 0.05) continue;

      const agent = findAgentName(snapshot.command);
      if (!agent || seenPids.has(snapshot.pid)) continue;

      const startedAt = await getProcessStartTime(snapshot.pid);
      const cwd = await getProcessWorkingDirectory(snapshot.pid);
      seenPids.add(snapshot.pid);

      sessions.push({
        id: snapshot.pid,
        key: `agent:${agent}:cli:pid-${snapshot.pid}`,
        agent,
        status: "running",
        task: cwd ? `Working in ${abbreviatePath(cwd)}` : "Interactive CLI session",
        mode: "session",
        startedAt,
        elapsed: "",
        pid: snapshot.pid,
      });
    }
  } catch {
    // No CLI sessions
  }

  return sessions;
}

async function getStoredAcpSessions(): Promise<AcpSession[]> {
  const sessions: AcpSession[] = [];

  try {
    const stdout = await runCommand("openclaw", ["sessions", "--all-agents", "--json"], 8000);
    const data = JSON.parse(stdout) as { sessions?: Array<Record<string, unknown>> };
    const items = Array.isArray(data.sessions) ? data.sessions : [];

    for (const session of items) {
      const key = asSafeString(session.key);
      if (!key.includes("acp")) {
        continue;
      }

      const updatedAt = asSafeString(session.updatedAt);
      const startedAt = updatedAt ? toIsoOrNow(updatedAt) : new Date().toISOString();

      sessions.push({
        id: asSafeString(session.sessionId),
        key,
        agent: key.split(":")[1] || "unknown",
        status: session.abortedLastRun ? "error" : "active",
        task: "",
        mode: "session",
        startedAt,
        elapsed: "",
      });
    }
  } catch {
    // Ignore parse/execution failures and fall back to process-based data.
  }

  return sessions;
}

export async function GET(req: Request) {
  const accessError = ensureLocalAccess(req);
  if (accessError) {
    return accessError;
  }

  const rateLimit = enforceRateLimit(req, {
    bucket: "sessions:get",
    limit: 90,
    windowMs: 60_000,
  });

  if (rateLimit.response) {
    return rateLimit.response;
  }

  if (isDemoMode()) {
    const response = NextResponse.json(getDemoSessions());
    return applyHeaders(response, rateLimit.headers);
  }

  try {
    const config = await getOpenClawConfig();

    let gatewayStatus = "offline";
    let gatewayPid: string | null = null;

    try {
      const resp = await fetch("http://127.0.0.1:18789/", {
        signal: AbortSignal.timeout(2000),
      });
      gatewayStatus = resp.ok ? "online" : "degraded";
    } catch {
      gatewayStatus = "offline";
    }

    try {
      const pidOutput = await runCommand("pgrep", ["-f", "openclaw.*gateway"], 3000);
      gatewayPid =
        pidOutput
          .split("\n")
          .map((line) => line.trim())
          .find(Boolean) ?? null;
    } catch {
      gatewayPid = null;
    }

    const processSessions = await detectRunningAgents();
    const storedSessions = await getStoredAcpSessions();

    const sessions = [...processSessions];
    for (const stored of storedSessions) {
      if (!sessions.find((item) => item.key === stored.key)) {
        sessions.push(stored);
      }
    }

    for (const session of sessions) {
      addToHistory(session);
    }

    const activeKeys = new Set(sessions.map((session) => session.key));
    const history = sessionHistory
      .filter((session) => !activeKeys.has(session.key))
      .slice(0, 10);

    const response = NextResponse.json({
      gateway: { status: gatewayStatus, pid: gatewayPid, port: 18789 },
      sessions,
      history,
      timestamp: new Date().toISOString(),
      config,
    });

    return applyHeaders(response, rateLimit.headers);
  } catch {
    const response = NextResponse.json(
      { error: "Failed to fetch session data" },
      { status: 500 }
    );
    return applyHeaders(response, rateLimit.headers);
  }
}
