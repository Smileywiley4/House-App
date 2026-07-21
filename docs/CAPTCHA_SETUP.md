# Bot protection (Cloudflare Turnstile + Supabase Auth CAPTCHA)

Propurty uses **Cloudflare Turnstile** on account creation (and other auth forms). Verification is
enforced by **Supabase Auth** when CAPTCHA protection is enabled in the project.

## 1. Create a Turnstile widget

1. Open [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile).
2. Create a widget for Propurty.
3. Add hostnames:
   - `house-app-rho.vercel.app`
   - your custom domain (when ready)
   - `localhost` (for local testing)
4. Copy the **Site Key** and **Secret Key**.

## 2. Frontend (Vercel)

Set:

```bash
VITE_TURNSTILE_SITE_KEY=your_site_key
```

Then redeploy the web app.

## 3. Supabase (required for real protection)

1. Open Supabase → **Authentication** → **Attack Protection** / **Bot and Abuse Protection**.
2. Enable **CAPTCHA protection**.
3. Provider: **Cloudflare Turnstile**.
4. Paste the Turnstile **Secret Key**.
5. Save.

Without this step, the widget still appears, but Supabase will not reject missing/invalid tokens.

## 4. Local development

Add to `ALL/.env.local`:

```bash
VITE_TURNSTILE_SITE_KEY=your_site_key
```

Ensure `localhost` is allowed on the Turnstile widget.

## Behavior

- Sign up, sign in, and password-reset forms show Turnstile when the site key is set.
- Create-account / Google sign-up stay blocked until the challenge succeeds.
- In production builds, if the site key is missing, signup is blocked with a clear message.
