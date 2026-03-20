import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { closeSync, existsSync, openSync, renameSync, statSync } from "fs";
import { resolve } from "path";
import {
  applyHeaders,
  enforceRateLimit,
  ensureApiToken,
  ensureLocalAccess,
  ensureTrustedOrigin,
} from "@/lib/api-security";
import { isDemoMode, getDemoSpawnResult } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

interface SpawnRequest {
  agent: string;
  task: string;
  mode: "one-shot" | "persistent";
  workingDirectory?: string;
}

const ALLOWED_AGENTS = new Set(["codex", "claude", "gemini", "pi", "opencode", "amp", "devin"]);
const MAX_BODY_BYTES = 32 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeTask(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const task = value.trim();
  if (!task || task.length > 4000) {
    return null;
  }

  return task;
}

function isWithinAllowedRoots(pathname: string): boolean {
  const allowedRoots = [process.cwd(), process.env.HOME].filter(
    (value): value is string => Boolean(value)
  );

  return allowedRoots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function resolveWorkingDirectory(value: unknown): string | null {
  if (value === undefined) {
    return process.cwd();
  }

  if (typeof value !== "string" || value.trim().length === 0 || value.length > 400) {
    return null;
  }

  const resolved = resolve(value);
  if (!isWithinAllowedRoots(resolved)) {
    return null;
  }

  if (!existsSync(resolved)) {
    return null;
  }

  try {
    if (!statSync(resolved).isDirectory()) {
      return null;
    }
  } catch {
    return null;
  }

  return resolved;
}

function normalizeRequestBody(raw: unknown): SpawnRequest | null {
  if (!isRecord(raw)) {
    return null;
  }

  if (typeof raw.agent !== "string" || !ALLOWED_AGENTS.has(raw.agent)) {
    return null;
  }

  const task = sanitizeTask(raw.task);
  if (!task) {
    return null;
  }

  const mode = raw.mode === "one-shot" ? "one-shot" : "persistent";
  const workingDirectory = resolveWorkingDirectory(raw.workingDirectory);
  if (!workingDirectory) {
    return null;
  }

  return {
    agent: raw.agent,
    task,
    mode,
    workingDirectory,
  };
}

async function spawnDetachedProcess(
  command: string,
  args: string[],
  cwd: string,
  logPath: string
): Promise<number> {
  return new Promise((resolvePid, reject) => {
    const logFd = openSync(logPath, "a");

    const child = spawn(command, args, {
      cwd,
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });

    closeSync(logFd);

    child.once("error", (error) => {
      reject(error);
    });

    child.once("spawn", () => {
      if (!child.pid) {
        reject(new Error("Spawn failed"));
        return;
      }
      child.unref();
      resolvePid(child.pid);
    });
  });
}

function buildAgentFallback(agent: string, task: string): { command: string; args: string[] } {
  const map: Record<string, string> = {
    claude: "claude",
    codex: "codex",
    gemini: "gemini",
    opencode: "opencode",
    pi: "pi",
    amp: "amp",
    devin: "devin",
  };

  return {
    command: map[agent] ?? agent,
    args: ["--print", task],
  };
}

export async function POST(request: Request) {
  const accessError = ensureLocalAccess(request);
  if (accessError) {
    return accessError;
  }

  const originError = ensureTrustedOrigin(request);
  if (originError) {
    return originError;
  }

  const tokenError = ensureApiToken(request);
  if (tokenError) {
    return tokenError;
  }

  const rateLimit = enforceRateLimit(request, {
    bucket: "spawn:post",
    limit: 10,
    windowMs: 60_000,
  });

  if (rateLimit.response) {
    return rateLimit.response;
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    const response = NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
    return applyHeaders(response, rateLimit.headers);
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      const response = NextResponse.json(
        { error: `Payload too large. Max ${MAX_BODY_BYTES} bytes.` },
        { status: 413 }
      );
      return applyHeaders(response, rateLimit.headers);
    }
  }

  if (isDemoMode()) {
    try {
      const rawBody = await request.json();
      if (!isRecord(rawBody) || typeof rawBody.agent !== "string" || !ALLOWED_AGENTS.has(rawBody.agent)) {
        const response = NextResponse.json({ error: "Invalid agent" }, { status: 400 });
        return applyHeaders(response, rateLimit.headers);
      }
      const task = sanitizeTask(rawBody.task);
      if (!task) {
        const response = NextResponse.json({ error: "Invalid task" }, { status: 400 });
        return applyHeaders(response, rateLimit.headers);
      }
      const mode = rawBody.mode === "one-shot" ? "one-shot" : "persistent";
      const response = NextResponse.json(getDemoSpawnResult(rawBody.agent, task, mode));
      return applyHeaders(response, rateLimit.headers);
    } catch {
      const response = NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      return applyHeaders(response, rateLimit.headers);
    }
  }

  try {
    const rawBody = await request.json();
    const body = normalizeRequestBody(rawBody);
    if (!body) {
      const response = NextResponse.json(
        {
          error:
            "Invalid payload. Expected agent, task, mode, and optional workingDirectory within allowed roots.",
        },
        { status: 400 }
      );
      return applyHeaders(response, rateLimit.headers);
    }

    const cwd = body.workingDirectory || process.cwd();

    try {
      const openClawArgs = ["acp", "client", "--agent", body.agent];
      if (body.mode === "one-shot") {
        openClawArgs.push("--one-shot");
      }
      openClawArgs.push("--task", body.task);

      const tempSessionId = `spawn-${body.agent}-${Date.now()}`;
      const openClawLogPath = resolve("/tmp", `acp-${tempSessionId}.log`);
      const pid = await spawnDetachedProcess("openclaw", openClawArgs, cwd, openClawLogPath);

      const sessionId = `spawn-${body.agent}-pid-${pid}`;
      const finalLogPath = resolve("/tmp", `acp-${sessionId}.log`);
      try {
        renameSync(openClawLogPath, finalLogPath);
      } catch {
        // If rename fails, the temp file still contains logs.
      }

      const response = NextResponse.json({
        success: true,
        sessionId,
        pid,
        agent: body.agent,
        task: body.task,
        mode: body.mode,
        workingDirectory: cwd,
        message: `${body.agent} session spawned successfully`,
      });
      return applyHeaders(response, rateLimit.headers);
    } catch {
      const fallback = buildAgentFallback(body.agent, body.task);
      const tempSessionId = `spawn-${body.agent}-${Date.now()}`;
      const tempLogPath = resolve("/tmp", `acp-${tempSessionId}.log`);
      const pid = await spawnDetachedProcess(fallback.command, fallback.args, cwd, tempLogPath);
      const fallbackSessionId = `spawn-${body.agent}-pid-${pid}`;
      const finalLogPath = resolve("/tmp", `acp-${fallbackSessionId}.log`);
      try {
        renameSync(tempLogPath, finalLogPath);
      } catch {
        // If rename fails, the temp file still contains logs.
      }

      const response = NextResponse.json({
        success: true,
        sessionId: fallbackSessionId,
        pid,
        agent: body.agent,
        task: body.task,
        mode: body.mode,
        message: `${body.agent} session spawned (direct CLI fallback)`,
      });
      return applyHeaders(response, rateLimit.headers);
    }
  } catch {
    const response = NextResponse.json(
      { error: "Failed to spawn agent session" },
      { status: 500 }
    );
    return applyHeaders(response, rateLimit.headers);
  }
}
