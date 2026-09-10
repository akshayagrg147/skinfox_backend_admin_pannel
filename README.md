# SkinFox commerce workspace

A responsive commerce concept for the seven-product SkinFox launch range across skin, body, hair and scalp care. The data-driven hero, catalogue and product galleries are structured to expand as additional approved SKUs and details arrive.

## Run locally

Use Node.js 20.19+ or 22.12+ (Node 21 is not supported by Vite 7).

```bash
npm install
npm run dev:all
```

Then open the local address printed by Vite. Other useful commands:

```bash
npm run lint
npm test
npm run build
npm run preview
```

The storefront is at `http://localhost:4173`, the API at `http://localhost:4000`, the OpenAPI UI at `http://localhost:4000/api/docs`, the admin panel at `http://localhost:4174`, and the affiliate dashboard at `http://localhost:4175`.

Quick API smoke checks:

```bash
curl http://localhost:4000/api/v1/health
curl 'http://localhost:4000/api/v1/products?concern=Dry%20Skin&limit=12'
curl -X POST http://localhost:4000/api/v1/carts -H 'content-type: application/json' -d '{}'
```

The JSON document behind the interactive API reference is available at `http://localhost:4000/api/docs/json`.

### Environment variables

The complete templates are [server/.env.example](/Users/akshay/Documents/ChatGPT/skinfox/server/.env.example), [admin/.env.example](/Users/akshay/Documents/ChatGPT/skinfox/admin/.env.example), [affiliate/.env.example](/Users/akshay/Documents/ChatGPT/skinfox/affiliate/.env.example), and [.env.example](/Users/akshay/Documents/ChatGPT/skinfox/.env.example). The server template covers PostgreSQL/Redis (`DATABASE_URL`, `REDIS_URL`), origins and session security (`STOREFRONT_ORIGIN`, `ADMIN_ORIGIN`, `AFFILIATE_ORIGIN`, `COOKIE_SECRET`, `SESSION_TTL_DAYS`), Firebase Admin authentication (`FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`), independent affiliate OTP (`AFFILIATE_OTP_*`), first-admin bootstrap (`SEED_ADMIN_*`), and optional Razorpay, S3-compatible storage, and Mailpit provider settings. Keep real values in an ignored `.env` or deployment secret manager.

### Customer authentication and priority-waitlist payment flow

The customer flow uses Firebase Google sign-in or email/password when the public `VITE_FIREBASE_*` web configuration is present. The backend verifies the Firebase ID token, maps each Firebase project/UID to a `CustomerIdentity`, creates a SkinFox session, and links the guest cart. New email/password accounts collect a valid Indian mobile number for delivery contact, send a Firebase verification email, and keep account data and payment actions locked until that email is verified. Password reset and Firebase token revocation invalidate the corresponding SkinFox session. Existing legacy customer rows remain readable and are never silently merged by email; contact `contact@skinfox.in` for support-assisted recovery.

In Firebase Console, enable **Google** and **Email/Password** under Authentication → Sign-in method, configure the verification/reset email templates, and add every local/production hostname to Authentication → Settings → Authorized domains. The storefront needs `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`; the API needs a server-only Firebase service account. Never expose the service-account JSON in the browser bundle.

While `WAITLIST_ENABLED=true`, every published product is presented as a priority-waitlist product: public product, collection, home, care-finder and cart responses suppress MRP and selling prices. A verified customer can reserve the selected products with a configurable refundable deposit (₹99 by default) and a recorded launch-member discount (25% by default). The reservation and cancellation history is available in **My account → Priority waitlist**. Firebase email delivery remains subject to Firebase quotas and authorized domains.

### Razorpay setup

Start in Razorpay **Test mode**. Add the Test Key ID and Test Key Secret to the API environment as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`; never add the secret to Vite variables or frontend code. Generate a separate webhook secret and set `RAZORPAY_WEBHOOK_SECRET`. Configure the webhook URL as:

```text
https://skinfox.in/api/v1/webhooks/payments/razorpay
```

Subscribe it to `payment.captured`, `payment.failed`, `refund.processed`, and `refund.failed`. Enable automatic payment capture in Razorpay. The API creates orders and refunds directly with Razorpay, verifies Checkout signatures using the stored order ID, confirms payment amount/status with Razorpay, validates webhooks against the exact raw request body, and de-duplicates webhook events. It never trusts an amount sent by the browser and never stores card or UPI credentials.

Apply the database migration and restart the API after adding the settings:

```bash
npm run prisma:deploy --workspace server
npm run build --workspace server
```

`WAITLIST_DEPOSIT_PAISE`, `WAITLIST_DISCOUNT_PERCENT`, and `WAITLIST_TERMS_VERSION` define the accepted terms for new reservations. If Razorpay credentials are absent, the storefront shows that secure payment setup is unavailable and cannot simulate a successful payment. Move to Live keys only after Razorpay account activation/KYC, a successful Test-mode checkout, signed-webhook testing, refund testing, and legal review of the waitlist terms. When prices are approved, retain the reservation records and set `WAITLIST_ENABLED=false` during a controlled release to restore the normal priced checkout experience.

### Affiliate programme

The affiliate dashboard is available at `http://localhost:4175`. An applicant submits their contact, PAN and optional UPI details, then signs in by OTP to see their review state. PAN is encrypted at rest and all dashboards/admin views reveal only the last four characters. A Super Admin approves the application in **Affiliates & payouts** before its referral code becomes active.

An approved partner shares `http://localhost:4173/?ref=SFX-…`. The storefront persists the first valid referral to the server-side cart. When the COD order is confirmed, the API creates one immutable attribution and a 10% wallet credit based on product selling value after discounts, excluding tax, shipping and COD fee. A wallet redemption requires at least ₹500 and becomes an internal payout request; marking it paid in Admin does not transfer money. Configure a real OTP provider, an audited payout provider, retention controls and your applicable tax/privacy notices before production.

### AWS EC2 deployment

The production Compose stack serves the storefront at `/`, the Admin panel on port `8080`, and the affiliate dashboard at `/affiliate/`. On a single HTTP-only EC2 instance, set `STOREFRONT_ORIGIN` in the deployment `.env` to the public origin; the Docker build uses it to generate each affiliate referral link. The bootstrap script sets `AFFILIATE_ORIGIN` to the same origin. Attach an Elastic IP and configure a domain with HTTPS before sharing live customer or affiliate links.

When DNS is ready, the production nginx configuration is prepared for `skinfox.in`, `www.skinfox.in`, `affiliate.skinfox.in`, and `admin.skinfox.in` on the same Elastic IP. It also mounts a Certbot webroot for Let’s Encrypt HTTP challenges. Do not switch cookies to secure-only or remove public port `8080` until certificates have been issued and each hostname has been verified over HTTPS.

### API and database

Copy `server/.env.example` to `server/.env`, start the local services, then create and seed the database:

```bash
docker compose up -d
npm run prisma:generate --workspace server
npm run prisma:migrate --workspace server -- --name init
npm run seed --workspace server
```

The seed is repeatable and imports all seven products, every existing gallery asset, the campaign slideshow, FAQs, serviceability, and the database-managed care finder from `src/data/products.ts`. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before seeding to create the first Super Admin; no password is committed.

The seven launch products keep their approved bundled artwork locked. Admin users can still create and manage new products; add their image files to `public/products` first, then enter the matching `/products/...` paths in the product editor. Product images and galleries are deployed with the storefront, so the Admin UI intentionally has no image-upload or media-library control.

For a non-interactive production bootstrap, also provide a base32 `SEED_ADMIN_MFA_SECRET`; otherwise enroll the seeded admin through the MFA setup screen before enabling production traffic.

### Tests and production builds

```bash
npm run test:all
npm run build:all
```

All money in the API is integer paise. Products with a null selling price are `coming_soon`: they can be added to the launch-interest cart, but the checkout API rejects them from payable orders. Cart totals, coupons, tax, shipping, reservations, order snapshots, payments, refunds, and publication transitions are server-authoritative.

Provider adapters are deliberately local-safe. Set Razorpay, S3/R2, email and shipping credentials in `server/.env` to enable live integrations; secret values are never returned by settings APIs. Automated backup/restore should run against the PostgreSQL volume in the deployment environment; never seed demo orders or customers into production.

For a PostgreSQL backup, run `pg_dump --format=custom --file=skinfox-$(date +%F).dump "$DATABASE_URL"`; restore with `pg_restore --clean --if-exists --dbname="$DATABASE_URL" skinfox-YYYY-MM-DD.dump` during a maintenance window. Retain encrypted backups according to the deployment retention policy and test restores before launch.

Security defaults include Argon2id passwords, HttpOnly/SameSite admin and customer sessions, Firebase token revocation checks, separate CSRF cookie/headers, affiliate OTP expiry/resend/attempt limits, origin-restricted CORS, global and login-specific rate limits, encrypted-at-rest TOTP secrets, request IDs with redacted structured logs, server-side paise pricing, transactional stock reservations, append-only audit records, signed webhook verification, and idempotency-key replay protection.

## What is included

- Seven current SkinFox catalogue entries with visible pack sizes, dynamic category filters and quick views
- Eighteen optimized photos from the supplied product archive, an Onion Shampoo promo video, the existing derived Hydrelle motion asset, and three optimized AI-generated illustrative Hydrelle moisture-study diptychs
- A balanced multi-product hero using the supplied SkinFox pack photography rather than one lead-product banner
- Responsive product-detail galleries with accessible thumbnails and user-controlled video playback
- A CSS-sticky, Framer Motion-scrubbed Hydrelle story with one persistent 200 g tube moving centre → right → left → right through four editorial chapters
- A clearly labelled three-view fictional before/after moisture gallery with the photographed Hydrelle tube, a product-detail CTA, and an explicit non-clinical-results disclaimer
- A single-product Save Data and reduced-motion fallback for the motion chapter, while the hero and catalogue remain multi-product
- Search, local cart persistence, quantity controls, and explicit pending-price states
- Three-step routine finder with tailored recommendations
- Guest carts with Firebase Google/email authentication, verified-email payment gating, saved delivery addresses and customer sessions
- A Razorpay-backed priority waitlist with hidden prices, configurable refundable deposits and discounts, signed payment verification, idempotent webhooks, customer self-service cancellation/refunds and admin visibility
- An affiliate dashboard with OTP sign-in, encrypted PAN application details, admin approval, referral-link attribution, 10% commission wallet credits and ₹500+ payout requests
- Responsive navigation, front-label transparency, editorial product notes, FAQ, and newsletter sections
- Unit and interaction tests with Vitest and Testing Library

## Replace the demo content

Product names, visible sizes, pack highlights, colours, image crops, media galleries, and recommendation mappings live in `src/data/products.ts`. Supplied photography and video are stored in `public/products` and rendered by the catalogue, story and product-detail components.

The animated product chapter is implemented in `src/components/ScrollProductStory.tsx`. It independently adapts the supplied reference's single-product pinned-scroll principle with the existing Framer Motion stack rather than copying its unlicensed code/assets, adding GSAP, or swapping between poster and WebGL states. One Hydrelle Dry Skin Specialist image node remains mounted while scroll progress drives section-like centre/right/left/right positions, rotation, scale, copy changes, and an exact reverse scrub. The existing `hydrelle-tube-isolated-v1.png` motion asset is used with a silhouette mask so its baked checkerboard does not appear around the tube. Reduced-motion preferences and Save Data receive the same product in a truly static normal-flow story.

## Prototype boundaries and deployment notes

The products and photography reflect the supplied SkinFox range. Hydrelle, Rayyvia and Acnfin artwork visibly include MRP references, which are labelled as MRP rather than treated as confirmed selling prices; products without an artwork price show `Price on launch`. Complete ingredients, directions, manufacturer information, testimonials, and substantiated efficacy claims were not supplied. The interface hides ratings and avoids extending front-label callouts into new claims. Confirm commercial rights for the promo-video audio before publishing it.

The included API persists launch leads, waitlist reservations, carts, customer checkout data and orders in PostgreSQL. Razorpay waitlist payments use the live provider API only when server-side credentials are present; object storage, email, shipping and Redis queue integrations remain provider interfaces with local-safe adapters. Configure and validate live credentials, webhook delivery, backups, observability, retention, legal policies and payment/shipping tax rules before production launch. The seeded products may retain internal commercial data for administrators, but the public API suppresses it while the priority waitlist is enabled.
