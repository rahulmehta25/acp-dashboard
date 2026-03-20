import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { writeFile } from "fs/promises";
import { promisify } from "util";
import {
  applyHeaders,
  enforceRateLimit,
  ensureApiToken,
  ensureLocalAccess,
  ensureTrustedOrigin,
} from "@/lib/api-security";
import { isDemoMode } from "@/lib/demo-data";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 512 * 1024;
const MAX_INSTRUCTION_LENGTH = 4000;

export const dynamic = "force-dynamic";

function isValidSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9:._-]{1,160}$/.test(sessionId);
}

function extractPid(sessionId: string): string | null {
  const pidMatch = sessionId.match(/pid-(\d{1,10})$/);
  return pidMatch ? pidMatch[1] : null;
}

async function runCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    timeout: timeoutMs,
    maxBuffer: MAX_BUFFER,
  });
  return stdout ?? "";
}

async function isManagedAcpProcess(pid: string): Promise<boolean> {
  try {
    const commandLine = (await runCommand("ps", ["-p", pid, "-o", "command="], 2000)).trim();
    if (!commandLine) {
      return false;
    }

    const isKnownAgent = /\b(openclaw|codex|claude|gemini|opencode|pi)\b/i.test(commandLine);
    const looksLikeAcp = /\bacp\b/i.test(commandLine) || /\bagent\b/i.test(commandLine);
    return isKnownAgent && looksLikeAcp;
  } catch {
    return false;
  }
}

async function sendToProcessTty(pid: string, instruction: string): Promise<string | null> {
  try {
    const tty = (await runCommand("ps", ["-p", pid, "-o", "tty="], 2000)).trim();
    if (!/^s\d+$/.test(tty)) {
      return null;
    }

    const ttyPath = `/dev/${tty}`;
    await writeFile(ttyPath, `${instruction}\n`, { encoding: "utf8" });
    return tty;
  } catch {
    return null;
  }
}

function validateInstruction(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_INSTRUCTION_LENGTH) {
    return null;
  }

  return trimmed;
}

function checkMutationGuards(
  request: Request,
  bucket: string,
  limit: number
): { response?: NextResponse; headers: Record<string, string> } {
  const accessError = ensureLocalAccess(request);
  if (accessError) {
    return { response: accessError, headers: {} };
  }

  const originError = ensureTrustedOrigin(request);
  if (originError) {
    return { response: originError, headers: {} };
  }

  const tokenError = ensureApiToken(request);
  if (tokenError) {
    return { response: tokenError, headers: {} };
  }

  const rateLimit = enforceRateLimit(request, {
    bucket,
    limit,
    windowMs: 60_000,
  });

  if (rateLimit.response) {
    return { response: rateLimit.response, headers: rateLimit.headers };
  }

  return { headers: rateLimit.headers };
}

function ensureValidSessionIdResponse(sessionId: string): NextResponse | null {
  if (!isValidSessionId(sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId format" }, { status: 400 });
  }

  return null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const guard = checkMutationGuards(request, "sessions:put", 30);
  if (guard.response) {
    return guard.response;
  }

  const { sessionId } = await params;
  const sessionError = ensureValidSessionIdResponse(sessionId);
  if (sessionError) {
    return applyHeaders(sessionError, guard.headers);
  }

  if (isDemoMode()) {
    const response = NextResponse.json({
      success: true,
      message: `Instruction sent to session ${sessionId} (demo)`,
    });
    return applyHeaders(response, guard.headers);
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    const response = NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
    return applyHeaders(response, guard.headers);
  }

  try {
    const body = await request.json();
    const instruction = validateInstruction((body as Record<string, unknown>)?.instruction);

    if (!instruction) {
      const response = NextResponse.json(
        {
          error: `Instruction is required and must be <= ${MAX_INSTRUCTION_LENGTH} characters`,
        },
        { status: 400 }
      );
      return applyHeaders(response, guard.headers);
    }

    const pid = extractPid(sessionId);
    if (pid && (await isManagedAcpProcess(pid))) {
      const tty = await sendToProcessTty(pid, instruction);
      if (tty) {
        const response = NextResponse.json({
          success: true,
          message: `Instruction sent to session ${sessionId} via ${tty}`,
          pid,
        });
        return applyHeaders(response, guard.headers);
      }
    }

    try {
      await runCommand(
        "openclaw",
        ["acp", "steer", "--session", sessionId, "--message", instruction],
        10_000
      );

      const response = NextResponse.json({
        success: true,
        message: "Instruction sent via openclaw CLI",
      });
      return applyHeaders(response, guard.headers);
    } catch {
      const response = NextResponse.json(
        {
          success: false,
          message: "Could not deliver instruction. Session may not support steering.",
        },
        { status: 404 }
      );
      return applyHeaders(response, guard.headers);
    }
  } catch {
    const response = NextResponse.json({ error: "Failed to steer session" }, { status: 500 });
    return applyHeaders(response, guard.headers);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const guard = checkMutationGuards(request, "sessions:patch", 30);
  if (guard.response) {
    return guard.response;
  }

  const { sessionId } = await params;
  const sessionError = ensureValidSessionIdResponse(sessionId);
  if (sessionError) {
    return applyHeaders(sessionError, guard.headers);
  }

  if (isDemoMode()) {
    const response = NextResponse.json({
      success: true,
      message: `Cancel signal sent to session ${sessionId} (demo)`,
    });
    return applyHeaders(response, guard.headers);
  }

  try {
    const pid = extractPid(sessionId);
    if (pid && (await isManagedAcpProcess(pid))) {
      process.kill(Number(pid), "SIGINT");
      const response = NextResponse.json({
        success: true,
        message: `Cancel signal sent to session ${sessionId} (PID: ${pid})`,
      });
      return applyHeaders(response, guard.headers);
    }

    await runCommand("openclaw", ["acp", "cancel", "--session", sessionId], 10_000);
    const response = NextResponse.json({
      success: true,
      message: "Cancel sent via openclaw CLI",
    });
    return applyHeaders(response, guard.headers);
  } catch {
    const response = NextResponse.json(
      {
        success: false,
        message: "Could not cancel. Process or session not found.",
      },
      { status: 404 }
    );
    return applyHeaders(response, guard.headers);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const guard = checkMutationGuards(request, "sessions:delete", 20);
  if (guard.response) {
    return guard.response;
  }

  const { sessionId } = await params;
  const sessionError = ensureValidSessionIdResponse(sessionId);
  if (sessionError) {
    return applyHeaders(sessionError, guard.headers);
  }

  if (isDemoMode()) {
    const response = NextResponse.json({
      success: true,
      message: `Session ${sessionId} terminated (demo)`,
    });
    return applyHeaders(response, guard.headers);
  }

  try {
    const pid = extractPid(sessionId);
    if (pid && (await isManagedAcpProcess(pid))) {
      const processId = Number(pid);
      process.kill(processId, "SIGTERM");

      setTimeout(() => {
        try {
          process.kill(processId, 0);
          process.kill(processId, "SIGKILL");
        } catch {
          // Process already exited.
        }
      }, 2000);

      const response = NextResponse.json({
        success: true,
        message: `Session ${sessionId} terminated (PID: ${pid})`,
      });
      return applyHeaders(response, guard.headers);
    }

    await runCommand("openclaw", ["acp", "close", "--session", sessionId], 10_000);
    const response = NextResponse.json({
      success: true,
      message: "Session closed via openclaw CLI",
    });
    return applyHeaders(response, guard.headers);
  } catch {
    const response = NextResponse.json(
      {
        success: false,
        message: "Could not close. Session not found.",
      },
      { status: 404 }
    );
    return applyHeaders(response, guard.headers);
  }
}
