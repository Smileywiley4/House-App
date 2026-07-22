/**
 * Start email confirmation for signup.
 * Sends a 6-digit code (valid 15 minutes). Does not create a finished session.
 */
import {
  SIGNUP_CODE_TTL_SEC,
  SIGNUP_RESEND_COOLDOWN_SEC,
  generateSixDigitCode,
  hashSignupCode,
  json,
  listUserByEmail,
  mintSignupChallenge,
  readSignupChallenge,
  sendCodeEmail,
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

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const termsAccepted = Boolean(body.terms_accepted);
  if (!email || !email.includes("@")) {
    return json(400, { detail: "A valid email is required." });
  }
  if (password.length < 8) {
    return json(400, { detail: "Password must be at least 8 characters." });
  }
  if (!termsAccepted) {
    return json(400, { detail: "Please agree to the Terms of Service to create an account." });
  }

  const intendedPlan = ["free", "premium", "realtor"].includes(body.intended_plan)
    ? body.intended_plan
    : "free";
  const fullName = String(body.full_name || "").trim();
  const phone = String(body.phone || "").trim();
  const marketingOptIn = body.marketing_opt_in !== false;

  // Optional: honor prior challenge for resend cooldown
  const prior = body.challenge_token ? readSignupChallenge(String(body.challenge_token)) : null;
  if (prior?.email === email && prior?.iat) {
    const elapsed = Date.now() / 1000 - Number(prior.iat);
    if (elapsed < SIGNUP_RESEND_COOLDOWN_SEC) {
      const wait = Math.ceil(SIGNUP_RESEND_COOLDOWN_SEC - elapsed);
      return json(429, {
        detail: `Please wait ${wait}s before requesting another code.`,
        retry_after: wait,
      });
    }
  }

  const existing = await listUserByEmail(env.url, env.service, email);
  if (existing?.email_confirmed_at) {
    return json(400, { detail: "An account with this email already exists. Sign in instead." });
  }

  const now = Math.floor(Date.now() / 1000);
  const code = generateSixDigitCode();
  const codeHash = hashSignupCode(code, email);
  const expiresAt = now + SIGNUP_CODE_TTL_SEC;

  const challengePayload = {
    email,
    exp: expiresAt,
    iat: now,
    code_hash: codeHash,
    intended_plan: intendedPlan,
    marketing_opt_in: marketingOptIn,
    terms_accepted: true,
    full_name: fullName || undefined,
    phone: phone || undefined,
    // Password is never stored in the challenge; client re-sends it on confirm.
    pwd_len: password.length,
  };

  // Prefer Resend (custom 15-min copy). Fallback: Supabase Auth OTP email.
  let delivery = "resend";
  const emailed = await sendCodeEmail({
    to: email,
    code,
    expiresMinutes: Math.floor(SIGNUP_CODE_TTL_SEC / 60),
  });

  if (!emailed.sent) {
    delivery = "supabase";
    // Store pending metadata on an unconfirmed auth user, then trigger OTP email.
    const meta = {
      terms_accepted: true,
      marketing_opt_in: marketingOptIn,
      intended_plan: intendedPlan,
      signup_pending: true,
    };
    if (fullName) meta.full_name = fullName;
    if (phone) meta.phone = phone;

    if (!existing) {
      await fetch(`${env.url}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: env.service,
          Authorization: `Bearer ${env.service}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: false,
          user_metadata: meta,
        }),
      });
    }

    const otpRes = await fetch(`${env.url}/auth/v1/otp`, {
      method: "POST",
      headers: {
        apikey: env.service,
        Authorization: `Bearer ${env.service}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        create_user: false,
        data: meta,
      }),
    });
    if (!otpRes.ok) {
      const err = await otpRes.json().catch(() => ({}));
      const msg = err.msg || err.error_description || err.error || "Could not send confirmation email";
      // As last resort when email is rate-limited, mint via generate_link and keep custom hash path
      // only if debug is enabled (never expose code in production).
      if (String(process.env.SIGNUP_OTP_DEBUG || "") === "1") {
        const linkRes = await fetch(`${env.url}/auth/v1/admin/generate_link`, {
          method: "POST",
          headers: {
            apikey: env.service,
            Authorization: `Bearer ${env.service}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ type: "magiclink", email }),
        });
        const linkData = await linkRes.json().catch(() => ({}));
        const debugCode = linkData.email_otp;
        if (debugCode) {
          challengePayload.code_hash = hashSignupCode(String(debugCode), email);
          challengePayload.mode = "supabase_debug";
          const challenge_token = mintSignupChallenge(challengePayload);
          return json(200, {
            email,
            expires_at: new Date(expiresAt * 1000).toISOString(),
            expires_in: SIGNUP_CODE_TTL_SEC,
            challenge_token,
            delivery: "debug",
            debug_code: String(debugCode),
          });
        }
      }
      return json(otpRes.status === 429 ? 429 : 502, { detail: String(msg) });
    }
    // Supabase sent its own OTP — confirm path verifies via Supabase, not our hash.
    challengePayload.mode = "supabase_otp";
    delete challengePayload.code_hash;
  } else {
    challengePayload.mode = "custom";
  }

  // Ensure unconfirmed user exists with the chosen password for the custom-code path,
  // so confirm can password-grant after verifying the code.
  if (challengePayload.mode === "custom") {
    if (existing) {
      await fetch(`${env.url}/auth/v1/admin/users/${existing.id}`, {
        method: "PUT",
        headers: {
          apikey: env.service,
          Authorization: `Bearer ${env.service}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          email_confirm: false,
          user_metadata: {
            terms_accepted: true,
            marketing_opt_in: marketingOptIn,
            intended_plan: intendedPlan,
            signup_pending: true,
            ...(fullName ? { full_name: fullName } : {}),
            ...(phone ? { phone } : {}),
          },
        }),
      });
    } else {
      const createRes = await fetch(`${env.url}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: env.service,
          Authorization: `Bearer ${env.service}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          email_confirm: false,
          user_metadata: {
            terms_accepted: true,
            marketing_opt_in: marketingOptIn,
            intended_plan: intendedPlan,
            signup_pending: true,
            ...(fullName ? { full_name: fullName } : {}),
            ...(phone ? { phone } : {}),
          },
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        const msg = String(err.msg || err.error || "").toLowerCase();
        if (!msg.includes("already") && !msg.includes("registered") && !msg.includes("exists")) {
          return json(400, { detail: err.msg || "Could not start signup. Please try again." });
        }
      }
    }
  }

  let challenge_token;
  try {
    challenge_token = mintSignupChallenge(challengePayload);
  } catch {
    return json(503, { detail: "Authentication is not configured" });
  }

  return json(200, {
    email,
    expires_at: new Date(expiresAt * 1000).toISOString(),
    expires_in: SIGNUP_CODE_TTL_SEC,
    challenge_token,
    delivery,
  });
}
