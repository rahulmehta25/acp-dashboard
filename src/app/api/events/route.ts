import { NextRequest } from "next/server";
import { execFile } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import { promisify } from "util";
import {
  enforceRateLimit,
  ensureApiToken,
  ensureLocalAccess,
} from "@/lib/api-security";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 1024 * 1024;

export const dynamic = "force-dynamic";

const AGENT_MATCHERS: Array<{ name: string; include: RegExp; exclude: RegExp[] }> = [
  { name: "claude", include: /\bclaude\b/i, exclude: [/Claude\.app/i, /claude-mem/i] },
  { name: "codex", include: /\bcodex\b/i, exclude: [/node_modules/i] },
  { name: "gemini", include: /\bgemini\b/i, exclude: [] },
  { name: "pi", include: /\bpi\b/i, exclude: [] },
  { name: "opencode", include: /\bopencode\b/i, exclude: [] },
  { name: "amp", include: /\bamp\b/i, exclude: [/amplif/i, /ample/i] },
  { name: "devin", include: /\bdevin\b/i, exclude: [] },
];

async function runCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    timeout: timeoutMs,
    maxBuffer: MAX_BUFFER,
  });
  return stdout ?? "";
}

function findAgentName(command: string): string | null {
  for (const matcher of AGENT_MATCHERS) {
    if (!matcher.include.test(command)) continue;
    if (matcher.exclude.some((p) => p.test(command))) continue;
    return matcher.name;
  }
  return null;
}

function abbreviatePath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length >= 2) return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
  return parts[0] ?? "workspace";
}

interface SessionSnapshot {
  id: string;
  key: string;
  agent: string;
  status: string;
  task: string;
  mode: string;
  startedAt: string;
  elapsed: string;
  pid?: string;
  cwd?: string;
}

async function collectSnapshot(): Promise<{
  gateway: { status: string; pid: string | null; port: number };
  sessions: SessionSnapshot[];
  timestamp: string;
  config: { maxConcurrent: number; defaultAgent: string; allowedAgents: string[]; ttlMinutes: number; backend: string; dispatchEnabled: boolean };
}> {
  const defaults = {
    maxConcurrent: 8,
    defaultAgent: "codex",
    allowedAgents: ["pi", "claude", "codex", "opencode", "gemini", "amp", "devin"],
    ttlMinutes: 120,
    backend: "acpx",
    dispatchEnabled: true,
  };

  let config = defaults;
  try {
    const homedir = process.env.HOME || "/Users/rahulmehta";
    const raw = readFileSync(join(homedir, ".openclaw/openclaw.json"), "utf-8");
    const cfg = JSON.parse(raw) as { acp?: Record<string, unknown> };
    const acp = cfg.acp ?? {};
    const allowedAgents = Array.isArray(acp.allowedAgents)
      ? acp.allowedAgents.filter((item): item is string => typeof item === "string")
      : defaults.allowedAgents;
    config = {
      maxConcurrent: typeof acp.maxConcurrentSessions === "number" ? acp.maxConcurrentSessions : defaults.maxConcurrent,
      defaultAgent: typeof acp.defaultAgent === "string" ? acp.defaultAgent : defaults.defaultAgent,
      allowedAgents: allowedAgents.length > 0 ? allowedAgents : defaults.allowedAgents,
      ttlMinutes: defaults.ttlMinutes,
      backend: typeof acp.backend === "string" ? acp.backend : defaults.backend,
      dispatchEnabled: defaults.dispatchEnabled,
    };
  } catch { /* use defaults */ }

  let gatewayStatus = "offline";
  let gatewayPid: string | null = null;

  try {
    const resp = await fetch("http://127.0.0.1:18789/", { signal: AbortSignal.timeout(2000) });
    gatewayStatus = resp.ok ? "online" : "degraded";
  } catch { /* offline */ }

  try {
    const pidOutput = await runCommand("pgrep", ["-f", "openclaw.*gateway"], 3000);
    gatewayPid = pidOutput.split("\n").map((l) => l.trim()).find(Boolean) ?? null;
  } catch { /* no pid */ }

  const sessions: SessionSnapshot[] = [];
  const seenPids = new Set<string>();

  // Layer 1: Detect acpx-managed ACP sessions
  try {
    const acpxOutput = await runCommand("ps", ["axo", "pid=,command="], 5000);
    for (const line of acpxOutput.split("\n")) {
      if (!line.includes("acpx") || !line.includes("prompt --session")) continue;
      if (line.includes("grep")) continue;
      const agentMatch = line.match(/--ttl\s+[\d.]+\s+(\w+)\s+prompt/);
      const sessionMatch = line.match(/--session\s+(agent:\S+)/);
      const cwdMatch = line.match(/--cwd\s+(\S+)/);
      const pid = line.trim().split(/\s+/)[0];
      if (agentMatch && sessionMatch && pid) {
        const cwd = cwdMatch?.[1] || "";
        let startedAt = new Date().toISOString();
        try {
          const lstart = (await runCommand("ps", ["-p", pid, "-o", "lstart="], 2000)).trim();
          if (lstart) { const p = new Date(lstart); if (!isNaN(p.getTime())) startedAt = p.toISOString(); }
        } catch { /* use now */ }
        seenPids.add(pid);
        sessions.push({
          id: pid, key: sessionMatch[1], agent: agentMatch[1], status: "running",
          task: cwd ? `Working in ${abbreviatePath(cwd)}` : "Active ACP session",
          mode: "session", startedAt, elapsed: "", pid,
        });
      }
    }
  } catch { /* no acpx sessions */ }

  // Layer 2: Detect interactive CLI sessions on TTY
  try {
    const stdout = await runCommand("ps", ["-axo", "pid=,pcpu=,pmem=,tty=,command="], 4000);
    for (const line of stdout.split("\n")) {
      const match = line.trim().match(/^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.+)$/);
      if (!match) continue;
      const [, pid, cpuRaw, memRaw, tty, command] = match;
      const cpu = parseFloat(cpuRaw);
      const mem = parseFloat(memRaw);
      if (!tty.startsWith("s") || tty.includes("?")) continue;
      if (cpu <= 0.05 && mem <= 0.05) continue;
      const agent = findAgentName(command);
      if (!agent || seenPids.has(pid)) continue;

      let startedAt = new Date().toISOString();
      try {
        const lstart = (await runCommand("ps", ["-p", pid, "-o", "lstart="], 2000)).trim();
        if (lstart) {
          const parsed = new Date(lstart);
          if (!isNaN(parsed.getTime())) startedAt = parsed.toISOString();
        }
      } catch { /* use now */ }

      let cwd: string | undefined;
      try {
        const lsof = await runCommand("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], 2000);
        const cwdLine = lsof.split("\n").map((l) => l.trim()).find((l) => l.startsWith("n/"));
        if (cwdLine) cwd = cwdLine.slice(1).trim();
      } catch { /* no cwd */ }

      sessions.push({
        id: pid,
        key: `agent:${agent}:acp:pid-${pid}`,
        agent,
        status: "running",
        task: cwd ? `Working in ${abbreviatePath(cwd)}` : "Active session",
        mode: "session",
        startedAt,
        elapsed: "",
        pid,
        cwd,
      });
      seenPids.add(pid);
    }
  } catch { /* no processes */ }

  return {
    gateway: { status: gatewayStatus, pid: gatewayPid, port: 18789 },
    sessions,
    timestamp: new Date().toISOString(),
    config,
  };
}

export async function GET(request: NextRequest) {
  const accessError = ensureLocalAccess(request);
  if (accessError) return accessError;

  const tokenError = ensureApiToken(request);
  if (tokenError) return tokenError;

  const rateLimit = enforceRateLimit(request, {
    bucket: "events:get",
    limit: 20,
    windowMs: 60_000,
  });
  if (rateLimit.response) return rateLimit.response;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try { controller.close(); } catch { /* ignore */ }
      };

      request.signal.addEventListener("abort", close);

      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("connected", { timestamp: new Date().toISOString() });

      const poll = async () => {
        if (closed) return;
        try {
          const snapshot = await collectSnapshot();
          send("update", snapshot);
        } catch {
          send("error", { message: "Snapshot failed", timestamp: new Date().toISOString() });
        }
      };

      poll();
      const interval = setInterval(poll, 3000);
    },
    cancel() { /* abort handler cleans up */ },
  });

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
    },
  });

  for (const [header, value] of Object.entries(rateLimit.headers)) {
    response.headers.set(header, value);
  }

  return response;
}
