const fs = require('fs');
const path = require('path');

const REQUIRED_KEYS = [
  'NAME',
  'SITE_URL',
  'TAGLINE',
  'META_DESCRIPTION',
  'LOGO_URL',
  'CONTACT_EMAIL',
  'SUPPORT_URL',
  'GITHUB_URL',
  'DOCS_URL',
  'RELEASE_NOTES_URL',
  'REGION_DOCS_URL',
  'FEED_TITLE',
  'FEED_DESCRIPTION'
];

const URL_KEYS = [
  'SITE_URL',
  'LOGO_URL',
  'SUPPORT_URL',
  'GITHUB_URL',
  'DOCS_URL',
  'RELEASE_NOTES_URL',
  'REGION_DOCS_URL'
];

function getConfPath(rootDir = path.resolve(__dirname, '..')) {
  return path.join(rootDir, 'driverweb.conf');
}

function stripInlineComment(value) {
  // Full-line `#` comments are handled by the parser. Trailing ` # comment`
  // is stripped; bare `#fragment` in URLs (no space before #) is preserved.
  return String(value).replace(/\s+#.*$/, '').trim();
}

function parseDriverWebConf(text) {
  const config = {};

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) {
      throw new Error(`Invalid driverweb.conf line (expected KEY=value): ${rawLine}`);
    }

    const key = line.slice(0, eq).trim();
    const value = stripInlineComment(line.slice(eq + 1).trim());
    if (!key) {
      throw new Error(`Invalid driverweb.conf line (empty key): ${rawLine}`);
    }

    config[key] = value;
  }

  return config;
}

function normalizeHttpUrl(raw, key) {
  let url = String(raw || '').trim();
  if (!url) {
    throw new Error(`driverweb.conf ${key} is empty`);
  }

  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`driverweb.conf ${key} is not a valid URL: ${raw}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`driverweb.conf ${key} must use http or https: ${raw}`);
  }

  if (!parsed.hostname) {
    throw new Error(`driverweb.conf ${key} is missing a host: ${raw}`);
  }

  // Keep path/query/hash as authored; only normalize SITE_URL to origin-style base.
  if (key === 'SITE_URL') {
    return `${parsed.protocol}//${parsed.host}`.replace(/\/+$/, '');
  }

  return parsed.toString();
}

function validateContactEmail(email) {
  const value = String(email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error(`driverweb.conf CONTACT_EMAIL is not a valid email: ${email}`);
  }
  return value;
}

function validateConfig(config) {
  const missing = REQUIRED_KEYS.filter((key) => !String(config[key] || '').trim());
  if (missing.length) {
    throw new Error(`driverweb.conf missing required key(s): ${missing.join(', ')}`);
  }
}

function loadDriverWebConf(rootDir = path.resolve(__dirname, '..')) {
  const confPath = getConfPath(rootDir);
  if (!fs.existsSync(confPath)) {
    throw new Error(`driverweb.conf not found at ${confPath}`);
  }

  const config = parseDriverWebConf(fs.readFileSync(confPath, 'utf8'));
  validateConfig(config);

  for (const key of URL_KEYS) {
    config[key] = normalizeHttpUrl(config[key], key);
  }
  config.CONTACT_EMAIL = validateContactEmail(config.CONTACT_EMAIL);

  return config;
}

module.exports = {
  REQUIRED_KEYS,
  URL_KEYS,
  getConfPath,
  parseDriverWebConf,
  normalizeHttpUrl,
  normalizeSiteUrl: (raw) => normalizeHttpUrl(raw, 'SITE_URL'),
  loadDriverWebConf
};
