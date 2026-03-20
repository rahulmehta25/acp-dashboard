import { NextResponse } from "next/server";

const API_TOKEN =
  process.env.ACP_DASHBOARD_API_TOKEN || process.env.ACP_API_TOKEN || "";
const TRUST_PROXY_HEADERS = process.env.ACP_DASHBOARD_TRUST_PROXY === "true";
function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const MAX_RATE_LIMIT_KEYS = 5000;

interface RateLimitOptions {
  bucket: string;
  limit: number;
  windowMs: number;
}

interface RateLimitResult {
  response: NextResponse | null;
  headers: Record<string, string>;
}

export function ensureLocalAccess(request: Request): NextResponse | null {
  if (isDemoMode() || process.env.ACP_DASHBOARD_ALLOW_REMOTE === "true") {
    return null;
  }

  const host = getRequestHostHeader(request);
  if (!host) {
    return NextResponse.json({ error: "Missing host header" }, { status: 400 });
  }

  const normalizedHost = normalizeHost(host);
  if (
    normalizedHost === "localhost" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1"
  ) {
    return null;
  }

  return NextResponse.json(
    {
      error:
        "Access denied: local only. Set ACP_DASHBOARD_ALLOW_REMOTE=true for remote access.",
    },
    { status: 403 }
  );
}

export function ensureTrustedOrigin(request: Request): NextResponse | null {
  if (isDemoMode()) return null;

  const origin = request.headers.get("origin") || "";
  if (!origin) {
    return null;
  }

  const requestHostHeader = getRequestHostHeader(request);
  if (!requestHostHeader) {
    return NextResponse.json({ error: "Missing host header" }, { status: 400 });
  }

  let originHost = "";
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid origin header" }, { status: 400 });
  }

  const requestHost = requestHostHeader.split(",")[0].trim().toLowerCase();
  if (originHost !== requestHost) {
    return NextResponse.json({ error: "Untrusted origin" }, { status: 403 });
  }

  return null;
}

export function ensureApiToken(request: Request): NextResponse | null {
  if (isDemoMode() || !API_TOKEN) {
    return null;
  }

  const auth = request.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const headerToken = request.headers.get("x-acp-token") || "";

  if (bearer === API_TOKEN || headerToken === API_TOKEN) {
    return null;
  }

  return NextResponse.json({ error: "Invalid API token" }, { status: 401 });
}

export function enforceRateLimit(request: Request, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  if (rateLimitStore.size > MAX_RATE_LIMIT_KEYS) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt <= now) {
        rateLimitStore.delete(key);
      }
    }
  }

  const ip = getClientAddress(request);
  const key = `${options.bucket}:${ip}`;

  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + options.windowMs };
    rateLimitStore.set(key, entry);
  }

  entry.count++;
  const remaining = Math.max(0, options.limit - entry.count);
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(options.limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
  };

  if (entry.count > options.limit) {
    const response = NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
    response.headers.set("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
    return { response, headers };
  }

  return { response: null, headers };
}

function normalizeHost(hostHeader: string): string {
  const first = hostHeader.split(",")[0].trim().toLowerCase();

  if (first.startsWith("[")) {
    const closingIndex = first.indexOf("]");
    if (closingIndex > 0) {
      return first.slice(1, closingIndex);
    }
  }

  return first.split(":")[0];
}

function getRequestHostHeader(request: Request): string {
  if (TRUST_PROXY_HEADERS) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    if (forwardedHost) {
      return forwardedHost;
    }
  }

  return request.headers.get("host") || "";
}

function getClientAddress(request: Request): string {
  if (TRUST_PROXY_HEADERS) {
    const forwardedFor = request.headers.get("x-forwarded-for");
    if (forwardedFor) {
      const first = forwardedFor.split(",")[0]?.trim();
      if (first) {
        return first;
      }
    }

    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp) {
      return realIp;
    }
  }

  return "local";
}

export function applyHeaders(response: NextResponse, headers: Record<string, string>): NextResponse {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
