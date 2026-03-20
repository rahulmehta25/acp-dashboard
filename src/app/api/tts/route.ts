import { NextResponse } from "next/server";
import {
  applyHeaders,
  enforceRateLimit,
  ensureApiToken,
  ensureLocalAccess,
  ensureTrustedOrigin,
} from "@/lib/api-security";
import { isDemoMode } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || "";
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";
const MAX_TEXT_LENGTH = 2000;
const MAX_BODY_BYTES = 24 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return null;
  }

  return text;
}

function sanitizeVoiceId(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_VOICE_ID;
  }

  const voiceId = value.trim();
  return /^[a-zA-Z0-9_-]{1,64}$/.test(voiceId) ? voiceId : DEFAULT_VOICE_ID;
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
    bucket: "tts:post",
    limit: 30,
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

  try {
    const payload = await request.json();
    if (!isRecord(payload)) {
      const response = NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
      return applyHeaders(response, rateLimit.headers);
    }

    const text = sanitizeText(payload.text);
    if (!text) {
      const response = NextResponse.json(
        {
          error: `Text is required and must be <= ${MAX_TEXT_LENGTH} characters`,
        },
        { status: 400 }
      );
      return applyHeaders(response, rateLimit.headers);
    }

    const voiceId = sanitizeVoiceId(payload.voiceId);

    if (isDemoMode() || !ELEVENLABS_API_KEY) {
      const response = NextResponse.json(
        { error: "ELEVENLABS_API_KEY not configured", fallback: true },
        { status: 503 }
      );
      return applyHeaders(response, rateLimit.headers);
    }

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75,
            style: 0.5,
            use_speaker_boost: true,
          },
        }),
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!upstream.ok) {
      const response = NextResponse.json(
        { error: "ElevenLabs API request failed" },
        { status: upstream.status }
      );
      return applyHeaders(response, rateLimit.headers);
    }

    const audioBuffer = await upstream.arrayBuffer();
    const response = new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache, no-store",
      },
    });

    for (const [header, value] of Object.entries(rateLimit.headers)) {
      response.headers.set(header, value);
    }

    return response;
  } catch {
    const response = NextResponse.json({ error: "TTS request failed" }, { status: 500 });
    return applyHeaders(response, rateLimit.headers);
  }
}
