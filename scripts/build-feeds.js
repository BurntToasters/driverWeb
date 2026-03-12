const fs = require('fs');
const https = require('https');
const path = require('path');
const { sourceDefs } = require('./driver-data-sources');
const {
  parseDateValue,
  normalizeDriver,
  validateEntries,
  sortByPublishedAtDesc
} = require('./driver-data-schema');

const SITE_URL = 'https://driverhub.win';
const rootDir = path.resolve(__dirname, '..');
const feedsDir = path.join(rootDir, 'feeds');
const jsonPath = path.join(feedsDir, 'drivers.json');
const rssPath = path.join(feedsDir, 'drivers.xml');
const deltaPath = path.join(feedsDir, 'drivers-delta.json');
const trustMetricsPath = path.join(feedsDir, 'trust-metrics.json');
const audioFeedPath = path.join(feedsDir, 'audio-drivers.json');
const networkFeedPath = path.join(feedsDir, 'network-drivers.json');
const localDataDir = path.resolve(rootDir, '..', 'driverWeb-data');
const sources = sourceDefs;

const staticFallbackCatalog = [
  {
    id: 'chipset-am5',
    vendor: 'amd',
    family: 'chipset',
    channel: 'chipset',
    category: 'AMD Chipset',
    brand: 'amd',
    version: 'AM5 Chipset Utility',
    type: 'X870E, X870, X670E, X670, B650E, B650, A620',
    releaseDate: '2024-12-03',
    releaseDateIso: '2024-12-03',
    publishedAt: '2024-12-03T00:00:00.000Z',
    page: '/chipset',
    downloadUrl: 'https://www.amd.com/en/support/download/drivers.html',
    releaseNotesUrl: '',
    knownIssuesUrl: '',
    previousVersion: '',
    warningUrl: '',
    redditUrl: '',
    isStable: true,
    stabilityGrade: 'A',
    hasWarning: false,
    riskLevel: 'low',
    checksum: null,
    sources: [{ type: 'vendor', url: 'https://www.amd.com/en/support/download/drivers.html' }],
    highlights: ['Unified AMD chipset package'],
    issueTags: [],
    supersedes: '',
    supersededBy: '',
    osSupport: ['windows-10', 'windows-11'],
    architectures: ['x64']
  },
  {
    id: 'chipset-intel-inf',
    vendor: 'intel',
    family: 'chipset',
    channel: 'chipset',
    category: 'Intel Chipset',
    brand: 'intel',
    version: 'Chipset INF Utility',
    type: 'Unified chipset utility',
    releaseDate: '2025-01-01',
    releaseDateIso: '2025-01-01',
    publishedAt: '2025-01-01T00:00:00.000Z',
    page: '/chipset',
    downloadUrl: 'https://www.intel.com/content/www/us/en/download/19347/chipset-inf-utility.html',
    releaseNotesUrl: '',
    knownIssuesUrl: '',
    previousVersion: '',
    warningUrl: '',
    redditUrl: '',
    isStable: true,
    stabilityGrade: 'A',
    hasWarning: false,
    riskLevel: 'low',
    checksum: null,
    sources: [{ type: 'vendor', url: 'https://www.intel.com/content/www/us/en/download/19347/chipset-inf-utility.html' }],
    highlights: ['Intel unified INF utility'],
    issueTags: [],
    supersedes: '',
    supersededBy: '',
    osSupport: ['windows-10', 'windows-11'],
    architectures: ['x64']
  }
];

function sanitizeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildDriverLink(entry) {
  const params = new URLSearchParams();
  params.set('q', entry.version || '');
  if (entry.brand) params.set('brand', entry.brand);
  if (entry.channel) params.set('channel', entry.channel);
  return `${SITE_URL}${entry.page || '/display'}?${params.toString()}`;
}

function fetchWithFallback(url, options) {
  if (typeof fetch === 'function') {
    return fetch(url, options);
  }

  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          async json() {
            return JSON.parse(body);
          }
        });
      });
    });

    request.on('error', reject);

    if (options && options.signal) {
      options.signal.addEventListener('abort', () => {
        request.destroy(new Error('Request aborted'));
      });
    }
  });
}

function loadLocalSourceFallback(source) {
  try {
    const filename = source.filename || path.basename(source.url);
    const localPath = path.join(localDataDir, filename);
    if (!fs.existsSync(localPath)) return null;

    const data = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    const drivers = Array.isArray(data.drivers) ? data.drivers : [];
    const entries = drivers.map((driver, index) => normalizeDriver(source, data, driver, index));
    process.stdout.write(`Feed source loaded from local fallback: ${filename}\n`);
    return { entries, source, skipped: false, localFallback: true };
  } catch (error) {
    process.stderr.write(`Local fallback parse failed for ${source.url}: ${String(error.message || error)}\n`);
    return null;
  }
}

async function fetchSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetchWithFallback(source.url, { signal: controller.signal });
    if (!response.ok) {
      const localFallback = loadLocalSourceFallback(source);
      if (localFallback) return localFallback;
      if (source.optional) return { entries: [], source, skipped: true };
      throw new Error(`Failed ${source.url}: ${response.status}`);
    }

    const data = await response.json();
    const drivers = Array.isArray(data.drivers) ? data.drivers : [];
    const entries = drivers.map((driver, index) => normalizeDriver(source, data, driver, index));
    return { entries, source, skipped: false };
  } catch (error) {
    const localFallback = loadLocalSourceFallback(source);
    if (localFallback) return localFallback;
    process.stderr.write(`Feed source skipped: ${source.url}\n`);
    return { entries: [], source, skipped: true, error: String(error.message || error) };
  } finally {
    clearTimeout(timeout);
  }
}

function buildRss(entries, generatedAtIso) {
  const items = entries.slice(0, 120).map((entry) => {
    const title = `${entry.category} ${entry.version}${entry.type ? ` - ${entry.type}` : ''}`;
    const link = buildDriverLink(entry);
    const description = [
      `Category: ${entry.category}`,
      entry.releaseDate ? `Release date: ${entry.releaseDate}` : '',
      entry.stabilityGrade ? `Stability: ${entry.stabilityGrade}` : '',
      entry.riskLevel ? `Risk: ${entry.riskLevel}` : '',
      entry.releaseNotesUrl ? `Release notes: ${entry.releaseNotesUrl}` : ''
    ].filter(Boolean).join(' | ');

    return [
      '  <item>',
      `    <title>${sanitizeXml(title)}</title>`,
      `    <link>${sanitizeXml(link)}</link>`,
      `    <guid>${sanitizeXml(entry.id)}</guid>`,
      `    <pubDate>${new Date(entry.publishedAt || generatedAtIso).toUTCString()}</pubDate>`,
      `    <description>${sanitizeXml(description)}</description>`,
      '  </item>'
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>DriverHub Driver Updates</title>',
    `    <link>${SITE_URL}/feeds/drivers.xml</link>`,
    '    <description>Latest Windows driver updates indexed by DriverHub.</description>',
    `    <lastBuildDate>${new Date(generatedAtIso).toUTCString()}</lastBuildDate>`,
    ...items,
    '  </channel>',
    '</rss>',
    ''
  ].join('\n');
}

function getFallbackFeedEntries(generatedAt) {
  return [
    {
      id: 'fallback|graphics',
      vendor: 'nvidia',
      family: 'graphics',
      channel: 'game-ready',
      category: 'Driver Feed Status',
      brand: 'nvidia',
      version: 'Live feed temporarily unavailable',
      type: 'Use on-site search (Ctrl+K) for latest results',
      releaseDate: generatedAt.slice(0, 10),
      releaseDateIso: generatedAt.slice(0, 10),
      publishedAt: generatedAt,
      page: '/display',
      downloadUrl: '',
      releaseNotesUrl: '',
      knownIssuesUrl: '',
      previousVersion: '',
      warningUrl: '',
      redditUrl: '',
      hasWarning: false,
      isStable: false,
      stabilityGrade: '',
      riskLevel: 'medium',
      checksum: null,
      sources: [],
      highlights: ['Feed fallback active'],
      issueTags: ['feed-unavailable'],
      supersedes: '',
      supersededBy: '',
      osSupport: ['windows-10', 'windows-11'],
      architectures: ['x64'],
      legacy: {
        sha256sum: '',
        warningMessage: ''
      }
    }
  ];
}

function readPreviousFeedEntries() {
  try {
    if (!fs.existsSync(jsonPath)) return [];
    const existing = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (!existing || !Array.isArray(existing.entries)) return [];
    return existing.entries;
  } catch {
    return [];
  }
}

function pickSignificantSnapshot(entry) {
  return {
    version: entry.version,
    type: entry.type,
    publishedAt: entry.publishedAt,
    releaseDateIso: entry.releaseDateIso,
    riskLevel: entry.riskLevel,
    checksum: entry.checksum ? entry.checksum.value : '',
    downloadUrl: entry.downloadUrl,
    hasWarning: entry.hasWarning,
    isStable: entry.isStable,
    stabilityGrade: entry.stabilityGrade,
    supersedes: entry.supersedes,
    supersededBy: entry.supersededBy
  };
}

function stableStringify(value) {
  return JSON.stringify(value, Object.keys(value).sort());
}

function buildDeltaFeed(previousEntries, currentEntries, generatedAt) {
  const prevById = new Map(previousEntries.map((entry) => [entry.id, entry]));
  const currById = new Map(currentEntries.map((entry) => [entry.id, entry]));

  const added = [];
  const changed = [];
  const removed = [];

  currentEntries.forEach((entry) => {
    const previous = prevById.get(entry.id);
    if (!previous) {
      added.push({
        id: entry.id,
        category: entry.category,
        vendor: entry.vendor,
        channel: entry.channel,
        version: entry.version,
        publishedAt: entry.publishedAt,
        page: entry.page,
        type: 'added'
      });
      return;
    }

    const before = pickSignificantSnapshot(previous);
    const after = pickSignificantSnapshot(entry);
    if (stableStringify(before) !== stableStringify(after)) {
      changed.push({
        id: entry.id,
        category: entry.category,
        vendor: entry.vendor,
        channel: entry.channel,
        version: entry.version,
        publishedAt: entry.publishedAt,
        page: entry.page,
        type: 'changed'
      });
    }
  });

  previousEntries.forEach((entry) => {
    if (!currById.has(entry.id)) {
      removed.push({
        id: entry.id,
        category: entry.category,
        vendor: entry.vendor,
        channel: entry.channel,
        version: entry.version,
        publishedAt: generatedAt,
        page: entry.page,
        type: 'removed'
      });
    }
  });

  const recent = [...added, ...changed].sort((a, b) => {
    const aTime = parseDateValue(a.publishedAt)?.getTime() || 0;
    const bTime = parseDateValue(b.publishedAt)?.getTime() || 0;
    return bTime - aTime;
  }).slice(0, 160);

  if (!recent.length) {
    currentEntries.slice(0, 160).forEach((entry) => {
      recent.push({
        id: entry.id,
        category: entry.category,
        vendor: entry.vendor,
        channel: entry.channel,
        version: entry.version,
        publishedAt: entry.publishedAt,
        page: entry.page,
        type: 'current'
      });
    });
  }

  return {
    generatedAt,
    counts: {
      added: added.length,
      changed: changed.length,
      removed: removed.length,
      recent: recent.length
    },
    added,
    changed,
    removed,
    recent
  };
}

function buildTrustMetrics(entries, validation, generatedAt, sourceResults) {
  const total = entries.length;
  const checksumCount = entries.filter((entry) => entry.checksum && entry.checksum.value).length;
  const releaseNotesCount = entries.filter((entry) => entry.releaseNotesUrl).length;
  const knownIssuesCount = entries.filter((entry) => entry.knownIssuesUrl).length;
  const sourceCount = entries.filter((entry) => Array.isArray(entry.sources) && entry.sources.length > 0).length;
  const stableCount = entries.filter((entry) => entry.isStable).length;

  const now = Date.now();
  const publishedTimes = entries
    .map((entry) => parseDateValue(entry.publishedAt))
    .filter(Boolean)
    .map((date) => date.getTime());

  let newestAgeDays = null;
  let averageAgeDays = null;
  if (publishedTimes.length) {
    const newest = Math.max(...publishedTimes);
    newestAgeDays = Math.max(0, Math.floor((now - newest) / 86400000));
    const totalAge = publishedTimes.reduce((sum, time) => sum + Math.max(0, Math.floor((now - time) / 86400000)), 0);
    averageAgeDays = Math.round((totalAge / publishedTimes.length) * 100) / 100;
  }

  const byVendor = {};
  const byFamily = {};
  const byChannel = {};
  entries.forEach((entry) => {
    byVendor[entry.vendor] = (byVendor[entry.vendor] || 0) + 1;
    byFamily[entry.family] = (byFamily[entry.family] || 0) + 1;
    byChannel[entry.channel] = (byChannel[entry.channel] || 0) + 1;
  });

  return {
    generatedAt,
    totals: {
      entries: total,
      sources: sourceResults.length,
      reachableSources: sourceResults.filter((result) => !result.skipped).length
    },
    coverage: {
      checksumPct: total ? Math.round((checksumCount / total) * 10000) / 100 : 0,
      sourceLinksPct: total ? Math.round((sourceCount / total) * 10000) / 100 : 0,
      releaseNotesPct: total ? Math.round((releaseNotesCount / total) * 10000) / 100 : 0,
      knownIssuesPct: total ? Math.round((knownIssuesCount / total) * 10000) / 100 : 0,
      stablePct: total ? Math.round((stableCount / total) * 10000) / 100 : 0
    },
    freshness: {
      newestAgeDays,
      averageAgeDays
    },
    validation: {
      isValid: validation.isValid,
      errorCount: validation.errors.length,
      warningCount: validation.warnings.length,
      errors: validation.errors.slice(0, 25),
      warnings: validation.warnings.slice(0, 25)
    },
    distribution: {
      byVendor,
      byFamily,
      byChannel
    }
  };
}

function buildCategoryFeed(entries, family, generatedAt) {
  const filtered = entries.filter((entry) => entry.family === family);
  return {
    generatedAt,
    family,
    count: filtered.length,
    drivers: filtered
  };
}

async function main() {
  fs.mkdirSync(feedsDir, { recursive: true });

  const generatedAt = new Date().toISOString();
  const sourceResults = await Promise.all(sources.map(fetchSource));

  let entries = sourceResults.flatMap((result) => result.entries);
  entries = entries.concat(staticFallbackCatalog);

  if (!entries.length) {
    entries = getFallbackFeedEntries(generatedAt);
    process.stdout.write('Using static fallback feed entries.\n');
  }

  sortByPublishedAtDesc(entries);

  const validation = validateEntries(entries, sourceResults);

  const previousEntries = readPreviousFeedEntries();
  const deltaFeed = buildDeltaFeed(previousEntries, entries, generatedAt);
  const trustMetrics = buildTrustMetrics(entries, validation, generatedAt, sourceResults);

  const jsonFeed = {
    generatedAt,
    site: SITE_URL,
    sourceCount: sources.length,
    entryCount: entries.length,
    validation,
    entries
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonFeed, null, 2)}\n`);
  fs.writeFileSync(deltaPath, `${JSON.stringify(deltaFeed, null, 2)}\n`);
  fs.writeFileSync(trustMetricsPath, `${JSON.stringify(trustMetrics, null, 2)}\n`);
  fs.writeFileSync(audioFeedPath, `${JSON.stringify(buildCategoryFeed(entries, 'audio', generatedAt), null, 2)}\n`);
  fs.writeFileSync(networkFeedPath, `${JSON.stringify(buildCategoryFeed(entries, 'network', generatedAt), null, 2)}\n`);

  const rssXml = buildRss(entries, generatedAt);
  fs.writeFileSync(rssPath, rssXml);

  process.stdout.write(`Generated ${path.relative(rootDir, jsonPath)}\n`);
  process.stdout.write(`Generated ${path.relative(rootDir, deltaPath)}\n`);
  process.stdout.write(`Generated ${path.relative(rootDir, trustMetricsPath)}\n`);
  process.stdout.write(`Generated ${path.relative(rootDir, audioFeedPath)}\n`);
  process.stdout.write(`Generated ${path.relative(rootDir, networkFeedPath)}\n`);
  process.stdout.write(`Generated ${path.relative(rootDir, rssPath)}\n`);

  if (!validation.isValid) {
    process.stderr.write(`Validation errors: ${validation.errors.length}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
