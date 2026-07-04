import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://driverhub.win',
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
