import { defineConfig } from 'astro/config';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { loadDriverWebConf } = require('../scripts/load-driverweb-conf.js');
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteConfig = loadDriverWebConf(rootDir);

export default defineConfig({
  site: siteConfig.SITE_URL,
  outDir: '../dist',
  publicDir: './public',
  srcDir: './src',
  trailingSlash: 'never',
  build: {
    format: 'file',
    assets: '_astro'
  },
  compressHTML: true
});
