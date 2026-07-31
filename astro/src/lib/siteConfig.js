import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  loadDriverWebConf
} = require('../../../scripts/load-driverweb-conf.js');

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export const siteConfig = loadDriverWebConf(rootDir);

export function siteUrl(pathname = '/') {
  const base = siteConfig.SITE_URL.replace(/\/+$/, '');
  if (!pathname || pathname === '/') return `${base}/`;
  const normalized = (pathname.startsWith('/') ? pathname : `/${pathname}`).replace(/\/+$/, '');
  return `${base}${normalized}`;
}

export function pageTitle(pageLabel) {
  return `${pageLabel} | ${siteConfig.NAME}`;
}

export function escapeJsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
