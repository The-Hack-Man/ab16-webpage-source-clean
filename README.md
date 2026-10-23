# Jamie G Music × AB16 Clothing

Artist website and storefront built with React, TypeScript, Vite, Supabase, and Stripe.

## Run locally

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Start the development server with `npm run dev`.

## Verify changes

- `npm run typecheck` checks application TypeScript.
- `npm run lint` runs ESLint.
- `npm test` runs the local unit tests.
- `npm run build` creates the production bundle.
- `npm run check` runs all four checks in sequence.

## Audio mastering payments

The free mastering preview is limited to 30 seconds. A full-track export consumes one credit after rendering. Configure the Supabase Edge Function secrets `STRIPE_SECRET_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`, set `PUBLIC_SITE_URL` to the deployed website origin, apply the SQL migrations, and configure the Stripe webhook to deliver `checkout.session.completed`, `checkout.session.expired`, and `checkout.session.async_payment_failed` events to `stripe-webhook`.

The uploaded audio is decoded and processed locally in the user's browser; the app limits uploads to 100 MB and 15 minutes.

## Clothing payments and Printful fulfilment

Apply every SQL migration before enabling checkout. A paid store checkout writes its order and line-item snapshot before sending the customer to Stripe. The Stripe webhook verifies payment amount and currency, submits the matching linked Printful store variants, confirms the Printful order, and emails the store owner only for clothing purchases.

Configure the Supabase Edge Function secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLIC_SITE_URL`, `PRINTFUL_API_KEY`, `PRINTFUL_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ADMIN_ORDER_EMAIL`, and `FROM_EMAIL`. `FROM_EMAIL` must be verified by Resend; set `ADMIN_ORDER_EMAIL` to the store owner's inbox. Configure the Stripe webhook for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, and `checkout.session.async_payment_failed`. Configure the Printful webhook for `package_shipped`, `package_returned`, `order_failed`, and `order_canceled`. Before enabling it, confirm the signature header and signing-secret format in the Printful account; the local handler rejects unsigned or invalidly signed callbacks.

Printful supports one active webhook URL per store, so updating this configuration disables any previous webhook URL. Check the existing store configuration before replacing it.

Before taking payment, enter the matching Printful **sync variant ID** for every purchasable size/colour in Admin → Products. Shop SKUs are not Printful variant IDs. Checkout intentionally refuses to charge for products whose Printful variant is not linked. Confirm product images and the linked Printful variants match the garment, colour, size, and existing print artwork.

The black and white T-shirts are £22 each, the cap is £12, and the black jumper is £40. The other jumper and tracksuit are marked TBA and cannot be purchased.
