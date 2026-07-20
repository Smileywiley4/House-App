/**
 * Finish signup by verifying the email confirmation code (15-minute window).
 */
import {
  hashSignupCode,
  json,
  listUserByEmail,
  passwordGrant,
  readSignupChallenge,
  supabaseEnv,
} from "../_lib/signupChallenge.js";

export async function POST(request) {
  const env = supabaseEnv();
  if (!env) return json(503, { detail: "Authentication is not configured" });

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { detail: "Invalid JSON body" });
  }

  const challenge = readSignupChallenge(String(body.challenge_token || ""));
  if (!challenge) {
    return json(400, {
      detail: "This confirmation code has expired or is invalid. Please request a new code.",
    });
  }

  const email = String(body.email || challenge.email || "").trim().toLowerCase();
  const code = String(body.code || body.token || "").trim();
  const password = String(body.password || "");
  if (email !== challenge.email) {
    return json(400, { detail: "Email does not match this confirmation request." });
  }
  if (!/^\d{6,12}$/.test(code)) {
    return json(400, { detail: "Enter the confirmation code from your email." });
  }
  if (password.length < 8) {
    return json(400, { detail: "Password must be at least 8 characters." });
  }

  const mode = challenge.mode || "custom";

  if (mode === "custom" || mode === "supabase_debug") {
    const expected = challenge.code_hash;
    const actual = hashSignupCode(code, email);
    if (!expected || expected !== actual) {
      return json(400, { detail: "That confirmation code is incorrect. Please try again." });
    }
  } else {
    // supabase_otp — verify through GoTrue
    const verifyRes = await fetch(`${env.url}/auth/v1/verify`, {
      method: "POST",
      headers: {
        apikey: env.service,
        Authorization: `Bearer ${env.service}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "email", email, token: code }),
    });
    if (!verifyRes.ok) {
      const err = await verifyRes.json().catch(() => ({}));
      return json(400, {
        detail: err.msg || err.error_description || "That confirmation code is incorrect or expired.",
      });
    }
  }

  const user = await listUserByEmail(env.url, env.service, email);
  if (!user?.id) {
    return json(400, { detail: "Signup session not found. Please start again." });
  }

  const meta = {
    terms_accepted: true,
    marketing_opt_in: Boolean(challenge.marketing_opt_in),
    intended_plan: challenge.intended_plan || "free",
    signup_pending: false,
  };
  if (challenge.full_name) meta.full_name = challenge.full_name;
  if (challenge.phone) meta.phone = challenge.phone;

  const updateRes = await fetch(`${env.url}/auth/v1/admin/users/${user.id}`, {
    method: "PUT",
    headers: {
      apikey: env.service,
      Authorization: `Bearer ${env.service}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      password,
      email_confirm: true,
      user_metadata: meta,
    }),
  });
  if (!updateRes.ok) {
    const err = await updateRes.json().catch(() => ({}));
    return json(400, { detail: err.msg || "Could not finish signup. Please try again." });
  }

  const granted = await passwordGrant(env.url, env.service, email, password);
  if (granted.error) {
    return json(400, {
      detail: "Email confirmed, but automatic sign-in failed. Please sign in with your email and password.",
    });
  }
  return json(200, granted.data);
}
