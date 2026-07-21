import crypto from "node:crypto";

export const SIGNUP_CODE_TTL_SEC = 15 * 60;
export const SIGNUP_RESEND_COOLDOWN_SEC = 60;

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(str) {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function challengeSecret() {
  return (
    process.env.SIGNUP_CHALLENGE_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  );
}

export function hashSignupCode(code, email) {
  const secret = challengeSecret();
  return crypto
    .createHmac("sha256", secret)
    .update(`${String(email).trim().toLowerCase()}:${String(code).trim()}`)
    .digest("hex");
}

export function mintSignupChallenge(payload) {
  const secret = challengeSecret();
  if (!secret) throw new Error("Signup challenge secret is not configured");
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSignupChallenge(token) {
  const secret = challengeSecret();
  if (!secret || !token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8"));
    if (!payload?.email || !payload?.exp) return null;
    if (Date.now() / 1000 > Number(payload.exp)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateSixDigitCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export function supabaseEnv() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    "";
  if (!url || !service) return null;
  return { url, service };
}

export async function listUserByEmail(url, service, email) {
  const target = String(email).trim().toLowerCase();
  const r = await fetch(`${url}/auth/v1/admin/users?page=1&per_page=200`, {
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
    },
  });
  if (!r.ok) return null;
  const data = await r.json().catch(() => ({}));
  const users = data.users || [];
  return users.find((u) => String(u.email || "").toLowerCase() === target) || null;
}

export async function passwordGrant(url, service, email, password) {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detail =
      data.error_description || data.msg || data.error || "Invalid email or password";
    return { error: String(detail) };
  }
  if (!data.access_token || !data.refresh_token) {
    return { error: "Auth service did not return a session" };
  }
  return { data };
}

export async function sendCodeEmail({ to, code, expiresMinutes = 15 }) {
  const resendKey = (process.env.RESEND_API_KEY || "").trim();
  const from =
    (process.env.RESEND_FROM_EMAIL || "").trim() ||
    "Propurty <onboarding@resend.dev>";
  if (!resendKey) return { sent: false, reason: "no_resend" };

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Your Propurty confirmation code",
      text:
        `Your Propurty confirmation code is ${code}.\n\n` +
        `It expires in ${expiresMinutes} minutes. If you did not request this, you can ignore this email.`,
      html:
        `<p>Your Propurty confirmation code is:</p>` +
        `<p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p>` +
        `<p>This code expires in <strong>${expiresMinutes} minutes</strong>.</p>` +
        `<p>If you did not request this, you can ignore this email.</p>`,
    }),
  });
  if (!r.ok) {
    const err = await r.text();
    return { sent: false, reason: err.slice(0, 200) };
  }
  return { sent: true };
}
