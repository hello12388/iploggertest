import crypto from "node:crypto";

export type DashboardSession = {
  user: "admin";
  issuedAt: number;
  expiresAt: number;
};

const SESSION_COOKIE_NAME = "dashboard_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_FAILURE_WINDOW_MS = 1000 * 60 * 5;

const loginFailures = new Map<string, { count: number; lockedUntil: number }>();

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getDashboardPassword(): string {
  return getRequiredEnv("DASHBOARD_PASSWORD");
}

export function getSessionSecret(): string {
  return getRequiredEnv("SESSION_SECRET");
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(payload: string): string {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export function createDashboardSession(): DashboardSession {
  const now = Date.now();
  return {
    user: "admin",
    issuedAt: now,
    expiresAt: now + SESSION_TTL_MS,
  };
}

export function serializeSession(session: DashboardSession): string {
  const payload = JSON.stringify(session);
  const signed = signPayload(payload);
  return `${base64UrlEncode(payload)}.${signed}`;
}

export function parseSession(rawValue: string | null): DashboardSession | null {
  if (!rawValue) {
    return null;
  }

  const [payloadPart, signaturePart] = rawValue.split(".");
  if (!payloadPart || !signaturePart) {
    return null;
  }

  const payload = base64UrlDecode(payloadPart);
  const expectedSignature = signPayload(payload);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(signaturePart), Buffer.from(expectedSignature))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(payload) as Partial<DashboardSession>;
    if (parsed.user !== "admin") {
      return null;
    }
    if (typeof parsed.issuedAt !== "number" || typeof parsed.expiresAt !== "number") {
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      return null;
    }
    return {
      user: "admin",
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function readSessionFromRequest(request: Request): DashboardSession | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookies = new Map<string, string>();

  for (const chunk of cookieHeader.split(";")) {
    const trimmed = chunk.trim();
    if (!trimmed) {
      continue;
    }
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const name = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    cookies.set(name, decodeURIComponent(value));
  }

  const rawValue = cookies.get(SESSION_COOKIE_NAME);
  return parseSession(rawValue ?? null);
}

export function buildSessionCookieHeader(session: DashboardSession): string {
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(serializeSession(session))}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ].join("; ");
}

export function clearSessionCookieHeader(): string {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Path=/",
    "Max-Age=0",
  ].join("; ");
}

export function verifyDashboardPassword(input: string): boolean {
  const expectedPassword = getDashboardPassword();
  const inputBuffer = Buffer.from(input, "utf8");
  const expectedBuffer = Buffer.from(expectedPassword, "utf8");

  if (inputBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(inputBuffer, expectedBuffer);
}

export function getClientIp(request: Request): string {
  const cloudflareIp = request.headers.get("cf-connecting-ip");
  if (cloudflareIp && cloudflareIp.trim().length > 0) {
    return cloudflareIp.trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstValue = forwardedFor.split(",")[0]?.trim();
    if (firstValue) {
      return firstValue;
    }
  }

  return "unknown";
}

export function checkLoginRateLimit(request: Request): { blocked: boolean; retrySeconds: number } {
  const ip = getClientIp(request);
  const now = Date.now();
  const current = loginFailures.get(ip);

  if (!current) {
    return { blocked: false, retrySeconds: 0 };
  }

  if (current.lockedUntil > now) {
    return {
      blocked: true,
      retrySeconds: Math.max(1, Math.ceil((current.lockedUntil - now) / 1000)),
    };
  }

  loginFailures.delete(ip);
  return { blocked: false, retrySeconds: 0 };
}

export function recordFailedLogin(request: Request): void {
  const ip = getClientIp(request);
  const now = Date.now();
  const current = loginFailures.get(ip);

  if (!current || current.lockedUntil <= now) {
    loginFailures.set(ip, {
      count: 1,
      lockedUntil: now + LOGIN_FAILURE_WINDOW_MS,
    });
    return;
  }

  const nextCount = current.count + 1;
  if (nextCount >= LOGIN_FAILURE_LIMIT) {
    loginFailures.set(ip, {
      count: nextCount,
      lockedUntil: now + LOGIN_FAILURE_WINDOW_MS,
    });
    return;
  }

  loginFailures.set(ip, {
    count: nextCount,
    lockedUntil: current.lockedUntil,
  });
}

export function clearLoginFailure(request: Request): void {
  loginFailures.delete(getClientIp(request));
}

export const dashboardSessionCookieName = SESSION_COOKIE_NAME;
export const dashboardLoginFailureLimit = LOGIN_FAILURE_LIMIT;
export const dashboardLoginInvalidWindowMs = LOGIN_FAILURE_WINDOW_MS;
