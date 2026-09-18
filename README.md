# Ellext Marketing Billing

A focused invoicing workspace for Ellext Marketing. The client starts with an empty workspace; production data belongs in the authenticated PostgreSQL service, not browser storage. The UI domain model is shaped around `business_settings`, `customers`, `services`, `invoices`, `invoice_items`, `payments`, `audit_logs`, `backups`, and `invoice_sequences`.

## Run locally

```bash
npm install
npm run dev
```

Configure `.env` from `.env.example`, then start the API and client in separate terminals:

```bash
npm run server
npm run dev
```

Create the first administrator only after confirming the intended Supabase project:

```bash
npm run create-admin
```

The setup command creates a real Supabase Auth user and profile; there are no demo accounts or seeded financial records.

## Production checklist

- Apply `supabase/migrations/001_billing_core.sql` and `002_rls.sql` with the Supabase CLI or migration runner. These migrations have been applied to the configured project during this setup.
- In Supabase Authentication, configure the Site URL to `APP_URL`, add `APP_URL` to Redirect URLs, and configure the Email provider if password-reset emails are enabled.
- Keep `SUPABASE_SECRET_KEY` server-only. Only `SUPABASE_PUBLISHABLE_KEY` may be used by a browser client.
- Recalculate GST, discounts, totals, payment balances, and invoice sequences in transactions on the server.
- The API provides secure, httpOnly sessions, user-facing sign-up, Supabase Auth password verification, rate limiting, validation, and audit logging for authentication. Billing CRUD/API routes still need to be connected to the same server-side persistence layer before deployment.

- The sign-up flow creates an auto-confirmed Supabase Auth user and application profile, then returns to sign in. Sign-in validates the email and password and creates the secure application session immediately. Configure the Supabase Auth Email provider and SMTP/site URLs only if password-reset emails are enabled.
- Configure `VITE_API_URL`; browser persistence remains only a legacy local fallback and must not be used as the production database.
- Use the invoice print action from Chrome or Edge to generate a clean A4 PDF.
- Use Backup & Export for structured `.xlsx` files for customers, services, invoices, payments, and GST data, or a versioned full-backup `.zip` package.

## Vercel deployment

- `vercel.json` deploys the Vite client from `dist` and routes `/api/*` to the Express function in `api/index.ts`.
- Set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `COOKIE_SECRET`, `APP_URL`, and `CORS_ORIGIN` as Vercel project environment variables. Set `VITE_API_URL` to `/api` or leave it unset so the client uses the same-origin API.
- Never commit `.env` or expose `SUPABASE_SECRET_KEY` to the browser.

## Reference format

The supplied `Ellext_Marketing_Professional_Invoice.docx` was inspected for the implementation: dark Ellext wordmark, compact invoice metadata block, FROM/BILL TO columns, service table, tax summary, payment details, notes, and signature area. No logo file existed in the repository, so the supplied artwork is used from `src/assets/ellext-logo.png`.
