# Public storefront SEO

`npm run build` now generates initial HTML for the homepage, the two legal pages and the seven supplied product pages. The browser then mounts the existing storefront and loads live catalogue, bag and account data. No authentication or checkout behavior is duplicated in the public-page layer.

## URLs and metadata

- `/` — homepage, OnlineStore, WebSite and the FAQ text rendered on the page.
- `/products/:slug` — product details, breadcrumbs and Product data. Offers use an actual positive selling price returned by the catalogue, never MRP. Stock is not inferred from price.
- `/privacy-policy` and `/terms-and-conditions` — full readable policies and breadcrumbs. Existing `#privacy-policy` and `#terms-and-conditions` links still work.
- `/sitemap.xml` — generated again from the public page list during each build.
- `/robots.txt` — exposes the sitemap and excludes API, admin, affiliate, account and checkout paths on the storefront host. This is a crawl preference, not access control.

All public pages have an individual title, description, canonical URL, Open Graph metadata and Twitter card metadata. The production canonical origin is `https://skinfox.in`; referral parameters are not included in canonical URLs. Local previews intentionally use the production canonical origin.

## Catalogue content

Initial HTML uses `src/data/products.ts`, which is the supplied collection. Selling prices are pending in that source, so static output has no invented offer or availability data. Runtime metadata uses the same current API product displayed by the page. Admin-added product slugs still work through the existing API, but to include them in initial HTML and the build-generated sitemap, synchronize the source catalogue before rebuilding. This is build-time rendering, not a new live server-rendering service.

## Verification and follow-up

The metadata and ProductPage tests check selling-price accuracy, safe JSON-LD encoding, use of visible FAQ text, purchase callbacks, pending-data protection and missing-product handling. Check the built `dist` HTML, not only the browser DOM, when verifying social-sharing metadata.

After deployment, submit `https://skinfox.in/sitemap.xml` in the owner's Google Search Console property and use URL Inspection / Rich Results Test for the deployed pages. Rankings, index timing and rich-result display are controlled by search engines. Do not add invented medical credentials, reviews, return terms, stock, delivery promises or certification badges to improve validation scores.

SkinFox is a personal-care store, so it is described as an `OnlineStore`, not a `MedicalOrganization`. Find My Care provides cosmetic guidance; its assistant is not represented as a real clinician. Google retired the FAQ rich-result feature in May 2026; the requested FAQ schema still describes the visible content, but should not be presented as a promise of FAQ search enhancements.

References: [Google ecommerce structured data](https://developers.google.com/search/docs/specialty/ecommerce/include-structured-data-relevant-to-ecommerce), [Product structured data](https://developers.google.com/search/docs/appearance/structured-data/product-snippet), [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics), [Google documentation updates](https://developers.google.com/search/updates), [OnlineStore vocabulary](https://schema.org/OnlineStore).
