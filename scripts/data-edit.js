const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');
const { sourceDefs } = require('./driver-data-sources');
const {
  allowedRisk,
  allowedFamilies,
  allowedChannels,
  allowedVendors,
  normalizeDatasetDriver,
  sortByPublishedAtDesc,
  parseDateValue,
  validateEntries
} = require('./driver-data-schema');

const rootDir = path.resolve(__dirname, '..');
const canonicalDataDir = path.resolve(rootDir, '..', 'driverWeb-data');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const npmExecPath = process.env.npm_execpath;

const entryKeyOrder = [
  'id',
  'vendor',
  'family',
  'channel',
  'version',
  'type',
  'releaseDate',
  'releaseDateIso',
  'publishedAt',
  'downloadUrl',
  'releaseNotesUrl',
  'knownIssuesUrl',
  'warningUrl',
  'redditUrl',
  'hasWarning',
  'isStable',
  'stabilityGrade',
  'riskLevel',
  'sha256sum',
  'checksum',
  'sources',
  'highlights',
  'issueTags',
  'supersedes',
  'supersededBy',
  'osSupport',
  'architectures',
  'previousVersion'
];

function formatLegacyDate(value) {
  const date = value ? new Date(value) : new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  return `${month}-${day}-${year}`;
}

function readDataset(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      lastUpdated: formatLegacyDate(),
      warningMessage: null,
      drivers: []
    };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return {
    ...parsed,
    drivers: Array.isArray(parsed.drivers) ? parsed.drivers : []
  };
}

function stableObject(input, preferredOrder = []) {
  if (Array.isArray(input)) {
    return input.map((item) => stableObject(item, preferredOrder));
  }

  if (!input || typeof input !== 'object') return input;

  const ordered = {};
  const included = new Set();

  preferredOrder.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(input, key)) {
      ordered[key] = stableObject(input[key], []);
      included.add(key);
    }
  });

  Object.keys(input)
    .filter((key) => !included.has(key))
    .sort((a, b) => a.localeCompare(b))
    .forEach((key) => {
      ordered[key] = stableObject(input[key], []);
    });

  return ordered;
}

function normalizeDatasetEntries(source, dataset) {
  const normalized = dataset.drivers.map((driver, index) => normalizeDatasetDriver(source, dataset, driver, index));
  sortByPublishedAtDesc(normalized);
  return normalized;
}

function ensureValidNormalizedEntries(entries, source) {
  const validation = validateEntries(entries, [{ source, entries }], { globalOrderLabel: source.category });
  if (!validation.isValid) {
    const errors = validation.errors.slice(0, 12).map((item) => `- ${item}`).join('\n');
    throw new Error(`Validation failed:\n${errors}`);
  }
}

function writeDataset(filePath, dataset) {
  const topKeys = ['lastUpdated', 'warningMessage', 'drivers'];
  const ordered = stableObject(
    {
      ...dataset,
      drivers: dataset.drivers.map((entry) => stableObject(entry, entryKeyOrder))
    },
    topKeys
  );
  fs.writeFileSync(filePath, `${JSON.stringify(ordered, null, 2)}\n`);
}

function normalizeCsv(value, { lowerCase = false } = {}) {
  const items = String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  const out = [];
  const seen = new Set();
  items.forEach((item) => {
    const normalized = lowerCase ? item.toLowerCase() : item;
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

function parseBooleanInput(value, fallback) {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return fallback;
  if (['y', 'yes', 'true', '1'].includes(text)) return true;
  if (['n', 'no', 'false', '0'].includes(text)) return false;
  return fallback;
}

function printDivider() {
  process.stdout.write('--------------------------------------------------\n');
}

function ask(rl, prompt) {
  return new Promise((resolve) => rl.question(prompt, (answer) => resolve(answer)));
}

async function chooseFromMenu(rl, title, items) {
  process.stdout.write(`${title}\n`);
  items.forEach((item, index) => {
    process.stdout.write(`${index + 1}. ${item}\n`);
  });

  while (true) {
    const raw = await ask(rl, 'Choose number: ');
    const value = Number(raw.trim());
    if (Number.isInteger(value) && value >= 1 && value <= items.length) {
      return value - 1;
    }
    process.stdout.write('Invalid choice. Try again.\n');
  }
}

async function promptText(rl, label, defaultValue = '') {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await ask(rl, `${label}${suffix}: `);
  if (!answer.trim()) return defaultValue;
  return answer.trim();
}

async function promptRequired(rl, label, defaultValue = '') {
  while (true) {
    const value = await promptText(rl, label, defaultValue);
    if (value) return value;
    process.stdout.write('This field is required.\n');
  }
}

async function promptBoolean(rl, label, defaultValue) {
  const suffix = defaultValue ? '[Y/n]' : '[y/N]';
  const answer = await ask(rl, `${label} ${suffix}: `);
  return parseBooleanInput(answer, defaultValue);
}

async function promptEnum(rl, label, allowedValues, defaultValue) {
  while (true) {
    const value = (await promptText(rl, label, defaultValue)).toLowerCase();
    if (allowedValues.has(value)) return value;
    process.stdout.write(`Invalid value. Allowed: ${Array.from(allowedValues).join(', ')}\n`);
  }
}

function printRecentEntries(entries, count = 15) {
  const list = entries.slice(0, count);
  if (!list.length) {
    process.stdout.write('No entries found.\n');
    return;
  }

  list.forEach((entry, index) => {
    const publishedAt = entry.publishedAt || entry.releaseDateIso || '';
    process.stdout.write(`${index + 1}. ${entry.id} | ${entry.version} ${entry.type || ''} | ${publishedAt}\n`);
  });
}

async function pickEntryIndex(rl, entries, actionLabel) {
  if (!entries.length) {
    process.stdout.write('No entries available.\n');
    return null;
  }

  while (true) {
    printRecentEntries(entries, Math.min(entries.length, 20));
    const raw = await ask(rl, `Select ${actionLabel} entry by index or id (q to go back): `);
    const trimmed = raw.trim();
    if (!trimmed) {
      process.stdout.write('Enter an index, id, or q.\n');
      continue;
    }

    if (trimmed.toLowerCase() === 'q') {
      return null;
    }

    const numeric = Number(trimmed);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= entries.length) {
      return numeric - 1;
    }

    const indexById = entries.findIndex((entry) => entry.id === trimmed);
    if (indexById >= 0) {
      return indexById;
    }

    process.stdout.write('Entry not found. Try again or type q to go back.\n');
  }
}

async function collectDriverInput(rl, source, existing, isEditMode) {
  const base = existing ? { ...existing } : {};
  const regenerateId = isEditMode ? await promptBoolean(rl, 'Regenerate ID from current fields', true) : true;

  const version = await promptRequired(rl, 'Version', base.version || '');
  const type = await promptText(rl, 'Type', base.type || '');
  const releaseDate = await promptRequired(rl, 'Release date (example: Nov 19, 2025)', base.releaseDate || base.releaseDateIso || '');
  const publishedAt = await promptText(rl, 'Published at (ISO/date, blank to auto from release date)', base.publishedAt || '');
  const downloadUrl = await promptText(rl, 'Download URL', base.downloadUrl || '');
  const releaseNotesUrl = await promptText(rl, 'Release notes URL', base.releaseNotesUrl || '');
  const knownIssuesUrl = await promptText(rl, 'Known issues URL', base.knownIssuesUrl || '');
  const redditUrl = await promptText(rl, 'Community URL (Reddit/thread)', base.redditUrl || '');
  const warningUrl = await promptText(rl, 'Warning URL', base.warningUrl || '');
  const hasWarning = await promptBoolean(rl, 'Has warning', Boolean(base.hasWarning));
  const isStable = await promptBoolean(rl, 'Marked stable', Boolean(base.isStable));
  const stabilityGrade = await promptText(rl, 'Stability grade', base.stabilityGrade || '');
  const previousVersion = await promptText(rl, 'Previous version', base.previousVersion || '');
  const supersedes = await promptText(rl, 'Supersedes', base.supersedes || previousVersion || '');
  const supersededBy = await promptText(rl, 'Superseded by', base.supersededBy || '');
  const checksumInput = await promptText(rl, 'SHA-256 checksum', base.sha256sum || (base.checksum && base.checksum.value) || '');

  const riskOptions = ['auto', ...Array.from(allowedRisk)];
  const defaultRisk = base.riskLevel && allowedRisk.has(String(base.riskLevel).toLowerCase()) ? String(base.riskLevel).toLowerCase() : 'auto';
  process.stdout.write(`Risk options: ${riskOptions.join(', ')}\n`);
  let riskLevel = '';
  while (!riskOptions.includes(riskLevel)) {
    riskLevel = (await promptText(rl, 'Risk level', defaultRisk)).toLowerCase();
    if (!riskOptions.includes(riskLevel)) {
      process.stdout.write(`Invalid value. Allowed: ${riskOptions.join(', ')}\n`);
    }
  }

  process.stdout.write(`Vendor options: ${Array.from(allowedVendors).join(', ')}\n`);
  const vendor = await promptEnum(rl, 'Vendor', allowedVendors, (base.vendor || source.vendor).toLowerCase());
  process.stdout.write(`Family options: ${Array.from(allowedFamilies).join(', ')}\n`);
  const family = await promptEnum(rl, 'Family', allowedFamilies, (base.family || source.family).toLowerCase());
  process.stdout.write(`Channel options: ${Array.from(allowedChannels).join(', ')}\n`);
  const channel = await promptEnum(rl, 'Channel', allowedChannels, (base.channel || source.channel).toLowerCase());

  const osSupportRaw = await promptText(rl, 'OS support (comma separated)', Array.isArray(base.osSupport) ? base.osSupport.join(', ') : 'windows-10, windows-11');
  const architecturesRaw = await promptText(rl, 'Architectures (comma separated)', Array.isArray(base.architectures) ? base.architectures.join(', ') : 'x64');
  const highlightsRaw = await promptText(rl, 'Highlights (comma separated)', Array.isArray(base.highlights) ? base.highlights.join(', ') : '');
  const issueTagsRaw = await promptText(rl, 'Issue tags (comma separated)', Array.isArray(base.issueTags) ? base.issueTags.join(', ') : '');

  let idOverride = '';
  if (!regenerateId) {
    idOverride = await promptRequired(rl, 'ID override', base.id || '');
  } else {
    idOverride = await promptText(rl, 'ID override (leave blank for auto)', '');
  }

  return {
    ...(isEditMode ? base : {}),
    id: idOverride,
    vendor,
    family,
    channel,
    version,
    type,
    releaseDate,
    publishedAt,
    downloadUrl,
    releaseNotesUrl,
    knownIssuesUrl,
    redditUrl,
    warningUrl,
    hasWarning,
    isStable,
    stabilityGrade,
    riskLevel: riskLevel === 'auto' ? '' : riskLevel,
    previousVersion,
    supersedes,
    supersededBy,
    sha256sum: checksumInput,
    checksum: checksumInput ? { algorithm: 'sha256', value: checksumInput } : null,
    osSupport: normalizeCsv(osSupportRaw, { lowerCase: true }),
    architectures: normalizeCsv(architecturesRaw, { lowerCase: true }),
    highlights: normalizeCsv(highlightsRaw),
    issueTags: normalizeCsv(issueTagsRaw, { lowerCase: true })
  };
}

function summarizeSingleEntry(entry) {
  return `${entry.id} | ${entry.version} ${entry.type || ''} | ${entry.releaseDateIso || entry.publishedAt || ''}`;
}

function touchDatasetLastUpdated(dataset) {
  const latest = dataset.drivers
    .map((entry) => parseDateValue(entry.publishedAt || entry.releaseDateIso || entry.releaseDate))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  dataset.lastUpdated = formatLegacyDate(latest ? latest.toISOString() : undefined);
}

function runDataSync(changedFilePath) {
  process.stdout.write('\nRunning post-save sync: npm run data:sync\n');
  const relative = path.relative(rootDir, changedFilePath);
  const command = npmExecPath ? process.execPath : npmCmd;
  const args = npmExecPath ? [npmExecPath, 'run', 'data:sync'] : ['run', 'data:sync'];
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATA_SYNC_EXTRA: relative
    }
  });

  if (result.error) {
    throw result.error;
  }

  const status = typeof result.status === 'number' ? result.status : 1;
  if (status !== 0) {
    throw new Error(`data:sync failed with exit code ${status}`);
  }
}

async function main() {
  if (!fs.existsSync(canonicalDataDir)) {
    throw new Error(`Canonical data directory not found: ${canonicalDataDir}`);
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    printDivider();
    const datasetIndex = await chooseFromMenu(
      rl,
      'Select dataset',
      sourceDefs.map((source) => `${source.editorLabel} (${source.filename})`)
    );
    const source = sourceDefs[datasetIndex];
    const datasetPath = path.join(canonicalDataDir, source.filename);
    const dataset = readDataset(datasetPath);
    dataset.drivers = normalizeDatasetEntries(source, dataset);
    let hasChanges = false;

    while (true) {
      printDivider();
      const actionIndex = await chooseFromMenu(rl, 'Select action', ['List recent entries', 'Add entry', 'Edit entry', 'Remove entry']);
      const action = ['list', 'add', 'edit', 'remove'][actionIndex];

      if (action === 'list') {
        printDivider();
        printRecentEntries(dataset.drivers, 20);
        return;
      }

      if (action === 'add') {
        printDivider();
        const input = await collectDriverInput(rl, source, null, false);
        dataset.drivers.unshift(input);
        hasChanges = true;
        break;
      }

      if (action === 'edit') {
        printDivider();
        const index = await pickEntryIndex(rl, dataset.drivers, 'edit');
        if (index === null) {
          process.stdout.write('Back to action menu.\n');
          continue;
        }
        process.stdout.write(`Editing: ${summarizeSingleEntry(dataset.drivers[index])}\n`);
        const input = await collectDriverInput(rl, source, dataset.drivers[index], true);
        dataset.drivers[index] = input;
        hasChanges = true;
        break;
      }

      if (action === 'remove') {
        printDivider();
        const index = await pickEntryIndex(rl, dataset.drivers, 'remove');
        if (index === null) {
          process.stdout.write('Back to action menu.\n');
          continue;
        }
        const target = dataset.drivers[index];
        process.stdout.write(`Remove: ${summarizeSingleEntry(target)}\n`);
        const confirmed = await promptBoolean(rl, 'Confirm remove', false);
        if (!confirmed) {
          process.stdout.write('Remove cancelled.\n');
          continue;
        }
        dataset.drivers.splice(index, 1);
        hasChanges = true;
        break;
      }
    }

    if (!hasChanges) {
      return;
    }

    dataset.drivers = normalizeDatasetEntries(source, dataset);
    touchDatasetLastUpdated(dataset);
    ensureValidNormalizedEntries(dataset.drivers, source);
    writeDataset(datasetPath, dataset);

    printDivider();
    process.stdout.write(`Saved ${datasetPath}\n`);
    process.stdout.write(`Total entries: ${dataset.drivers.length}\n`);
    if (dataset.drivers.length) {
      process.stdout.write(`Newest: ${summarizeSingleEntry(dataset.drivers[0])}\n`);
    }

    runDataSync(datasetPath);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error.message || error)}\n`);
  process.exit(1);
});
