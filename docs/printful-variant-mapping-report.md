# Printful Catalog Reconciliation

Checked: 2026-10-26 against production project `fleoxzauuvfbdysvadev` (`webstore`) and Printful store `AB16 CLOTHING_OFFICIAL`.

## Completed mapping changes

- Added persistent Printful product IDs, managed-catalog flags and last-sync timestamps to `products`; added provider-owned image keys to `product_images`; added uniqueness indexes for Printful product, sync-variant and provider-image identities.
- Deployed `sync-printful-catalog` with JWT and trusted `app_metadata.role` administrator checks. The admin editor no longer accepts variant CSVs or editable fulfillment IDs; catalog mapping is keyed by the exact Printful product and sync-variant IDs.
- Deployed Printful `product_updated`/`product_synced` handling in the signed `printful-webhook` Edge Function.
- Enabled Printful webhook events `product_updated`, `package_shipped`, `package_returned`, `order_failed`, and `order_canceled`. The Printful configuration had no prior active endpoint, so no existing webhook destination or subscriptions were replaced.
- Ran signed production update events for all seven products. Existing listings linked only through exact stored variant IDs; the three unmatched provider products imported as drafts.

## Production verification

- Supabase now has 9 product rows and 52 variants. Seven product rows have their Printful parent ID; 42 variants have unique Printful sync IDs. The two legacy drafts (grey jumper and tracksuit) retain 10 unmapped variants because there was no exact provider ID to identify them safely.
- All four existing published listings remain `available_for_sale=false`. The three imported Printful products are drafts and unavailable. Zero product rows are available for sale; no checkout, payment or Printful fulfilment order was created.
- Existing products were linked without replacing their AB16 names, prices or editorial images. New products imported from Printful with provider thumbnail, variant IDs, size/colour/SKU details, and Printful retail pricing.
- The signed production webhook returned HTTP 200 for all seven real Printful product IDs. A follow-up database query confirmed zero duplicate variant IDs and all 42 Printful variants mapped.
- Printful accepted the webhook update with HTTP 200; the configured URL is the AB16 Supabase `printful-webhook` endpoint and the product-update event is enabled. The deployed function successfully verified a signed event, confirming that its Printful token, Supabase service key and webhook signing secret are available at runtime.
- `npm run check` passed: TypeScript, ESLint, 316 tests and Vite production build. The only build notice is the existing outdated Browserslist database. `git diff --check` passed.

## Release review still required

- Imported products remain drafts until an admin checks garment/model, artwork, mockup, size/colour, selling price and UK fulfillment, then explicitly publishes and enables sales.
- The historical provider review found the hooded sweatshirt unavailable for UK fulfillment; verify this again before release. Existing white and black tee prices and model choices, and cap price/UK fulfillment, also need business approval.
- The two legacy draft products without Printful IDs require a real matching Printful product/variant before they can be sold. The importer intentionally does not infer a match from product names or size/colour.
