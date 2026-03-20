import { NextResponse } from "next/server";
import { execFile } from "child_process";
import * as os from "os";
import { promisify } from "util";
import {
  applyHeaders,
  enforceRateLimit,
  ensureApiToken,
  ensureLocalAccess,
} from "@/lib/api-security";
import { isDemoMode, getDemoSystemVitals } from "@/lib/demo-data";

const execFileAsync = promisify(execFile);
const MAX_BUFFER = 128 * 1024;

export const dynamic = "force-dynamic";

async function runCommand(command: string, args: string[], timeoutMs: number): Promise<string> {
  const { stdout } = await execFileAsync(command, args, {
    timeout: timeoutMs,
    maxBuffer: MAX_BUFFER,
  });
  return stdout ?? "";
}

async function getDiskStats(): Promise<{ usage: number; total: string; used: string }> {
  try {
    const stdout = await runCommand("df", ["-k", "/"], 3000);
    const lines = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const payload = lines[lines.length - 1] ?? "";
    const parts = payload.split(/\s+/);

    const totalKb = Number.parseInt(parts[1] ?? "0", 10);
    const usedKb = Number.parseInt(parts[2] ?? "0", 10);
    const usageRaw = parts[4] ?? "0";

    return {
      usage: Number.parseInt(usageRaw.replace("%", ""), 10) || 0,
      total: formatBytes(totalKb * 1024),
      used: formatBytes(usedKb * 1024),
    };
  } catch {
    return { usage: 0, total: "?", used: "?" };
  }
}

async function getProcessCount(): Promise<number> {
  try {
    const stdout = await runCommand("ps", ["-A", "-o", "pid="], 3000);
    return stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean).length;
  } catch {
    return 0;
  }
}

function hasExternalNetworkInterface(): boolean {
  const interfaces = os.networkInterfaces();

  for (const addresses of Object.values(interfaces)) {
    for (const entry of addresses ?? []) {
      if (!entry.internal) {
        return true;
      }
    }
  }

  return false;
}

export async function GET(request: Request) {
  const accessError = ensureLocalAccess(request);
  if (accessError) {
    return accessError;
  }

  const tokenError = ensureApiToken(request);
  if (tokenError) {
    return tokenError;
  }

  const rateLimit = enforceRateLimit(request, {
    bucket: "system:get",
    limit: 60,
    windowMs: 60_000,
  });

  if (rateLimit.response) {
    return rateLimit.response;
  }

  if (isDemoMode()) {
    const response = NextResponse.json(getDemoSystemVitals());
    return applyHeaders(response, rateLimit.headers);
  }

  try {
    const cpus = os.cpus();
    const cpuCount = cpus.length;
    const loadAvg = os.loadavg();

    const cpuUsage = cpuCount > 0
      ? Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100))
      : 0;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = Math.round((usedMem / totalMem) * 100);

    const disk = await getDiskStats();
    const processCount = await getProcessCount();

    const uptime = os.uptime();
    const uptimeHours = Math.floor(uptime / 3600);
    const uptimeMinutes = Math.floor((uptime % 3600) / 60);

    const response = NextResponse.json({
      cpu: {
        usage: cpuUsage,
        cores: cpuCount,
        model: cpus[0]?.model || "Unknown",
      },
      memory: {
        usage: memUsage,
        total: formatBytes(totalMem),
        used: formatBytes(usedMem),
        free: formatBytes(freeMem),
      },
      disk,
      load: {
        avg1: loadAvg[0].toFixed(2),
        avg5: loadAvg[1].toFixed(2),
        avg15: loadAvg[2].toFixed(2),
      },
      uptime: `${uptimeHours}h ${uptimeMinutes}m`,
      network: hasExternalNetworkInterface(),
      processes: processCount,
      timestamp: new Date().toISOString(),
    });

    return applyHeaders(response, rateLimit.headers);
  } catch {
    const response = NextResponse.json({ error: "Failed to get system stats" }, { status: 500 });
    return applyHeaders(response, rateLimit.headers);
  }
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(1)}GB`;
  }

  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(0)}MB`;
  }

  const kb = bytes / 1024;
  return `${kb.toFixed(0)}KB`;
}
