const fs = require('fs');
const path = require('path');
const { loadDriverWebConf } = require('./load-driverweb-conf');

const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'astro', 'public');
const sitemapPath = path.join(publicDir, 'sitemap.xml');
const robotsPath = path.join(publicDir, 'robots.txt');

const SITEMAP_ENTRIES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/display', changefreq: 'weekly', priority: '0.9' },
  { path: '/display/laptop', changefreq: 'weekly', priority: '0.8' },
  { path: '/chipset', changefreq: 'weekly', priority: '0.8' },
  { path: '/audio', changefreq: 'weekly', priority: '0.7' },
  { path: '/network', changefreq: 'weekly', priority: '0.7' },
  { path: '/info/about-stabledrivers', changefreq: 'monthly', priority: '0.5' },
  { path: '/info/trust-center', changefreq: 'monthly', priority: '0.6' },
  { path: '/info/credits', changefreq: 'monthly', priority: '0.4' }
];

function siteLoc(siteUrl, pathname) {
  const base = siteUrl.replace(/\/+$/, '');
  if (!pathname || pathname === '/') return `${base}/`;
  return `${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`.replace(/\/+$/, '');
}

function sanitizeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSitemap(siteUrl) {
  const urls = SITEMAP_ENTRIES.map((entry) => [
    '  <url>',
    `    <loc>${sanitizeXml(siteLoc(siteUrl, entry.path))}</loc>`,
    `    <changefreq>${entry.changefreq}</changefreq>`,
    `    <priority>${entry.priority}</priority>`,
    '  </url>'
  ].join('\n'));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    ''
  ].join('\n');
}

function buildRobots(siteUrl) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /display/warn',
    'Disallow: /404.html',
    `Sitemap: ${siteLoc(siteUrl, '/sitemap.xml')}`,
    ''
  ].join('\n');
}

function main() {
  const siteConfig = loadDriverWebConf(rootDir);
  fs.mkdirSync(publicDir, { recursive: true });
  fs.writeFileSync(sitemapPath, buildSitemap(siteConfig.SITE_URL));
  fs.writeFileSync(robotsPath, buildRobots(siteConfig.SITE_URL));
  process.stdout.write(`Updated sitemap.xml and robots.txt for ${siteConfig.SITE_URL}\n`);
}

main();
