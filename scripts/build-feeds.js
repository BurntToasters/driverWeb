const fs = require('fs');
const https = require('https');
const path = require('path');

const SITE_URL = 'https://driverhub.win';
const rootDir = path.resolve(__dirname, '..');
const feedsDir = path.join(rootDir, 'feeds');

const sources = [
  { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-game-ready.json', category: 'NVIDIA Game Ready', brand: 'nvidia', page: '/display' },
  { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-studio.json', category: 'NVIDIA Studio', brand: 'nvidia', page: '/display' },
  { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/intel-game-on.json', category: 'Intel Game On', brand: 'intel', page: '/display' },
  { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/intel-pro.json', category: 'Intel Pro', brand: 'intel', page: '/display' },
  { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-game-ready-laptop.json', category: 'NVIDIA Laptop Game Ready', brand: 'nvidia', page: '/display/laptop' },
  { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-studio-laptop.json', category: 'NVIDIA Laptop Studio', brand: 'nvidia', page: '/display/laptop' }
];

function parseDateValue(value) {
  if (!value) return null;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  const slashMatch = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]) - 1;
    const day = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) {
      year += 2000;
    }
    const parsed = new Date(year, month, day);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

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
  if (entry.brand) {
    params.set('brand', entry.brand);
  }
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

async function fetchSource(source) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetchWithFallback(source.url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed ${source.url}: ${response.status}`);
    }

    const data = await response.json();
    const drivers = Array.isArray(data.drivers) ? data.drivers : [];

    return drivers.map((driver, index) => {
      const publishedAt = driver.publishedAt || driver.releaseDate || data.lastUpdated || null;
      const publishedDate = parseDateValue(publishedAt);
      return {
        id: `${source.category}|${driver.version || 'unknown'}|${index}`,
        category: source.category,
        brand: source.brand,
        version: driver.version || 'Unknown version',
        type: driver.type || '',
        releaseDate: driver.releaseDate || data.lastUpdated || '',
        publishedAt: publishedDate ? publishedDate.toISOString() : null,
        page: source.page,
        downloadUrl: driver.downloadUrl || '',
        releaseNotesUrl: driver.releaseNotesUrl || '',
        knownIssuesUrl: driver.knownIssuesUrl || '',
        previousVersion: driver.previousVersion || '',
        isStable: Boolean(driver.isStable),
        stabilityGrade: driver.stabilityGrade || ''
      };
    });
  } catch (error) {
    process.stderr.write(`Feed source skipped: ${source.url}\n`);
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

function buildRss(entries, generatedAtIso) {
  const items = entries.slice(0, 80).map((entry) => {
    const title = `${entry.category} ${entry.version}${entry.type ? ` - ${entry.type}` : ''}`;
    const link = buildDriverLink(entry);
    const description = [
      `Category: ${entry.category}`,
      entry.releaseDate ? `Release date: ${entry.releaseDate}` : '',
      entry.stabilityGrade ? `Stability: ${entry.stabilityGrade}` : '',
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

function getStaticFallbackEntries(generatedAtIso) {
  return [
    {
      id: 'fallback|graphics',
      category: 'Driver Feed Status',
      brand: 'nvidia',
      version: 'Live feed temporarily unavailable',
      type: 'Use on-site search (Ctrl+K) for latest results',
      releaseDate: '',
      publishedAt: generatedAtIso,
      page: '/display',
      downloadUrl: '',
      releaseNotesUrl: '',
      knownIssuesUrl: '',
      previousVersion: '',
      isStable: false,
      stabilityGrade: ''
    },
    {
      id: 'fallback|chipset',
      category: 'Driver Feed Status',
      brand: 'intel',
      version: 'Chipset listings remain available',
      type: 'Browse /chipset for Intel and AMD options',
      releaseDate: '',
      publishedAt: generatedAtIso,
      page: '/chipset',
      downloadUrl: '',
      releaseNotesUrl: '',
      knownIssuesUrl: '',
      previousVersion: '',
      isStable: false,
      stabilityGrade: ''
    }
  ];
}

async function main() {
  fs.mkdirSync(feedsDir, { recursive: true });
  const jsonPath = path.join(feedsDir, 'drivers.json');
  const rssPath = path.join(feedsDir, 'drivers.xml');

  const sourceResults = await Promise.all(sources.map(fetchSource));
  let entries = sourceResults.flat();
  const generatedAt = new Date().toISOString();

  if (!entries.length && fs.existsSync(jsonPath)) {
    try {
      const existingFeed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(existingFeed.entries) && existingFeed.entries.length > 0) {
        entries = existingFeed.entries;
        process.stdout.write('Reused existing non-empty feed entries due fetch failures.\n');
      }
    } catch (error) {
      process.stderr.write('Existing feed could not be reused.\n');
    }
  }

  if (!entries.length) {
    entries = getStaticFallbackEntries(generatedAt);
    process.stdout.write('Using static fallback feed entries.\n');
  }

  entries.sort((a, b) => {
    const aTime = parseDateValue(a.publishedAt)?.getTime() || 0;
    const bTime = parseDateValue(b.publishedAt)?.getTime() || 0;
    return bTime - aTime;
  });

  const jsonFeed = {
    generatedAt,
    site: SITE_URL,
    sourceCount: sources.length,
    entryCount: entries.length,
    entries
  };

  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonFeed, null, 2)}\n`);

  const rssXml = buildRss(entries, generatedAt);
  fs.writeFileSync(rssPath, rssXml);

  process.stdout.write(`Generated ${path.relative(rootDir, jsonPath)}\n`);
  process.stdout.write(`Generated ${path.relative(rootDir, rssPath)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
