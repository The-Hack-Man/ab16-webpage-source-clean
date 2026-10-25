# Production Readiness Audit

**Scope inspected:** the `project/` app in this checkout. It is a Vite + React + TypeScript SPA with Supabase Auth, PostgREST, Storage, and Supabase Edge Functions. It is not a Next.js app and contains no Express/Node API server. `wrangler.jsonc` configures Cloudflare Pages assets. No Vercel/Netlify, Heroku/Railway, or Express deployment configuration was found in this project. Platform dashboards and the live database are not accessible from the checkout, so their current values and migration state cannot be confirmed here.

## Critical Issues

### 1. Supabase client initialization can hide missing config and then fail unpredictably

- **Issue:** The client warns and calls `createClient('', '')` when either variable is missing. This produces confusing runtime failures across all data/auth use instead of an immediate actionable configuration error. The actual frontend names are `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; `NEXT_PUBLIC_*` is for Next.js and is not read by this app.
- **Location:** `src/lib/supabase.ts`; Vite project root is `project/`.
- **Fix:** In local `project/.env.local` (or `.env`, ignored by git), set the exact names. In Cloudflare Pages/Vercel/Netlify build settings set the same names for the production and preview build environments, then rebuild. The URL must be `https://<project-ref>.supabase.co`; use the anon/publishable key, never a service role/secret key. Change client initialization to throw if either value is blank and validate the URL, rather than constructing a client with empty strings.
- **Evidence:** The local `.env` has both expected frontend names, but this only establishes that names exist, not that the values are correct or deployed. Its values were not displayed. The repository’s Supabase project ref is `fleoxzauuvfbdysvadev` in `supabase/config.toml`; confirm it is the intended live project.

### 2. The local dev `/api/` proxy target is malformed

- **Issue:** `vite.config.ts` uses `VITE_SUPABASE_URL` (normally `https://<ref>.supabase.co`) as the proxy target. The rewrite removes `/api`, so `/api/publish-release` is sent to `https://<ref>.supabase.co/publish-release`, omitting `/functions/v1`. This makes API calls through `/api/*` fail in local development and risks masking the correct production URL setup.
- **Location:** `vite.config.ts` and `src/pages/admin/AdminReleaseEdit.tsx`.
- **Fix:** Set the proxy target to `VITE_SUPABASE_FUNCTIONS_URL=https://<ref>.supabase.co/functions/v1` or construct it as `${VITE_SUPABASE_URL}/functions/v1`, while preserving the function-name path. Better, call the Supabase Functions SDK directly (`supabase.functions.invoke('publish-release', ...)`) and remove this custom proxy.

### 3. Do not put the `.env.example` server credentials in any Vite environment

- **Issue:** The prior template included a live project URL, `SUPABASE_SECRET_KEY`, a duplicate service role key, malformed whitespace assignments, and an example `VITE_STRIPE_PUBLISHABLE_KEY` despite this code not using it. Any `VITE_*` secret is bundled into public JavaScript. Local `.env` variable names include `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_SECRET_KEY`; this is safe only if values stay out of client code, git, and browser build variables.
- **Location:** `project/.env.example`, `project/.env`, `project/.gitignore`, Supabase Edge Function secrets.
- **Fix:** The `.env.example` in this change replaces these with placeholders and documents browser versus Edge Function values. Keep only URL + anon key under `VITE_*`. Configure all service credentials in Supabase Edge Function secrets. Remove `SUPABASE_SECRET_KEY` aliases from Edge Functions after migrating the secret to the canonical `SUPABASE_SERVICE_ROLE_KEY`. If a service-role/secret key was ever committed or exposed in a frontend build, rotate it immediately.
- **Git status limitation:** Git metadata inspection was blocked by the checkout ownership safety check, so I could not verify whether `.env` is tracked. `.gitignore` does contain `.env`, `.env.*`, and re-includes `.env.example`; confirm with `git ls-files --error-unmatch .env` under a trusted repo owner. If it is tracked, untrack it and rotate exposed credentials.

## High Priority Fixes

### 4. Admin authorization can briefly render as signed out after reload

- **Issue:** `AdminLayout` treats `session === null` as unauthenticated while `AuthProvider` is still restoring the persisted session. On a direct `/admin/*` load it immediately renders the sign-in screen. This is a user-facing auth hydration race.
- **Location:** `src/context/AuthContext.tsx`, `src/components/AdminLayout.tsx`.
- **Fix:** Expose and check `loading` in `AdminLayout`; render a neutral loading state until `getSession()` resolves, then decide based on the session and trusted `app_metadata.role`. Handle `getSession()` rejection and clear loading in `finally`.

### 5. Admin release publication function trusts editable user metadata

- **Issue:** `publish-release` first verifies the user with Supabase, but falls back to `user.user_metadata.role`. User metadata is client-editable, so it must never grant admin authority. The SQL policies use trusted `app_metadata`, making this function inconsistent with database authorization.
- **Location:** `supabase/functions/publish-release/index.ts` around the role check.
- **Fix:** Read only `user.app_metadata.role`; reject other values with 403. Keep the service-role client strictly behind that server-side `getUser(token)` authorization check. Require and validate a non-empty anon key before creating the auth-verification client.

### 6. Mastering screens conflict with RLS and expose an incomplete mastering flow

- **Issue:** The `ai_mastering_jobs` policies are admin-only, but the public mastering page reads all jobs and uploads to the admin-only `releases` bucket. Its `startMastering` path inserts/updates jobs directly from the browser. Ordinary signed-in customers will receive RLS/storage errors; giving customers admin policies would be an unsafe workaround. Separately, the interface reports a completed job using a browser timer, and full-track rendering consumes a credit only after the client-side audio has already been rendered. These are not durable or tamper-resistant production job/payment controls.
- **Location:** `src/pages/master/MasterPage.tsx`, `src/pages/admin/AdminAIMastering.tsx`, `supabase/migrations/20261020234000_ai_mastering_schema.sql`, `supabase/migrations/20261023173839_secure_mastering_job_admin_policies.sql`, `supabase/migrations/20261023173757_use_trusted_app_metadata_for_admin_policies.sql`, `src/pages/master/MasterPage.tsx` credit export flow.
- **Fix:** Decide the product model. For a real per-user mastering service, add a server/Edge Function to create jobs after validating the session, write `user_id`, scope select/update policies to `auth.uid() = user_id`, and use a private Storage bucket with owner-scoped paths/policies or signed upload URLs. Process jobs in a trusted worker and only mark completion after processing. Make credit consumption and job creation atomic server-side, and never rely on client state/timers to assert completed work. For an admin-only mastering tool, guard the entire route until auth restoration and admin role is verified; keep all job and storage operations admin-only. Remove the dead/unsafe flow rather than widening RLS.

### 7. A few Edge Functions allow wildcard CORS

- **Issue:** Several functions respond with `Access-Control-Allow-Origin: *`, including write/payment/worker endpoints. CORS is not authorization, and secret endpoints still need auth/signature checks, but a wildcard unnecessarily permits any website to issue browser requests and can complicate origin controls.
- **Location:** `supabase/functions/create-checkout/index.ts`, `publish-release/index.ts`, `scheduler-tick/index.ts`, and webhook handlers.
- **Fix:** Allowlist `PUBLIC_SITE_URL` plus explicitly needed preview/local origins, echo only a validated Origin, add `Vary: Origin`, and return the matching CORS headers for OPTIONS and normal/error responses. Webhooks should remain protected by provider signatures regardless of CORS. `create-checkout` already separately validates the checkout origin in the body; also validate the HTTP Origin.

### 8. Public account order history queries by email

- **Issue:** The browser loads orders with `.eq('email', session.user.email)`. Correct privacy depends entirely on RLS preventing a user from reading another customer's rows. Email-based ownership is weaker and can break on email changes.
- **Location:** `src/pages/AccountPages.tsx` (`OrderHistory`); orders RLS migration(s).
- **Fix:** Add and populate `user_id` on orders when checkout is associated with an authenticated user, query by the authenticated UUID, and enforce `auth.uid() = user_id` in RLS. For guest orders, provide an authenticated, one-time order lookup flow rather than exposing order data to any user who knows an email. Confirm policies on `orders` and `order_items` in the live database.

## Medium Priority

### 9. Several screens silently discard Supabase errors

- **Issue:** `AuthProvider.getSession()` has no rejection handling; many page queries ignore `error` and show empty content as if data simply does not exist. This obscures RLS, network, and schema failures.
- **Location:** `src/context/AuthContext.tsx`; examples in `src/pages/ShopPage.tsx`, `src/pages/AccountPages.tsx`, `src/pages/admin/AdminOrders.tsx`, `src/pages/admin/AdminEnquiries.tsx`.
- **Fix:** Add consistent loading/error/empty states; log only sanitized diagnostics server-side. On account order loading, distinguish query error from an empty order list. Add retry controls for critical reads, as already done on the homepage.

### 10. Mastering credit checkout and RLS need an end-to-end migration check

- **Issue:** `payment_records` initially grants authenticated users insert/update policies, then a later migration removes them and moves credit grants to server-only RPC. If the full ordered migration set is not applied, stale permissive policies could remain. Local migration files do not prove the remote project is synchronized.
- **Location:** `supabase/migrations/20261021021500_mastering_payments_credits.sql`, `20261021030000_secure_mastering_credit_flow.sql`, `supabase/migrations/`.
- **Fix:** Run `supabase migration list` against the intended project and inspect the live policies for `payment_records`, `mastering_credits`, `orders`, `order_items`, and `ai_mastering_jobs`. Apply missing migrations in order after reviewing any drift. Assert only service role can execute `grant_mastering_credits`, and only the owner can read their credit balance.

### 11. Vite deployment/build settings must target the nested app directory

- **Issue:** The deployable site is under `project/`, not the checkout root. The root `package.json` is not the app; the actual scripts are Vite scripts and `wrangler.jsonc` points to `./dist`.
- **Location:** `project/package.json`, `project/wrangler.jsonc`.
- **Fix:** Configure Cloudflare Pages (or another static host) with root/build directory `project`, install `npm ci`, build `npm run build`, output `dist`. Configure SPA fallback to `/index.html` (Cloudflare's `not_found_handling: single-page-application` is already configured for Wrangler assets). For Vercel/Netlify, set the same project root and SPA rewrites. There is no Express process, `PORT`, Procfile, Heroku/Railway start command, Next config, or Next data-fetching code to fix in this project.

### 12. No app-wide React error boundary

- **Issue:** No React error boundary was found. A render-time exception can blank the SPA instead of showing a recovery screen.
- **Location:** `src/main.tsx` / app root.
- **Fix:** Add a root error boundary with a useful fallback and reload action. Keep async Supabase errors in page-level state; an error boundary does not catch promise rejections.

## Low Priority

### 13. Remove sensitive payload logging and audit console use

- **Issue:** `scheduler-tick` logs full job payloads, which can contain private operational data. There is also production `console.error` use for meaningful failures, which should be structured and sanitized rather than indiscriminately removed.
- **Location:** `supabase/functions/scheduler-tick/index.ts` around job processing; Edge Function logging throughout.
- **Fix:** Log job ID/type and correlation ID, not payload. Ensure error logs omit credentials, tokens, full customer addresses, and payment data. Add log retention/alerting for function failures.

### 14. Verify database indexes against actual query patterns

- **Issue:** The SPA loads catalog relations and account/admin records. The project has many indexes, but a checkout-level EXPLAIN / production query review was not possible without database access.
- **Location:** migrations under `supabase/migrations/`, especially product, order, and relationship tables.
- **Fix:** Check indexes for `orders(user_id, created_at)`, `order_items(order_id)`, `product_variants(product_id)`, `product_images(product_id, position)`, `tracks(release_id, position)`, and any RLS ownership columns. Use query plans on representative production-sized data before adding indexes.

### 15. No Node server process means platform runbook should reflect Edge Functions

- **Issue:** A Heroku/Railway Node backend and dynamic `PORT` cannot be validated because none exists. Checkout, webhooks, and privileged database operations run as Supabase Edge Functions.
- **Location:** Project architecture and deployment documentation.
- **Fix:** Document and monitor Edge Function deploys/secrets and scheduled invocations. If a separate Express service exists outside this checkout, audit its CORS, input validation, rate limiting, authorization, promise handling, and `process.env.PORT` separately.

## Supabase diagnosis and platform checks

1. Confirm `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in local `project/.env.local`, and check that the URL project ref matches the intended database. Do not share or paste secret values into logs/chat.
2. Set those same two values in the static host’s production and preview build environments, then trigger a fresh build; Vite embeds values at build time.
3. Set Edge Function secrets (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and function-specific secrets) in the Supabase project. Do not set service credentials as `VITE_*` or as frontend host variables.
4. Use the browser Network panel: verify requests go to `https://<ref>.supabase.co/rest/v1/...` or `/auth/v1/...`, inspect status and response body for 401/403/schema-cache errors, and confirm the `apikey` is the anon key. Never export HAR files containing auth tokens.
5. Supabase CORS is not configured as a separate project “allowed origins” switch for ordinary PostgREST calls; browser policy is driven by response CORS headers. Configure Auth → URL Configuration with the deployed Site URL and redirect allow list for login/email callbacks. For Edge Functions, correct function CORS headers and explicit app-side Origin checks. CORS errors are distinct from RLS denials.
6. Run `supabase migration list` against the intended project, inspect policies/grants and API schema exposure, and confirm all required tables are in the exposed `public` schema. A valid connection can still return empty results or 401/403 due to RLS/grants.
7. Rotate any service-role/secret credential that was ever committed, included in a Vite build, or shared publicly.

## Production Readiness Checklist

- [ ] Confirm the intended Supabase project ref and rotate any exposed privileged key.
- [ ] Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in local and static-host build environments; rebuild after changes.
- [ ] Deploy only anon/publishable credentials to browser builds; keep service role, Stripe, Printful, and Resend secrets in Supabase Edge Function secrets.
- [ ] Confirm `.env` is ignored and not tracked (`git ls-files --error-unmatch .env` should fail); review repository history if secrets may have been committed.
- [ ] Confirm Supabase Auth site URL, redirect allow list, email templates/provider, and session behavior for the deployed domain.
- [ ] Apply all migrations in order; inspect live RLS policies and grants for customer, admin, payment, worker, and webhook tables.
- [ ] Rework mastering jobs/storage/credits into an owner-scoped, server-mediated flow before enabling customer mastering.
- [ ] Remove the user-metadata admin fallback from `publish-release`; verify all privileged endpoints validate auth/role or provider signatures.
- [ ] Replace wildcard function CORS with explicit allowed origins and validate request Origin where applicable.
- [ ] Fix the Vite function proxy or remove it in favor of `supabase.functions.invoke`.
- [ ] Add auth restoration loading and robust error states; distinguish database errors from empty data.
- [ ] Add a root error boundary and verify SPA deep links on the chosen static host.
- [ ] Configure static host root `project`, build `npm ci && npm run build`, and publish `project/dist`.
- [ ] Verify Stripe live-mode keys/webhook events, Printful variant mappings/signature, Resend sender verification, and production site origin.
- [ ] Ensure production operational logs exclude payloads, tokens, personal data, and secrets; configure alerts for Edge Function failures.
- [ ] Run the project’s `npm run check` and a production build after fixes; run authenticated and anonymous smoke checks against staging.

## Follow-up implementation completed

- Supabase frontend initialization now fails with an actionable error when configuration is absent or not an HTTPS `*.supabase.co` URL.
- The Vite `/api/*` dev proxy now targets the Supabase Functions base path when configured.
- Release publishing now uses `supabase.functions.invoke`; the Edge Function no longer accepts `user_metadata.role` as admin authority.
- Admin layout waits for session restoration before deciding whether to show the sign-in/access-denied screen.
- Cart startup validates persisted items and waits for hydration before writing localStorage, preventing an initial empty state from overwriting the saved cart. Duplicate variant adds refresh product/price/stock metadata.
- Storefront catalogue and product detail errors are surfaced separately from empty results; the shop price filter rejects malformed values and avoids unnecessary refetches for client-only filter/sort changes.
- Signed-in checkout sends the access token to `create-checkout`; the function validates it and writes the authenticated `user_id` to the order, matching the existing owner-scoped orders policy. Guest checkout remains supported.
- Mobile menu and filter drawer expose dialog semantics/expanded state; focus-visible styles and a restrained editorial vermilion/warm-stock treatment were added.
- Verification passed: TypeScript, ESLint, 28 test files / 307 tests, and production Vite build. Build reports only the existing outdated `caniuse-lite` advisory.

The remote Supabase/deployment checks listed above still need completion before the store can be called fully production-ready. Audio rendering remains browser-side; it is not a durable server-side mastering queue.

## Continued implementation

- Added `verify-mastering-checkout`, which validates the caller’s Supabase user, retrieves the checkout session directly from Stripe, checks owner/package/currency/amount against both session metadata and the server-side payment record, and invokes the existing idempotent `grant_mastering_credits` RPC. It returns pending for delayed payment and exposes the balance only after successful verification.
- The mastering return page now invokes that endpoint with the user's access token and provides a retry action for delayed Stripe processing. The webhook remains the asynchronous/idempotent fallback.
- The admin mastering panel now saves an accurately labeled completed 30-second preview artifact immediately; it no longer creates a fake processing state or marks a timer as a completed job. Failed DB writes trigger a best-effort upload cleanup.
- Saved admin preview artifacts now download through short-lived signed Storage URLs rather than treating private object paths as public URLs.
- Updated the audio mastering deployment instructions. Deploy the new function and set `SUPABASE_ANON_KEY` in Edge Function secrets before enabling checkout return verification.

## Environment template

See [`../.env.example`](../.env.example). It contains placeholders only. Frontend variables use Vite’s `VITE_` prefix; the Supabase service role and payment/provider keys are Edge Function secrets and must never be exposed to the browser.
