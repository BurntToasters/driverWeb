<p align="center"><img src="https://prod.rexxit.net/global/_icons/DH-logo-optim.webp" width="10%"></p>

# DriverWeb (Website: [driverhub.win](https://driverhub.win))
A project that lists common drivers and their native download links all in one place!

## 🙌 Simplistic
Intuative yet minimalistic UI allowing for easy viewing in both light or dark mode.

## ⭐ Features
- Professional two-pane driver browsing UI with filter rail and deep-linkable URL state
- Compare mode for selected drivers (`compare` URL param)
- Risk-level and compatibility filtering (`channel`, `risk`, `os`, `view` URL params)
- Search 2.0 overlay with weighted ranking, facets, and quick actions
- Watchlist with delta-feed update indicators
- Dedicated Trust Center page backed by generated trust metrics
- Static PWA shell with offline cache for core pages and feeds
- Region selection between EU and US based NVIDIA download endpoints ([see more](https://docs.rexxit.net/drivers-website/articles/region-selection))

## 🌐 Resources
- [📝 DriverHub.win Docs](https://docs.rexxit.net/drivers-website/)
- [📜 Driver List Data](https://github.com/BurntToasters/driverWeb-data)

## 🛠️ Build + Data Contract
- `npm run build` generates feeds, HTML, and CSS
- `npm run test:data` validates feed contract requirements (required fields, enums, sort order, checksum format)

## 🧰 Data Update Workflows
Canonical source files stay in `../driverWeb-data` with the existing dataset file names.

### Recommended: Interactive CLI
1. Run `npm run data:edit`
2. Choose a dataset file and action (list/add/edit/remove)
3. Follow prompts for driver fields
4. On save, the tool automatically runs `npm run data:sync` to rebuild feeds and validate the contract

### Manual Fallback
1. Edit `../driverWeb-data/*.json` directly
2. Keep entries sorted newest-first by `publishedAt`
3. Run `npm run data:sync` to regenerate feeds and validate

## 🔁 Data Commands
- `npm run data:edit` opens the guided JSON editor for external canonical data
- `npm run data:sync` runs `build:feeds` and `test:data`, then prints changed file paths
- `npm run test:data:editor` runs editor normalization checks (ID/date/enum/checksum and add/edit/remove scenarios)

## ⬇️ Direct downloads
Downloads of any/all drivers on this website go the official companies download URL's and are **NOT** redistributed by me. This site is simply a "hub" for common drivers (such as video drivers).

## 📨 Get in touch
Contact me regarding this project [here](https://driverhub.win/contact).
