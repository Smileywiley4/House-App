/**
 * Password auth via same-origin Vercel bridge (prod) or Python API (local).
 * Uses the service-role grant so CAPTCHA misconfig on Supabase does not block signup/signin.
 */
function authBridgeBases() {
  const bases = [];
  if (typeof window !== "undefined" && window.location?.origin) {
    bases.push(window.location.origin);
  }
  const api = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (api && !bases.includes(api)) bases.push(api);
  return bases;
}

async function postAuth(path, body) {
  let lastError = null;
  for (const base of authBridgeBases()) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail || data.message || data.error || `Request failed (${res.status})`;
        lastError = new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
        // 404/405 → try next base (SPA host without API, etc.)
        if (res.status === 404 || res.status === 405) continue;
        throw lastError;
      }
      if (!data.access_token || !data.refresh_token) {
        throw new Error("Auth service did not return a session");
      }
      return data;
    } catch (err) {
      lastError = err;
      // Network failure → try next base
      if (err?.name === "TypeError" || /failed to fetch|network/i.test(String(err?.message || ""))) {
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error("Auth bridge unavailable");
}

export async function bridgeSignIn({ email, password }) {
  return postAuth("/api/auth/sign-in", { email, password });
}

export async function bridgeSignUp(payload) {
  return postAuth("/api/auth/sign-up", payload);
}

export async function applyBridgeSession(supabase, sessionPayload) {
  const { error } = await supabase.auth.setSession({
    access_token: sessionPayload.access_token,
    refresh_token: sessionPayload.refresh_token,
  });
  if (error) throw error;
  return sessionPayload;
}
