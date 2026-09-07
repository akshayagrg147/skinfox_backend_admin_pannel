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

The storefront is at `http://localhost:4173`, the API at `http://localhost:4000`, the OpenAPI UI at `http://localhost:4000/api/docs`, and the admin panel at `http://localhost:4174`.

Quick API smoke checks:

```bash
curl http://localhost:4000/api/v1/health
curl 'http://localhost:4000/api/v1/products?concern=Dry%20Skin&limit=12'
curl -X POST http://localhost:4000/api/v1/carts -H 'content-type: application/json' -d '{}'
```

The JSON document behind the interactive API reference is available at `http://localhost:4000/api/docs/json`.

### Environment variables

The complete templates are [server/.env.example](/Users/akshay/Documents/ChatGPT/skinfox/server/.env.example), [admin/.env.example](/Users/akshay/Documents/ChatGPT/skinfox/admin/.env.example), and [.env.example](/Users/akshay/Documents/ChatGPT/skinfox/.env.example). The server template covers PostgreSQL/Redis (`DATABASE_URL`, `REDIS_URL`), origins and session security (`STOREFRONT_ORIGIN`, `ADMIN_ORIGIN`, `COOKIE_SECRET`, `SESSION_TTL_DAYS`), test customer OTP (`CUSTOMER_OTP_*`), first-admin bootstrap (`SEED_ADMIN_*`), and optional Razorpay, S3-compatible storage, and Mailpit provider settings. Keep real values in an ignored `.env` or deployment secret manager.

### Customer OTP and COD test flow

The customer flow is deliberately configured for local testing: a shopper may add products to a guest cart, then must verify a mobile number before delivery addresses or checkout are available. The default local static OTP is `123456`; it is hashed in the database and expires after ten minutes. The value is shown in the browser only when `CUSTOMER_OTP_EXPOSE_TEST_CODE=true` is explicitly set.

Only COD is available in this release. To exercise the full flow, publish a product with a non-null selling price and `available` purchase state in Admin, then add it to the bag. Firebase and Razorpay are intentionally not configured. Before a real launch, replace the static provider with a real SMS provider, disable test-code exposure, configure a domain and HTTPS, and complete payment-provider integration.

### API and database

Copy `server/.env.example` to `server/.env`, start the local services, then create and seed the database:

```bash
docker compose up -d
npm run prisma:generate --workspace server
npm run prisma:migrate --workspace server -- --name init
npm run seed --workspace server
```

The seed is repeatable and imports all seven products, every existing gallery asset, the campaign slideshow, FAQs, serviceability, and the database-managed care finder from `src/data/products.ts`. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` before seeding to create the first Super Admin; no password is committed.

For a non-interactive production bootstrap, also provide a base32 `SEED_ADMIN_MFA_SECRET`; otherwise enroll the seeded admin through the MFA setup screen before enabling production traffic.

### Tests and production builds

```bash
npm run test:all
npm run build:all
```

All money in the API is integer paise. Products with a null selling price are `coming_soon`: they can be added to the launch-interest cart, but the checkout API rejects them from payable orders. Cart totals, coupons, tax, shipping, reservations, order snapshots, payments, refunds, and publication transitions are server-authoritative.

Provider adapters are deliberately local-safe. Set Razorpay, S3/R2, email and shipping credentials in `server/.env` to enable live integrations; secret values are never returned by settings APIs. Automated backup/restore should run against the PostgreSQL volume in the deployment environment; never seed demo orders or customers into production.

For a PostgreSQL backup, run `pg_dump --format=custom --file=skinfox-$(date +%F).dump "$DATABASE_URL"`; restore with `pg_restore --clean --if-exists --dbname="$DATABASE_URL" skinfox-YYYY-MM-DD.dump` during a maintenance window. Retain encrypted backups according to the deployment retention policy and test restores before launch.

Security defaults include Argon2id passwords, HttpOnly/SameSite admin and customer sessions, separate CSRF cookie/headers, OTP expiry, resend and attempt limits, origin-restricted CORS, global and login-specific rate limits, encrypted-at-rest TOTP secrets, request IDs with redacted structured logs, server-side paise pricing, transactional stock reservations, append-only audit records, signed webhook verification, and idempotency-key replay protection.

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
- Guest carts with mandatory customer SMS-style OTP verification, saved delivery addresses, customer sessions and COD-only checkout
- Responsive navigation, front-label transparency, editorial product notes, FAQ, and newsletter sections
- Unit and interaction tests with Vitest and Testing Library

## Replace the demo content

Product names, visible sizes, pack highlights, colours, image crops, media galleries, and recommendation mappings live in `src/data/products.ts`. Supplied photography and video are stored in `public/products` and rendered by the catalogue, story and product-detail components.

The animated product chapter is implemented in `src/components/ScrollProductStory.tsx`. It independently adapts the supplied reference's single-product pinned-scroll principle with the existing Framer Motion stack rather than copying its unlicensed code/assets, adding GSAP, or swapping between poster and WebGL states. One Hydrelle Dry Skin Specialist image node remains mounted while scroll progress drives section-like centre/right/left/right positions, rotation, scale, copy changes, and an exact reverse scrub. The existing `hydrelle-tube-isolated-v1.png` motion asset is used with a silhouette mask so its baked checkerboard does not appear around the tube. Reduced-motion preferences and Save Data receive the same product in a truly static normal-flow story.

## Prototype boundaries and deployment notes

The products and photography reflect the supplied SkinFox range. Hydrelle, Rayyvia and Acnfin artwork visibly include MRP references, which are labelled as MRP rather than treated as confirmed selling prices; products without an artwork price show `Price on launch`. Complete ingredients, directions, manufacturer information, testimonials, and substantiated efficacy claims were not supplied. The interface hides ratings and avoids extending front-label callouts into new claims. Confirm commercial rights for the promo-video audio before publishing it.

The included API persists launch leads, carts, customer checkout data and orders in PostgreSQL. Razorpay, object storage, email, shipping and Redis queue integrations are provider interfaces with local-safe adapters; configure and validate live credentials, webhook signing, backups, observability, retention, legal policies and payment/shipping tax rules before production launch. The seeded products intentionally remain `coming_soon` with null selling prices until commercial approval, so the payable checkout path rejects them.
