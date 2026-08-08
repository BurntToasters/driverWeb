<!-- bcls:partial -->
### ℹ️ Enjoying DriverHub? Consider [❤️ Supporting Me! ❤️](https://rosie.run/support)

DriverHub - a trust-first Windows driver catalog with official vendor links, risk labels, and deep-linkable filters.

## Changes in `v6.2.0:`



## ℹ️ Release Info

- **Hosting & Deployment:** Automatically built and deployed on Cloudflare Pages on commit.
- **Asset Bundling:** Client JS and CSS are compiled, minified, and optimized via Astro during build.
- **Branding Config:** Public site identity is controlled by root `driverweb.conf` (no secrets). Change values there and rebuild to rebrand.
- **Caching:** Retired service worker unregistration keeps browsers on the newest site assets without stale caches.
