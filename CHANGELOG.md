<!-- bcls:partial -->
### ℹ️ Enjoying DriverHub? Consider [❤️ Supporting Me! ❤️](https://rosie.run/support)

DriverHub - a trust-first Windows driver catalog with official vendor links, risk labels, and deep-linkable filters.

## Changes in `v6.2.0:`

### Rosie.run branding and help migration

- **Docs URLs:** `DOCS_URL`, `RELEASE_NOTES_URL`, and `REGION_DOCS_URL` in `driverweb.conf` now point at `help.rosie.run/driverhub/en-us/...` instead of Rexxit docs.
- **Support URL:** Footer and settings support links now use `https://rosie.run/support`.
- **Self-hosted assets:** The DriverHub logo and vendor badge images (NVIDIA, AMD, Intel) are served from `driverhub.win/global/` instead of the Rexxit CDN.
- **CSP:** Content security policy no longer allowlists `prod.rexxit.net`; local and vendor images load under the updated rules.
- **Credits:** Root `package.json` declares `MPL-2.0` so the generated licenses page matches the repo LICENSE.

## ℹ️ Release Info

- **Hosting & Deployment:** Automatically built and deployed on Cloudflare Pages on commit.
- **Asset Bundling:** Client JS and CSS are compiled, minified, and optimized via Astro during build.
- **Branding Config:** Public site identity is controlled by root `driverweb.conf` (no secrets). Change values there and rebuild to rebrand.
- **Caching:** Retired service worker unregistration keeps browsers on the newest site assets without stale caches.
