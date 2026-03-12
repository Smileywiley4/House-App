# Legal protection & ownership

Suggestions to protect your code and data. **This is not legal advice.** Consult a lawyer for your jurisdiction.

---

## 1. Establish ownership

| Action | Purpose |
|--------|---------|
| **Copyright notice** | Add your name/company and year in source files and `LICENSE`. |
| **LICENSE file** | Use `LICENSE` (proprietary/all-rights-reserved) or a standard license (MIT, Apache) if you allow use. |
| **Work-for-hire / assignment** | If contractors built it, use written agreements that assign IP to you. |

---

## 2. Protect the repository

| Action | Purpose |
|--------|---------|
| **Private repo** | Keep the repo private until you decide to open-source. |
| **Access control** | Limit who can read/clone; use branch protection. |
| **.gitignore** | Never commit `.env`, secrets, or credentials. |

---

## 3. Protect secrets & data

| Action | Purpose |
|--------|---------|
| **Env vars / secrets manager** | Store API keys, DB URLs, etc. in env or a secrets manager; never in code. |
| **Supabase** | Use RLS and service role only on the backend. |
| **User data** | Add Privacy Policy and Terms of Service; define retention and export/deletion. |

---

## 4. Contracts & agreements

| Document | Purpose |
|----------|---------|
| **Contributor Agreement (CLA)** | If others contribute, have them assign or license IP to you. |
| **NDA** | For contractors/partners before sharing code. |
| **Terms of Service** | Covers use of your product and data handling. |
| **Privacy Policy** | Covers collection, use, and sharing of user data (e.g. GDPR). |

---

## 5. Hand-off specifics

Before handing off to another team or acquirer:

- **Code:** Ensure LICENSE and copyright notices are correct.
- **Secrets:** Do not include `.env` or real keys; provide separate secure transfer.
- **Documentation:** Include HANDOFF.md and related docs.
- **Transfer agreement:** Use a written agreement (e.g. asset purchase) that transfers IP, warranties, and responsibilities.
