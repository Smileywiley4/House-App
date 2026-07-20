/**
 * Same-origin auth bridge (Vercel serverless).
 * Uses the Supabase service role so password auth works even when
 * Turnstile/CAPTCHA is misconfigured on the new Supabase project.
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
  if (!email || password.length < 8) {
    return json(400, { detail: "Email and password (min 8 characters) are required." });
  }

  const granted = await passwordGrant(env.url, env.service, email, password);
  if (granted.error) return granted.error;
  return json(200, granted.data);
}
