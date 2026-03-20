import { NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  applyHeaders,
  enforceRateLimit,
  ensureApiToken,
  ensureLocalAccess,
  ensureTrustedOrigin,
} from "@/lib/api-security";
import { isDemoMode, getDemoConfig } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

const CONFIG_PATH = join(process.cwd(), "dashboard.config.json");
const MAX_BODY_BYTES = 16 * 1024;

interface DashboardConfig {
  branding: {
    title: string;
    subtitle: string;
    version: string;
  };
  refresh: {
    intervalMs: number;
    sessionHistoryLimit: number;
  };
  notifications: {
    sound: boolean;
    onComplete: boolean;
    onError: boolean;
    volume: number;
  };
  display: {
    showHistory: boolean;
    historyLimit: number;
    compactMode: boolean;
  };
}

const DEFAULT_CONFIG: DashboardConfig = {
  branding: {
    title: "ACP MISSION CONTROL",
    subtitle: "OPENCLAW AGENT DISPATCH SYSTEM",
    version: "0.1.0",
  },
  refresh: {
    intervalMs: 3000,
    sessionHistoryLimit: 20,
  },
  notifications: {
    sound: true,
    onComplete: true,
    onError: true,
    volume: 0.3,
  },
  display: {
    showHistory: true,
    historyLimit: 10,
    compactMode: false,
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneConfig(config: DashboardConfig): DashboardConfig {
  return {
    branding: { ...config.branding },
    refresh: { ...config.refresh },
    notifications: { ...config.notifications },
    display: { ...config.display },
  };
}

function validateString(
  value: unknown,
  field: string,
  minLength: number,
  maxLength: number,
  errors: string[]
): string | undefined {
  if (typeof value !== "string") {
    errors.push(`${field} must be a string`);
    return undefined;
  }

  const trimmed = value.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    errors.push(`${field} must be between ${minLength} and ${maxLength} characters`);
    return undefined;
  }

  return trimmed;
}

function validateInteger(
  value: unknown,
  field: string,
  min: number,
  max: number,
  errors: string[]
): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    errors.push(`${field} must be an integer`);
    return undefined;
  }

  if (value < min || value > max) {
    errors.push(`${field} must be between ${min} and ${max}`);
    return undefined;
  }

  return value;
}

function validateNumber(
  value: unknown,
  field: string,
  min: number,
  max: number,
  errors: string[]
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push(`${field} must be a number`);
    return undefined;
  }

  if (value < min || value > max) {
    errors.push(`${field} must be between ${min} and ${max}`);
    return undefined;
  }

  return value;
}

function validateBoolean(value: unknown, field: string, errors: string[]): boolean | undefined {
  if (typeof value !== "boolean") {
    errors.push(`${field} must be a boolean`);
    return undefined;
  }

  return value;
}

function validateAndMergeConfig(
  current: DashboardConfig,
  updates: unknown
): { config: DashboardConfig; errors: string[] } {
  const next = cloneConfig(current);
  const errors: string[] = [];

  if (!isRecord(updates)) {
    return { config: next, errors: ["Request body must be a JSON object"] };
  }

  const topLevelAllowed = new Set(["branding", "refresh", "notifications", "display"]);
  for (const key of Object.keys(updates)) {
    if (!topLevelAllowed.has(key)) {
      errors.push(`Unknown top-level key: ${key}`);
    }
  }

  if (updates.branding !== undefined) {
    if (!isRecord(updates.branding)) {
      errors.push("branding must be an object");
    } else {
      const allowed = new Set(["title", "subtitle", "version"]);
      for (const key of Object.keys(updates.branding)) {
        if (!allowed.has(key)) {
          errors.push(`Unknown branding key: ${key}`);
        }
      }

      if ("title" in updates.branding) {
        const value = validateString(
          updates.branding.title,
          "branding.title",
          1,
          80,
          errors
        );
        if (value !== undefined) {
          next.branding.title = value;
        }
      }

      if ("subtitle" in updates.branding) {
        const value = validateString(
          updates.branding.subtitle,
          "branding.subtitle",
          1,
          160,
          errors
        );
        if (value !== undefined) {
          next.branding.subtitle = value;
        }
      }

      if ("version" in updates.branding) {
        const value = validateString(
          updates.branding.version,
          "branding.version",
          1,
          20,
          errors
        );
        if (value !== undefined) {
          next.branding.version = value;
        }
      }
    }
  }

  if (updates.refresh !== undefined) {
    if (!isRecord(updates.refresh)) {
      errors.push("refresh must be an object");
    } else {
      const allowed = new Set(["intervalMs", "sessionHistoryLimit"]);
      for (const key of Object.keys(updates.refresh)) {
        if (!allowed.has(key)) {
          errors.push(`Unknown refresh key: ${key}`);
        }
      }

      if ("intervalMs" in updates.refresh) {
        const value = validateInteger(
          updates.refresh.intervalMs,
          "refresh.intervalMs",
          1000,
          60000,
          errors
        );
        if (value !== undefined) {
          next.refresh.intervalMs = value;
        }
      }

      if ("sessionHistoryLimit" in updates.refresh) {
        const value = validateInteger(
          updates.refresh.sessionHistoryLimit,
          "refresh.sessionHistoryLimit",
          1,
          200,
          errors
        );
        if (value !== undefined) {
          next.refresh.sessionHistoryLimit = value;
        }
      }
    }
  }

  if (updates.notifications !== undefined) {
    if (!isRecord(updates.notifications)) {
      errors.push("notifications must be an object");
    } else {
      const allowed = new Set(["sound", "onComplete", "onError", "volume"]);
      for (const key of Object.keys(updates.notifications)) {
        if (!allowed.has(key)) {
          errors.push(`Unknown notifications key: ${key}`);
        }
      }

      if ("sound" in updates.notifications) {
        const value = validateBoolean(
          updates.notifications.sound,
          "notifications.sound",
          errors
        );
        if (value !== undefined) {
          next.notifications.sound = value;
        }
      }

      if ("onComplete" in updates.notifications) {
        const value = validateBoolean(
          updates.notifications.onComplete,
          "notifications.onComplete",
          errors
        );
        if (value !== undefined) {
          next.notifications.onComplete = value;
        }
      }

      if ("onError" in updates.notifications) {
        const value = validateBoolean(
          updates.notifications.onError,
          "notifications.onError",
          errors
        );
        if (value !== undefined) {
          next.notifications.onError = value;
        }
      }

      if ("volume" in updates.notifications) {
        const value = validateNumber(
          updates.notifications.volume,
          "notifications.volume",
          0,
          1,
          errors
        );
        if (value !== undefined) {
          next.notifications.volume = value;
        }
      }
    }
  }

  if (updates.display !== undefined) {
    if (!isRecord(updates.display)) {
      errors.push("display must be an object");
    } else {
      const allowed = new Set(["showHistory", "historyLimit", "compactMode"]);
      for (const key of Object.keys(updates.display)) {
        if (!allowed.has(key)) {
          errors.push(`Unknown display key: ${key}`);
        }
      }

      if ("showHistory" in updates.display) {
        const value = validateBoolean(updates.display.showHistory, "display.showHistory", errors);
        if (value !== undefined) {
          next.display.showHistory = value;
        }
      }

      if ("historyLimit" in updates.display) {
        const value = validateInteger(
          updates.display.historyLimit,
          "display.historyLimit",
          1,
          100,
          errors
        );
        if (value !== undefined) {
          next.display.historyLimit = value;
        }
      }

      if ("compactMode" in updates.display) {
        const value = validateBoolean(updates.display.compactMode, "display.compactMode", errors);
        if (value !== undefined) {
          next.display.compactMode = value;
        }
      }
    }
  }

  return { config: next, errors };
}

function readConfig(): DashboardConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    const result = validateAndMergeConfig(DEFAULT_CONFIG, parsed);
    return result.config;
  } catch {
    return cloneConfig(DEFAULT_CONFIG);
  }
}

export async function GET(req: Request) {
  const accessError = ensureLocalAccess(req);
  if (accessError) {
    return accessError;
  }

  const tokenError = ensureApiToken(req);
  if (tokenError) {
    return tokenError;
  }

  const rateLimit = enforceRateLimit(req, {
    bucket: "config:get",
    limit: 120,
    windowMs: 60_000,
  });

  if (rateLimit.response) {
    return rateLimit.response;
  }

  if (isDemoMode()) {
    const response = NextResponse.json(getDemoConfig());
    return applyHeaders(response, rateLimit.headers);
  }

  const response = NextResponse.json(readConfig());
  return applyHeaders(response, rateLimit.headers);
}

export async function POST(req: Request) {
  const accessError = ensureLocalAccess(req);
  if (accessError) {
    return accessError;
  }

  const originError = ensureTrustedOrigin(req);
  if (originError) {
    return originError;
  }

  const tokenError = ensureApiToken(req);
  if (tokenError) {
    return tokenError;
  }

  const rateLimit = enforceRateLimit(req, {
    bucket: "config:post",
    limit: 20,
    windowMs: 60_000,
  });

  if (rateLimit.response) {
    return rateLimit.response;
  }

  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    const response = NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 }
    );
    return applyHeaders(response, rateLimit.headers);
  }

  const contentLengthHeader = req.headers.get("content-length");
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
      const updates = await req.json();
      const merged = validateAndMergeConfig(getDemoConfig() as DashboardConfig, updates);
      const response = NextResponse.json({ ok: true, config: merged.config });
      return applyHeaders(response, rateLimit.headers);
    } catch {
      const response = NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      return applyHeaders(response, rateLimit.headers);
    }
  }

  try {
    const updates = await req.json();
    const current = readConfig();
    const merged = validateAndMergeConfig(current, updates);

    if (merged.errors.length > 0) {
      const response = NextResponse.json(
        { error: "Invalid configuration payload", details: merged.errors },
        { status: 400 }
      );
      return applyHeaders(response, rateLimit.headers);
    }

    writeFileSync(CONFIG_PATH, JSON.stringify(merged.config, null, 2), {
      mode: 0o600,
    });

    const response = NextResponse.json({ ok: true, config: merged.config });
    return applyHeaders(response, rateLimit.headers);
  } catch {
    const response = NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    return applyHeaders(response, rateLimit.headers);
  }
}
