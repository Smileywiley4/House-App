/**
 * Same-origin signup bridge (Vercel serverless).
 * Creates the user with the service role (email confirmed) then returns a session.
 */
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function requiredEnv() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    "";
  if (!url || !service) {
    return { error: json(503, { detail: "Authentication is not configured" }) };
  }
  return { url, service };
}

async function passwordGrant(url, service, email, password) {
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
    return { error: json(400, { detail: String(detail) }) };
  }
  if (!data.access_token || !data.refresh_token) {
    return { error: json(502, { detail: "Auth service did not return a session" }) };
  }
  return { data };
}

export async function POST(request) {
  const env = requiredEnv();
  if (env.error) return env.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { detail: "Invalid JSON body" });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const termsAccepted = Boolean(body.terms_accepted);
  if (!email || password.length < 8) {
    return json(400, { detail: "Email and password (min 8 characters) are required." });
  }
  if (!termsAccepted) {
    return json(400, { detail: "Please agree to the Terms of Service to create an account." });
  }

  const intendedPlan = ["free", "premium", "realtor"].includes(body.intended_plan)
    ? body.intended_plan
    : "free";
  const meta = {
    terms_accepted: true,
    marketing_opt_in: Boolean(body.marketing_opt_in),
    intended_plan: intendedPlan,
  };
  const fullName = String(body.full_name || "").trim();
  const phone = String(body.phone || "").trim();
  if (fullName) meta.full_name = fullName;
  if (phone) meta.phone = phone;

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
      email_confirm: true,
      user_metadata: meta,
    }),
  });
  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    const msg = String(err.msg || err.error_description || err.error || "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return json(400, { detail: "An account with this email already exists. Sign in instead." });
    }
    return json(400, { detail: err.msg || err.error || "Could not create account. Please try again." });
  }

  const granted = await passwordGrant(env.url, env.service, email, password);
  if (granted.error) {
    return json(400, {
      detail: "Account created, but automatic sign-in failed. Please sign in with your email and password.",
    });
  }
  return json(200, granted.data);
}
