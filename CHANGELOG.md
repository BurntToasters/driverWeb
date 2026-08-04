<!-- bcls:partial -->
### ℹ️ Enjoying DriverHub? Consider [❤️ Supporting Me! ❤️](https://rosie.run/support)

DriverHub - a trust-first Windows driver catalog with official vendor links, risk labels, and deep-linkable filters.

## Changes in `v6.1.0:`

### Branding is now config-driven :)

- **NEW - `driverweb.conf` branding:** Site identity (name, URL, logo, tagline, contact, support/docs/GitHub links, feed titles) now lives in a public root `driverweb.conf` file instead of being hard-coded across pages and scripts.
  - Build and Astro both load it through `scripts/load-driverweb-conf.js`, with required-key checks and `http(s)` URL validation.
  - Headers, footers, contact, settings, titles, canonicals, and OG images read from conf via `siteConfig` / `siteLinks`.
- **NEW - Build-time site meta:** `npm run build:site-meta` regenerates `sitemap.xml` and `robots.txt` from `SITE_URL` on every build.
- **Codebase:** Feeds, PWA manifest name/description, and the version-info GitHub fetch URL are generated from conf during `build:version` / `build:feeds`.
- **Fix:** Fixed an issue where homepage / watchlist deep links like `/display?q=610.62&brand=nvidia` applied filters but left matching driver sections collapsed, so the entry never appeared.
  - Matching channel sections now expand, the best match scrolls into view, and an exact version match opens the driver details panel.
- **PKG:** Updated packages.

## ℹ️ Release Info

- **Hosting & Deployment:** Automatically built and deployed on Cloudflare Pages on commit.
- **Asset Bundling:** Client JS and CSS are compiled, minified, and optimized via Astro during build.
- **Branding Config:** Public site identity is controlled by root `driverweb.conf` (no secrets). Change values there and rebuild to rebrand.
- **Caching:** Retired service worker unregistration keeps browsers on the newest site assets without stale caches.
