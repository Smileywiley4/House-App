/**
 * Profile "me" bridge — validates the user JWT via Supabase Auth, loads/creates
 * profile with the service role, and best-effort syncs Google Sheets CRM.
 *
 * Lets signup land in Sheets even when Railway still has stale Supabase JWT settings.
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

function env() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    "";
  const sheetId = process.env.GOOGLE_MARKETING_SHEET_ID || "";
  const saJson = process.env.GOOGLE_SHEETS_SA_JSON || "";
  return { url, service, sheetId, saJson };
}

function profileToUser(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    email: row.email || null,
    full_name: row.full_name || null,
    default_weights: row.default_weights || {},
    role: row.role || "user",
    plan: row.plan || "free",
    realtor_license: row.realtor_license || "",
    brokerage: row.brokerage || "",
    state: row.state || "",
    linked_realtor_id: row.linked_realtor_id ? String(row.linked_realtor_id) : null,
    phone: row.phone || "",
    marketing_opt_in: Boolean(row.marketing_opt_in),
    promo_code: row.promo_code || "",
  };
}

async function getAuthUser(url, accessToken) {
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!r.ok) return null;
  return r.json();
}

async function rest(url, service, path, { method = "GET", body } = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: service,
      Authorization: `Bearer ${service}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "resolution=merge-duplicates,return=representation" : "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!r.ok) {
    const err = new Error(typeof data === "object" ? data?.message || text : text);
    err.status = r.status;
    throw err;
  }
  return data;
}

async function ensureProfile(url, service, user) {
  const id = user.id;
  const existing = await rest(url, service, `profiles?id=eq.${encodeURIComponent(id)}&select=*`);
  if (Array.isArray(existing) && existing[0]) return existing[0];

  const meta = user.user_metadata || {};
  const payload = {
    id,
    email: user.email || null,
    full_name: meta.full_name || meta.name || (user.email || "").split("@")[0] || null,
    phone: meta.phone || null,
    marketing_opt_in: Boolean(meta.marketing_opt_in),
    plan: "free",
  };
  if (payload.marketing_opt_in) {
    payload.marketing_opt_in_at = new Date().toISOString();
  }
  const created = await rest(url, service, "profiles", { method: "POST", body: payload });
  return Array.isArray(created) ? created[0] : created;
}

async function maybeSyncSheet(row) {
  try {
    const { upsertAccountRow } = await import("../_lib/sheets.js");
    const ok = await upsertAccountRow(row);
    return Boolean(ok);
  } catch {
    return false;
  }
}

export async function GET(request) {
  const { url, service } = env();
  if (!url || !service) return json(503, { detail: "Authentication is not configured" });

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json(401, { detail: "Not authenticated" });

  const user = await getAuthUser(url, token);
  if (!user?.id) return json(401, { detail: "Invalid or expired token" });

  try {
    let row = await ensureProfile(url, service, user);
    const synced = await maybeSyncSheet(row);
    if (synced && !row.marketing_sheet_synced_at) {
      try {
        await rest(url, service, `profiles?id=eq.${encodeURIComponent(user.id)}`, {
          method: "PATCH",
          body: { marketing_sheet_synced_at: new Date().toISOString() },
        });
        row = { ...row, marketing_sheet_synced_at: new Date().toISOString() };
      } catch {
        /* non-fatal */
      }
    }
    return json(200, profileToUser(row));
  } catch (err) {
    return json(502, { detail: err.message || "Profile lookup failed" });
  }
}

export async function PATCH(request) {
  const { url, service } = env();
  if (!url || !service) return json(503, { detail: "Authentication is not configured" });

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return json(401, { detail: "Not authenticated" });

  const user = await getAuthUser(url, token);
  if (!user?.id) return json(401, { detail: "Invalid or expired token" });

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  try {
    await ensureProfile(url, service, user);
    const updates = {};
    for (const key of ["full_name", "phone", "marketing_opt_in", "realtor_license", "brokerage", "state"]) {
      if (Object.prototype.hasOwnProperty.call(body, key)) updates[key] = body[key];
    }
    if (updates.marketing_opt_in === true) {
      updates.marketing_opt_in_at = new Date().toISOString();
    }
    if (Object.keys(updates).length) {
      await rest(url, service, `profiles?id=eq.${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: updates,
      });
    }
    const rows = await rest(url, service, `profiles?id=eq.${encodeURIComponent(user.id)}&select=*`);
    const row = Array.isArray(rows) ? rows[0] : rows;
    return json(200, profileToUser(row));
  } catch (err) {
    return json(502, { detail: err.message || "Profile update failed" });
  }
}
