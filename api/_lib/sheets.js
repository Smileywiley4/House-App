import crypto from "node:crypto";

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const TAB = "Accounts";

function planLabel(plan) {
  const p = String(plan || "free").toLowerCase();
  if (p === "premium") return "Pro";
  if (p === "realtor") return "Realtor";
  if (p === "admin") return "Admin";
  return "Free";
}

function parseSa(raw) {
  if (!raw) return null;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

function b64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function googleAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: SHEETS_SCOPE,
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claim}`);
  signer.end();
  const sig = signer
    .sign(sa.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const assertion = `${header}.${claim}.${sig}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = await r.json();
  if (!r.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google token failed");
  }
  return data.access_token;
}

export async function upsertAccountRow(row) {
  const sheetId = process.env.GOOGLE_MARKETING_SHEET_ID || "";
  const sa = parseSa(process.env.GOOGLE_SHEETS_SA_JSON || "");
  if (!sheetId || !sa?.client_email || !sa?.private_key) return false;

  const token = await googleAccessToken(sa);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const valuesRes = await fetch(
    `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(`${TAB}!A:P`)}`,
    { headers },
  );
  const valuesData = await valuesRes.json().catch(() => ({}));
  const values = valuesData.values || [];
  const userId = String(row.id);
  let existingIdx = -1;
  for (let i = 1; i < values.length; i += 1) {
    if (String(values[i][15] || "") === userId) {
      existingIdx = i + 1; // 1-based sheet row
      break;
    }
  }

  const now = new Date();
  const signupDate = (row.created_at || now.toISOString()).slice(0, 10);
  const signupTime = `${(row.created_at || now.toISOString()).slice(11, 19)} UTC`;
  const line = [
    signupDate,
    signupTime,
    row.full_name || "",
    row.email || "",
    row.phone || "",
    planLabel(row.plan),
    row.state || "",
    row.brokerage || "",
    row.realtor_license || "",
    row.marketing_opt_in ? "Yes" : "No",
    row.promo_code ? "Yes" : "No",
    row.promo_code || "",
    "Active",
    now.toISOString().replace("T", " ").slice(0, 19) + " UTC",
    "signup",
    userId,
  ];

  if (existingIdx > 0) {
    // Preserve original signup date/time if present
    const prev = values[existingIdx - 1] || [];
    if (prev[0]) line[0] = prev[0];
    if (prev[1]) line[1] = prev[1];
    await fetch(
      `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(`${TAB}!A${existingIdx}:P${existingIdx}`)}?valueInputOption=RAW`,
      { method: "PUT", headers, body: JSON.stringify({ values: [line] }) },
    );
  } else {
    await fetch(
      `${SHEETS_API}/${sheetId}/values/${encodeURIComponent(`${TAB}!A:P`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", headers, body: JSON.stringify({ values: [line] }) },
    );
  }
  return true;
}
