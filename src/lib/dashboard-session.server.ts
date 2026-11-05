import { createHmac, timingSafeEqual } from "node:crypto";

const COOKIE_NAME = "ip_dashboard_session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters");
  return value;
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function isValidSession(request: Request) {
  const raw = request.headers
    .get("cookie")
    ?.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`))?.[1];
  if (!raw) return false;
  const [expires, provided] = raw.split(".");
  if (!expires || !provided || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const expected = signature(expires);
  return (
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  );
}

export function createSessionCookie() {
  const expires = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const value = `${expires}.${signature(String(expires))}`;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`;
}

export function isDashboardPassword(password: string) {
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || !password) return false;
  const actual = Buffer.from(password);
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}
