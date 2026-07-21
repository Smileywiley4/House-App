# Email confirmation codes for signup (15 minutes)

Signup is a two-step flow:

1. **Start** — `POST /api/auth/signup-start`  
   Creates a pending (unconfirmed) auth user and sends a **6-digit code**.
2. **Confirm** — `POST /api/auth/signup-confirm`  
   Requires the code + password. Code must be used within **15 minutes**.

## Email delivery

Preferred (reliable copy + TTL messaging):

```bash
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL="Propurty <noreply@yourdomain.com>"
```

Fallback (no Resend key): Supabase Auth email OTP (`/auth/v1/otp`).

## Local debug only

When Supabase email is rate-limited during development:

```bash
SIGNUP_OTP_DEBUG=1
```

The start response may include `debug_code` (never enable this in production).

## Supabase dashboard tips

- Authentication → Email templates: keep OTP/`{{ .Token }}` templates enabled if using the Supabase fallback.
- Auth → Rate Limits: raise email rate limits for production traffic if needed.
