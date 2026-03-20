import { NextRequest, NextResponse } from "next/server";
import { execFile, spawn } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { promisify } from "util";
import {
  applyHeaders,
  enforceRateLimit,
  ensureApiToken,
  ensureLocalAccess,
} from "@/lib/api-security";
import { isDemoMode, getDemoStreamLines } from "@/lib/demo-data";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 256 * 1024;

export const dynamic = "force-dynamic";

function isValidSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9:._-]{1,160}$/.test(sessionId);
}

function extractPid(sessionId: string): string | null {
  const match = sessionId.match(/pid-(\d{1,10})$/);
  return match ? match[1] : null;
}

function isSpawnSessionId(sessionId: string): boolean {
  return /^spawn-[a-z0-9_-]+-pid-\d{1,10}$/i.test(sessionId);
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const accessError = ensureLocalAccess(request);
  if (accessError) {
    return accessError;
  }

  const tokenError = ensureApiToken(request);
  if (tokenError) {
    return tokenError;
  }

  const rateLimit = enforceRateLimit(request, {
    bucket: "stream:get",
    limit: 40,
    windowMs: 60_000,
  });

  if (rateLimit.response) {
    return rateLimit.response;
  }

  const { sessionId } = await params;
  if (!isValidSessionId(sessionId)) {
    const response = NextResponse.json({ error: "Invalid sessionId format" }, { status: 400 });
    return applyHeaders(response, rateLimit.headers);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const cleanups: Array<() => void> = [];

      const closeStream = () => {
        if (closed) {
          return;
        }
        closed = true;

        for (const cleanup of cleanups) {
          try {
            cleanup();
          } catch {
            // Ignore cleanup errors.
          }
        }

        try {
          controller.close();
        } catch {
          // Ignore close errors.
        }
      };

      const send = (payload: Record<string, unknown>) => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const abortHandler = () => closeStream();
      request.signal.addEventListener("abort", abortHandler);
      cleanups.push(() => request.signal.removeEventListener("abort", abortHandler));

      void (async () => {
        send({ type: "connected", sessionId, timestamp: new Date().toISOString() });

        if (isDemoMode()) {
          const lines = getDemoStreamLines();
          let i = 0;
          const emit = () => {
            if (closed || i >= lines.length) {
              if (!closed) {
                const hb = setInterval(() => {
                  send({ type: "heartbeat", timestamp: new Date().toISOString() });
                }, 10_000);
                cleanups.push(() => clearInterval(hb));
              }
              return;
            }
            send(lines[i]);
            i++;
            const delay = 400 + Math.random() * 600;
            const timer = setTimeout(emit, delay);
            cleanups.push(() => clearTimeout(timer));
          };
          emit();
          return;
        }

        if (isSpawnSessionId(sessionId)) {
          const logPath = resolve("/tmp", `acp-${sessionId}.log`);
          if (logPath.startsWith("/tmp/") && existsSync(logPath)) {
            const tail = spawn("tail", ["-n", "50", "-F", logPath], {
              stdio: ["ignore", "pipe", "pipe"],
            });

            const onStdout = (chunk: Buffer) => {
              const lines = chunk
                .toString("utf8")
                .split("\n")
                .map((line) => line.trimEnd())
                .filter(Boolean);

              for (const line of lines) {
                send({ type: "output", line, timestamp: new Date().toISOString() });
              }
            };

            const onStderr = (chunk: Buffer) => {
              send({
                type: "error",
                line: chunk.toString("utf8"),
                timestamp: new Date().toISOString(),
              });
            };

            const onExit = () => {
              send({ type: "exit", timestamp: new Date().toISOString() });
              closeStream();
            };

            tail.stdout.on("data", onStdout);
            tail.stderr.on("data", onStderr);
            tail.once("exit", onExit);

            cleanups.push(() => {
              tail.stdout.off("data", onStdout);
              tail.stderr.off("data", onStderr);
              tail.removeListener("exit", onExit);
              tail.kill();
            });

            return;
          }
        }

        const pid = extractPid(sessionId);
        if (pid && (await isManagedAcpProcess(pid))) {
          send({
            type: "info",
            line: `Monitoring process ${pid}`,
            timestamp: new Date().toISOString(),
          });

          let polling = false;
          const interval = setInterval(async () => {
            if (polling || closed) {
              return;
            }
            polling = true;

            try {
              process.kill(Number(pid), 0);
              const stats = (
                await runCommand("ps", ["-p", pid, "-o", "%cpu=,%mem=,etime="], 2000)
              ).trim();

              if (stats) {
                send({ type: "stats", data: stats, timestamp: new Date().toISOString() });
              }
            } catch {
              send({
                type: "exit",
                line: `Process ${pid} has exited`,
                timestamp: new Date().toISOString(),
              });
              clearInterval(interval);
              closeStream();
            } finally {
              polling = false;
            }
          }, 2000);

          cleanups.push(() => clearInterval(interval));
          return;
        }

        send({
          type: "info",
          line: "Stream connected. Monitoring session...",
          timestamp: new Date().toISOString(),
        });

        const heartbeat = setInterval(() => {
          send({ type: "heartbeat", timestamp: new Date().toISOString() });
        }, 10_000);

        cleanups.push(() => clearInterval(heartbeat));
      })().catch(() => {
        send({
          type: "error",
          line: "Stream initialization failed",
          timestamp: new Date().toISOString(),
        });
        closeStream();
      });
    },
    cancel() {
      // Request abort listener handles cleanup.
    },
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
