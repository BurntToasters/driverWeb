<!-- bcls:partial -->
### ℹ️ Enjoying DriverWeb? Consider [❤️ Supporting Me! ❤️](https://rosie.run/support)

# Welcome to DriverWeb v6!!!

A completely re-imagined driver catalog built for speed, transparency, and style.

## Why are we already on 6.0?

The version bump from 5 to 6 marks a complete foundation and design rewrite. The project has migrated from a custom Nunjucks build script to Astro 7, bringing modern static optimization and faster page speeds. Along with the structural changes, we have rolled out a bold new Neobrutalist visual aesthetic.

## Breaking Changes

To prevent client desyncs and layout breaks with the new design, we have retired the previous PWA offline caching system. Old service workers and browser caches will be automatically unregistered and cleared on your next visit.

## Changes in `v6.0.0:`

### Welcome to DriverWeb v6!

This release represents a massive step forward in code quality and layout presentation.

- **NEW - Neobrutalist Theme:** Redesigned the entire user interface with a bold Neobrutalist design featuring thick black outlines, sharp box shadows, and Cyberyellow accents.
- **NEW - Recommendation Wizard:** Added a home page configuration wizard to help users quickly select and generate deep-linkable URLs for their specific system configurations.
- **Codebase:** Migrated the entire application templating system from Nunjucks to Astro 7 for optimized component rendering and build performance.
- **Updater:** Retired the PWA cache system and introduced automatic service worker cleanup scripts to ensure users always receive the newest driver information.
- **Codebase:** Replaced the deprecated `npm-license-crawler` with `license-checker` for generating dependency license metadata at build time.
- **UI:** Refactored the driver search overlay and comparison panel, and added a keyboard shortcut (`Ctrl+K`) to focus search instantly.
- **PKG:** Updated packages.

## ℹ️ Release Info

- **Hosting & Deployment:** Automatically built and deployed on Cloudflare Pages upon commit.
- **Asset Bundling:** Client JS and CSS resources are compiled, minified, and optimized via Astro during build.
- **Caching:** The retired service worker unregistration ensures browsers load the newest site assets directly without stale caches.
