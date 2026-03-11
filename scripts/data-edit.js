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

const scriptVersion = '1.0.0';
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

const stabilityGradeOptions = ['A+', 'A', 'A-', 'B', 'C', 'D', 'F'];
const stabilityGradeSet = new Set(stabilityGradeOptions);
const warningCodeByDataset = {
  'nvidia|graphics|game-ready': 'nvgrd',
  'nvidia|graphics-laptop|game-ready': 'nvgrl',
  'nvidia|graphics|studio': 'nvsd',
  'nvidia|graphics-laptop|studio': 'nvsl'
};
const nvidiaDesktopMirrorKeyBySource = {
  'nvidia-game-ready': 'nvidia-game-ready-laptop',
  'nvidia-studio': 'nvidia-studio-laptop'
};
const promptBack = Symbol('prompt-back');

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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function sourceKeyForWarning(vendor, family, channel) {
  return `${String(vendor || '').toLowerCase()}|${String(family || '').toLowerCase()}|${String(channel || '').toLowerCase()}`;
}

function deriveWarningCode(vendor, family, channel) {
  return warningCodeByDataset[sourceKeyForWarning(vendor, family, channel)] || '';
}

function normalizeDateKey(value) {
  const parsed = parseDateValue(value);
  if (!parsed) return String(value || '').trim();
  return parsed.toISOString().slice(0, 10);
}

function convertDesktopUrlToLaptop(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (value.includes('desktop-notebook')) return value;
  let updated = value.replace(/-desktop-/gi, '-notebook-');
  updated = updated.replace(/desktop-win/gi, 'notebook-win');
  updated = updated.replace(/-desktop-win/gi, '-notebook-win');
  updated = updated.replace(/desktop-win10-win11/gi, 'notebook-win10-win11');
  return updated;
}

function mapWarningUrlToCode(warningUrl, targetCode, version) {
  if (!targetCode) return String(warningUrl || '').trim();

  const fallback = `/display/warn?${targetCode}=${encodeURIComponent(String(version || '').trim())}`;
  const raw = String(warningUrl || '').trim();
  if (!raw) return fallback;

  try {
    const parsed = new URL(raw, 'https://driverhub.win');
    let value = '';
    ['nvgrd', 'nvgrl', 'nvsd', 'nvsl'].forEach((code) => {
      if (parsed.searchParams.has(code)) {
        value = parsed.searchParams.get(code) || value;
        parsed.searchParams.delete(code);
      }
    });
    const finalVersion = String(version || value || '').trim();
    if (!finalVersion) return fallback;
    parsed.searchParams.set(targetCode, finalVersion);
    if (raw.startsWith('/')) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function validateWarningUrlForDataset(warningUrl, vendor, family, channel, version) {
  const expectedCode = deriveWarningCode(vendor, family, channel);
  if (!warningUrl) {
    return { isValid: false, reason: 'Warning URL is required when "Has warning" is enabled.' };
  }

  if (!expectedCode) {
    return { isValid: true, reason: '' };
  }

  try {
    const parsed = new URL(String(warningUrl), 'https://driverhub.win');
    const value = parsed.searchParams.get(expectedCode);
    if (!value) {
      return { isValid: false, reason: `Warning URL must include ${expectedCode}=<version> for this dataset.` };
    }
    if (String(version || '').trim() && value !== String(version).trim()) {
      return { isValid: false, reason: `Warning URL ${expectedCode} value should match version ${version}.` };
    }
    return { isValid: true, reason: '' };
  } catch {
    return { isValid: false, reason: 'Warning URL is not a valid URL/path.' };
  }
}

function getMirrorSource(source) {
  const mirrorKey = nvidiaDesktopMirrorKeyBySource[source.key];
  if (!mirrorKey) return null;
  return sourceDefs.find((entry) => entry.key === mirrorKey) || null;
}

function findMirrorEntryIndex(mirrorEntries, baseEntry, mirrorCandidate, mirrorSource) {
  const idCandidates = [];
  const baseId = String((baseEntry && baseEntry.id) || '').trim();
  if (baseId) {
    idCandidates.push(baseId.replace('|graphics|', '|graphics-laptop|'));
  }
  const candidateId = String((mirrorCandidate && mirrorCandidate.id) || '').trim();
  if (candidateId) idCandidates.push(candidateId);

  for (let i = 0; i < idCandidates.length; i += 1) {
    const id = idCandidates[i];
    const index = mirrorEntries.findIndex((entry) => entry.id === id);
    if (index >= 0) return index;
  }

  const version = String((mirrorCandidate && mirrorCandidate.version) || (baseEntry && baseEntry.version) || '').trim();
  const targetDate = normalizeDateKey(
    (mirrorCandidate && (mirrorCandidate.releaseDateIso || mirrorCandidate.releaseDate || mirrorCandidate.publishedAt))
      || (baseEntry && (baseEntry.releaseDateIso || baseEntry.releaseDate || baseEntry.publishedAt))
      || ''
  );
  if (!version) return -1;

  return mirrorEntries.findIndex((entry) => {
    const entryDate = normalizeDateKey(entry.releaseDateIso || entry.releaseDate || entry.publishedAt || '');
    const sameDate = targetDate ? entryDate === targetDate : true;
    return entry.version === version && entry.channel === mirrorSource.channel && sameDate;
  });
}

function buildMirrorRawEntry(sourceEntry, mirrorSource) {
  const version = String(sourceEntry.version || '').trim();
  const warningCode = deriveWarningCode(mirrorSource.vendor, mirrorSource.family, mirrorSource.channel);
  const warningUrl = sourceEntry.hasWarning
    ? mapWarningUrlToCode(sourceEntry.warningUrl, warningCode, version)
    : '';

  return {
    ...sourceEntry,
    id: '',
    vendor: mirrorSource.vendor,
    family: mirrorSource.family,
    channel: mirrorSource.channel,
    warningUrl,
    downloadUrl: convertDesktopUrlToLaptop(sourceEntry.downloadUrl || '')
  };
}

function buildEntrySnapshotMap(entries) {
  const map = new Map();
  (entries || []).forEach((entry) => {
    map.set(entry.id, stableObject(entry, entryKeyOrder));
  });
  return map;
}

function serializeForDiff(entry) {
  return JSON.stringify(entry);
}

function buildDatasetDiff(filePath, source, beforeDataset, afterDataset) {
  const beforeEntries = Array.isArray(beforeDataset.drivers) ? beforeDataset.drivers : [];
  const afterEntries = Array.isArray(afterDataset.drivers) ? afterDataset.drivers : [];
  const beforeMap = buildEntrySnapshotMap(beforeEntries);
  const afterMap = buildEntrySnapshotMap(afterEntries);

  const added = [];
  const removed = [];
  const changed = [];

  afterMap.forEach((entry, id) => {
    if (!beforeMap.has(id)) {
      added.push(id);
      return;
    }
    const before = beforeMap.get(id);
    if (serializeForDiff(before) !== serializeForDiff(entry)) {
      changed.push(id);
    }
  });

  beforeMap.forEach((_entry, id) => {
    if (!afterMap.has(id)) {
      removed.push(id);
    }
  });

  const lastUpdatedChanged = String(beforeDataset.lastUpdated || '') !== String(afterDataset.lastUpdated || '');
  const warningMessageChanged = String(beforeDataset.warningMessage || '') !== String(afterDataset.warningMessage || '');

  return {
    filePath,
    label: source.editorLabel,
    source,
    beforeMap,
    afterMap,
    added,
    removed,
    changed,
    lastUpdatedChanged,
    warningMessageChanged
  };
}

function printDiffPreview(diff) {
  process.stdout.write(`${diff.label} (${path.basename(diff.filePath)}): +${diff.added.length} ~${diff.changed.length} -${diff.removed.length}\n`);
  if (diff.lastUpdatedChanged) {
    process.stdout.write('- lastUpdated changed\n');
  }
  if (diff.warningMessageChanged) {
    process.stdout.write('- warningMessage changed\n');
  }

  const changeList = [
    ...diff.added.map((id) => ({ type: 'added', id })),
    ...diff.changed.map((id) => ({ type: 'changed', id })),
    ...diff.removed.map((id) => ({ type: 'removed', id }))
  ];

  const maxEntries = 6;
  changeList.slice(0, maxEntries).forEach((change) => {
    process.stdout.write(`\n[${change.type}] ${change.id}\n`);
    const beforeEntry = diff.beforeMap.get(change.id);
    const afterEntry = diff.afterMap.get(change.id);
    process.stdout.write('--- before\n');
    process.stdout.write(`${beforeEntry ? `${JSON.stringify(beforeEntry, null, 2)}\n` : '<none>\n'}`);
    process.stdout.write('+++ after\n');
    process.stdout.write(`${afterEntry ? `${JSON.stringify(afterEntry, null, 2)}\n` : '<none>\n'}`);
  });

  if (changeList.length > maxEntries) {
    process.stdout.write(`... ${changeList.length - maxEntries} additional entry changes omitted.\n`);
  }
}

function createBackup(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const backupPath = `${filePath}.bak`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function printDeltaPreview(changedIds) {
  const deltaPath = path.join(rootDir, 'feeds', 'drivers-delta.json');
  if (!fs.existsSync(deltaPath)) {
    process.stdout.write('Delta preview unavailable: feeds/drivers-delta.json missing.\n');
    return;
  }

  let delta = null;
  try {
    delta = JSON.parse(fs.readFileSync(deltaPath, 'utf8'));
  } catch {
    process.stdout.write('Delta preview unavailable: could not parse feeds/drivers-delta.json.\n');
    return;
  }

  if (!delta || typeof delta !== 'object') {
    process.stdout.write('Delta preview unavailable: malformed delta feed.\n');
    return;
  }

  const counts = delta.counts || {};
  process.stdout.write('Delta preview:\n');
  process.stdout.write(`- Added: ${counts.added || 0}\n`);
  process.stdout.write(`- Changed: ${counts.changed || 0}\n`);
  process.stdout.write(`- Removed: ${counts.removed || 0}\n`);

  const changedIdSet = new Set(Array.from(changedIds || []).filter(Boolean));
  const recent = Array.isArray(delta.recent) ? delta.recent : [];
  let list = recent.filter((item) => changedIdSet.has(item.id));
  if (!list.length) {
    list = recent.slice(0, 8);
  } else {
    list = list.slice(0, 8);
  }

  if (!list.length) {
    process.stdout.write('- No recent delta rows.\n');
    return;
  }

  list.forEach((item) => {
    process.stdout.write(`- [${item.type || 'current'}] ${item.id} | ${item.version || ''} | ${item.publishedAt || ''}\n`);
  });
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

function isBackInput(value) {
  return String(value || '').trim().toLowerCase() === 'q';
}

async function chooseFromMenu(rl, title, items, options = {}) {
  const allowBack = Boolean(options.allowBack);
  process.stdout.write(`${title}\n`);
  items.forEach((item, index) => {
    process.stdout.write(`${index + 1}. ${item}\n`);
  });

  while (true) {
    const raw = await ask(rl, allowBack ? 'Choose number (q to go back): ' : 'Choose number: ');
    const trimmed = raw.trim();
    if (allowBack && isBackInput(trimmed)) {
      return null;
    }
    const value = Number(trimmed);
    if (Number.isInteger(value) && value >= 1 && value <= items.length) {
      return value - 1;
    }
    process.stdout.write(allowBack ? 'Invalid choice. Try again or type q to go back.\n' : 'Invalid choice. Try again.\n');
  }
}

async function promptText(rl, label, defaultValue = '', options = {}) {
  const allowBack = Boolean(options.allowBack);
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await ask(rl, `${label}${suffix}: `);
  if (allowBack && isBackInput(answer)) {
    return promptBack;
  }
  if (!answer.trim()) return defaultValue;
  return answer.trim();
}

async function promptRequired(rl, label, defaultValue = '', options = {}) {
  while (true) {
    const value = await promptText(rl, label, defaultValue, options);
    if (value === promptBack) return promptBack;
    if (value) return value;
    process.stdout.write('This field is required.\n');
  }
}

async function promptBoolean(rl, label, defaultValue, options = {}) {
  const allowBack = Boolean(options.allowBack);
  const suffix = defaultValue ? '[Y/n]' : '[y/N]';
  const answer = await ask(rl, `${label} ${suffix}: `);
  if (allowBack && isBackInput(answer)) {
    return promptBack;
  }
  return parseBooleanInput(answer, defaultValue);
}

async function promptEnum(rl, label, allowedValues, defaultValue, options = {}) {
  while (true) {
    const value = await promptText(rl, label, defaultValue, options);
    if (value === promptBack) return promptBack;
    const normalized = value.toLowerCase();
    if (allowedValues.has(normalized)) return normalized;
    process.stdout.write(`Invalid value. Allowed: ${Array.from(allowedValues).join(', ')}\n`);
  }
}

async function promptStabilityGrade(rl, defaultValue = '', options = {}) {
  const defaultLabel = defaultValue || 'none';
  while (true) {
    const value = await promptText(rl, `Stability grade (${stabilityGradeOptions.join('/')}, or none)`, defaultLabel, options);
    if (value === promptBack) return promptBack;
    const normalized = value.trim().toUpperCase();
    if (!normalized || normalized === 'NONE') return '';
    if (stabilityGradeSet.has(normalized)) return normalized;
    process.stdout.write(`Invalid grade. Allowed: ${stabilityGradeOptions.join(', ')}, or none.\n`);
  }
}

function deriveDefaultWarningUrl(vendor, family, channel, version) {
  const normalizedVersion = String(version || '').trim();
  if (!normalizedVersion) return '';
  const code = deriveWarningCode(vendor, family, channel);
  if (!code) return '';
  return `/display/warn?${code}=${encodeURIComponent(normalizedVersion)}`;
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

function findPreviousActiveStep(steps, index, draft) {
  for (let i = index - 1; i >= 0; i -= 1) {
    const step = steps[i];
    const active = typeof step.when === 'function' ? step.when(draft) : true;
    if (active) return i;
  }
  return -1;
}

async function collectDriverInput(rl, source, existing, isEditMode) {
  const base = existing ? { ...existing } : {};
  const effectiveVendor = String(base.vendor || source.vendor || '').toLowerCase();
  const defaultType = base.type || (effectiveVendor === 'nvidia' ? 'WHQL' : '');
  const riskOptions = ['auto', ...Array.from(allowedRisk)];
  const defaultRisk = base.riskLevel && allowedRisk.has(String(base.riskLevel).toLowerCase()) ? String(base.riskLevel).toLowerCase() : 'low';

  const draft = {
    regenerateId: true,
    version: base.version || '',
    type: defaultType,
    releaseDate: base.releaseDate || base.releaseDateIso || '',
    publishedAt: base.publishedAt || '',
    downloadUrl: base.downloadUrl || '',
    releaseNotesUrl: base.releaseNotesUrl || '',
    knownIssuesUrl: base.knownIssuesUrl || '',
    redditUrl: base.redditUrl || '',
    hasWarning: Boolean(base.hasWarning),
    isStable: Boolean(base.isStable),
    vendor: (base.vendor || source.vendor).toLowerCase(),
    family: (base.family || source.family).toLowerCase(),
    channel: (base.channel || source.channel).toLowerCase(),
    stabilityGrade: base.stabilityGrade || '',
    warningUrl: base.warningUrl || '',
    previousVersion: base.previousVersion || '',
    supersedes: base.supersedes || '',
    supersededBy: base.supersededBy || '',
    checksumInput: base.sha256sum || (base.checksum && base.checksum.value) || '',
    riskLevel: defaultRisk,
    osSupportRaw: Array.isArray(base.osSupport) ? base.osSupport.join(', ') : 'windows-10, windows-11',
    architecturesRaw: Array.isArray(base.architectures) ? base.architectures.join(', ') : 'x64',
    highlightsRaw: Array.isArray(base.highlights) ? base.highlights.join(', ') : '',
    issueTagsRaw: Array.isArray(base.issueTags) ? base.issueTags.join(', ') : '',
    idOverride: ''
  };

  const steps = [];
  if (isEditMode) {
    steps.push({
      key: 'regenerateId',
      run: async () => promptBoolean(rl, 'Regenerate ID from current fields', draft.regenerateId, { allowBack: true }),
      apply: (value) => {
        draft.regenerateId = value;
      }
    });
  }

  steps.push(
    {
      key: 'version',
      run: async () => promptRequired(rl, 'Version', draft.version, { allowBack: true }),
      apply: (value) => {
        draft.version = value;
      }
    },
    {
      key: 'type',
      run: async () => promptText(rl, 'Type', draft.type, { allowBack: true }),
      apply: (value) => {
        draft.type = value;
      }
    },
    {
      key: 'releaseDate',
      run: async () => promptRequired(rl, 'Release date (example: Nov 19, 2025)', draft.releaseDate, { allowBack: true }),
      apply: (value) => {
        draft.releaseDate = value;
      }
    },
    {
      key: 'publishedAt',
      run: async () => promptText(rl, 'Published at (ISO/date, blank to auto from release date)', draft.publishedAt, { allowBack: true }),
      apply: (value) => {
        draft.publishedAt = value;
      }
    },
    {
      key: 'downloadUrl',
      run: async () => promptText(rl, 'Download URL', draft.downloadUrl, { allowBack: true }),
      apply: (value) => {
        draft.downloadUrl = value;
      }
    },
    {
      key: 'releaseNotesUrl',
      run: async () => promptText(rl, 'Release notes URL', draft.releaseNotesUrl, { allowBack: true }),
      apply: (value) => {
        draft.releaseNotesUrl = value;
      }
    },
    {
      key: 'knownIssuesUrl',
      run: async () => promptText(rl, 'Known issues URL', draft.knownIssuesUrl, { allowBack: true }),
      apply: (value) => {
        draft.knownIssuesUrl = value;
      }
    },
    {
      key: 'redditUrl',
      run: async () => promptText(rl, 'Community URL (Reddit/thread)', draft.redditUrl, { allowBack: true }),
      apply: (value) => {
        draft.redditUrl = value;
      }
    },
    {
      key: 'hasWarning',
      run: async () => promptBoolean(rl, 'Has warning', draft.hasWarning, { allowBack: true }),
      apply: (value) => {
        draft.hasWarning = value;
      }
    },
    {
      key: 'isStable',
      run: async () => promptBoolean(rl, 'Marked stable', draft.isStable, { allowBack: true }),
      apply: (value) => {
        draft.isStable = value;
      }
    },
    {
      key: 'vendor',
      run: async () => {
        process.stdout.write(`Vendor options: ${Array.from(allowedVendors).join(', ')}\n`);
        return promptEnum(rl, 'Vendor', allowedVendors, draft.vendor, { allowBack: true });
      },
      apply: (value) => {
        draft.vendor = value;
      }
    },
    {
      key: 'family',
      run: async () => {
        process.stdout.write(`Family options: ${Array.from(allowedFamilies).join(', ')}\n`);
        return promptEnum(rl, 'Family', allowedFamilies, draft.family, { allowBack: true });
      },
      apply: (value) => {
        draft.family = value;
      }
    },
    {
      key: 'channel',
      run: async () => {
        process.stdout.write(`Channel options: ${Array.from(allowedChannels).join(', ')}\n`);
        return promptEnum(rl, 'Channel', allowedChannels, draft.channel, { allowBack: true });
      },
      apply: (value) => {
        draft.channel = value;
      }
    },
    {
      key: 'stabilityGrade',
      when: () => draft.vendor === 'nvidia',
      clear: () => {
        draft.stabilityGrade = '';
      },
      run: async () => promptStabilityGrade(rl, draft.stabilityGrade, { allowBack: true }),
      apply: (value) => {
        draft.stabilityGrade = value;
      }
    },
    {
      key: 'warningUrl',
      when: () => draft.hasWarning,
      clear: () => {
        draft.warningUrl = '';
      },
      run: async () => {
        const defaultWarningUrl = draft.warningUrl || deriveDefaultWarningUrl(draft.vendor, draft.family, draft.channel, draft.version);
        while (true) {
          const value = await promptText(rl, 'Warning URL (redirect page)', defaultWarningUrl, { allowBack: true });
          if (value === promptBack) return promptBack;
          const validation = validateWarningUrlForDataset(value, draft.vendor, draft.family, draft.channel, draft.version);
          if (validation.isValid) return value;
          process.stdout.write(`${validation.reason}\n`);
        }
      },
      apply: (value) => {
        draft.warningUrl = value;
      }
    },
    {
      key: 'previousVersion',
      run: async () => promptText(rl, 'Previous version', draft.previousVersion, { allowBack: true }),
      apply: (value) => {
        draft.previousVersion = value;
      }
    },
    {
      key: 'supersedes',
      run: async () => promptText(rl, 'Supersedes', draft.supersedes || draft.previousVersion || '', { allowBack: true }),
      apply: (value) => {
        draft.supersedes = value;
      }
    },
    {
      key: 'supersededBy',
      run: async () => promptText(rl, 'Superseded by', draft.supersededBy, { allowBack: true }),
      apply: (value) => {
        draft.supersededBy = value;
      }
    },
    {
      key: 'checksumInput',
      run: async () => promptText(rl, 'SHA-256 checksum', draft.checksumInput, { allowBack: true }),
      apply: (value) => {
        draft.checksumInput = value;
      }
    },
    {
      key: 'riskLevel',
      run: async () => {
        process.stdout.write(`Risk options: ${riskOptions.join(', ')}\n`);
        while (true) {
          const value = await promptText(rl, 'Risk level', draft.riskLevel || defaultRisk, { allowBack: true });
          if (value === promptBack) return promptBack;
          const normalized = String(value).toLowerCase();
          if (riskOptions.includes(normalized)) return normalized;
          process.stdout.write(`Invalid value. Allowed: ${riskOptions.join(', ')}\n`);
        }
      },
      apply: (value) => {
        draft.riskLevel = value;
      }
    },
    {
      key: 'osSupportRaw',
      run: async () => promptText(rl, 'OS support (comma separated)', draft.osSupportRaw, { allowBack: true }),
      apply: (value) => {
        draft.osSupportRaw = value;
      }
    },
    {
      key: 'architecturesRaw',
      run: async () => promptText(rl, 'Architectures (comma separated)', draft.architecturesRaw, { allowBack: true }),
      apply: (value) => {
        draft.architecturesRaw = value;
      }
    },
    {
      key: 'highlightsRaw',
      run: async () => promptText(rl, 'Highlights (comma separated)', draft.highlightsRaw, { allowBack: true }),
      apply: (value) => {
        draft.highlightsRaw = value;
      }
    },
    {
      key: 'issueTagsRaw',
      run: async () => promptText(rl, 'Issue tags (comma separated)', draft.issueTagsRaw, { allowBack: true }),
      apply: (value) => {
        draft.issueTagsRaw = value;
      }
    },
    {
      key: 'idOverride',
      run: async () => {
        const defaultValue = draft.regenerateId ? draft.idOverride : (draft.idOverride || base.id || '');
        if (draft.regenerateId) {
          return promptText(rl, 'ID override (leave blank for auto)', defaultValue, { allowBack: true });
        }
        return promptRequired(rl, 'ID override', defaultValue, { allowBack: true });
      },
      apply: (value) => {
        draft.idOverride = value;
      }
    }
  );

  let stepIndex = 0;
  while (stepIndex < steps.length) {
    const step = steps[stepIndex];
    const active = typeof step.when === 'function' ? step.when(draft) : true;
    if (!active) {
      if (typeof step.clear === 'function') {
        step.clear(draft);
      }
      stepIndex += 1;
      continue;
    }

    const value = await step.run();
    if (value === promptBack) {
      const previousIndex = findPreviousActiveStep(steps, stepIndex, draft);
      if (previousIndex < 0) {
        process.stdout.write('Input cancelled.\n');
        return null;
      }
      stepIndex = previousIndex;
      continue;
    }

    step.apply(value);
    stepIndex += 1;
  }

  return {
    ...(isEditMode ? base : {}),
    id: draft.idOverride,
    vendor: draft.vendor,
    family: draft.family,
    channel: draft.channel,
    version: draft.version,
    type: draft.type,
    releaseDate: draft.releaseDate,
    publishedAt: draft.publishedAt,
    downloadUrl: draft.downloadUrl,
    releaseNotesUrl: draft.releaseNotesUrl,
    knownIssuesUrl: draft.knownIssuesUrl,
    redditUrl: draft.redditUrl,
    warningUrl: draft.warningUrl,
    hasWarning: draft.hasWarning,
    isStable: draft.isStable,
    stabilityGrade: draft.stabilityGrade,
    riskLevel: draft.riskLevel === 'auto' ? '' : draft.riskLevel,
    previousVersion: draft.previousVersion,
    supersedes: draft.supersedes,
    supersededBy: draft.supersededBy,
    sha256sum: draft.checksumInput,
    checksum: draft.checksumInput ? { algorithm: 'sha256', value: draft.checksumInput } : null,
    osSupport: normalizeCsv(draft.osSupportRaw, { lowerCase: true }),
    architectures: normalizeCsv(draft.architecturesRaw, { lowerCase: true }),
    highlights: normalizeCsv(draft.highlightsRaw),
    issueTags: normalizeCsv(draft.issueTagsRaw, { lowerCase: true })
  };
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

    if (isBackInput(trimmed)) {
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

function runDataSync(changedFilePaths) {
  process.stdout.write('\nRunning post-save sync: npm run data:sync\n');
  const relPaths = Array.from(new Set((changedFilePaths || []).map((filePath) => path.relative(rootDir, filePath))));
  const command = npmExecPath ? process.execPath : npmCmd;
  const args = npmExecPath ? [npmExecPath, 'run', 'data:sync'] : ['run', 'data:sync'];
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      DATA_SYNC_EXTRA: relPaths.join(path.delimiter)
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

function createDatasetState(source) {
  const filePath = path.join(canonicalDataDir, source.filename);
  const dataset = readDataset(filePath);
  dataset.drivers = normalizeDatasetEntries(source, dataset);
  return {
    source,
    filePath,
    dataset,
    originalDataset: cloneJson(dataset),
    touched: false
  };
}

function normalizeAndValidateState(state) {
  state.dataset.drivers = normalizeDatasetEntries(state.source, state.dataset);
  touchDatasetLastUpdated(state.dataset);
  ensureValidNormalizedEntries(state.dataset.drivers, state.source);
}

function hasDiffChanges(diff) {
  return Boolean(
    diff.added.length
    || diff.changed.length
    || diff.removed.length
    || diff.lastUpdatedChanged
    || diff.warningMessageChanged
  );
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
      sourceDefs.map((source) => `${source.editorLabel} (${source.filename})`),
      { allowBack: true }
    );
    if (datasetIndex === null) {
      process.stdout.write('Cancelled.\n');
      return;
    }
    const source = sourceDefs[datasetIndex];
    const stateByFilename = new Map();
    const changedIdSet = new Set();

    function getState(targetSource) {
      const existing = stateByFilename.get(targetSource.filename);
      if (existing) return existing;
      const created = createDatasetState(targetSource);
      stateByFilename.set(targetSource.filename, created);
      return created;
    }

    const primaryState = getState(source);
    let hasChanges = false;

    while (true) {
      printDivider();
      const actionIndex = await chooseFromMenu(
        rl,
        'Select action',
        ['List recent entries', 'Add entry', 'Edit entry', 'Remove entry'],
        { allowBack: true }
      );
      if (actionIndex === null) {
        process.stdout.write('Cancelled.\n');
        return;
      }
      const action = ['list', 'add', 'edit', 'remove'][actionIndex];

      if (action === 'list') {
        printDivider();
        printRecentEntries(primaryState.dataset.drivers, 20);
        return;
      }

      if (action === 'add') {
        printDivider();
        const input = await collectDriverInput(rl, source, null, false);
        if (!input) {
          process.stdout.write('Add cancelled. Back to action menu.\n');
          continue;
        }
        primaryState.dataset.drivers.unshift(input);
        primaryState.touched = true;
        changedIdSet.add(input.id || '');

        const mirrorSource = getMirrorSource(source);
        if (mirrorSource) {
          const shouldMirror = await promptBoolean(rl, `Sync this entry to ${mirrorSource.editorLabel}`, true);
          if (shouldMirror) {
            const mirrorState = getState(mirrorSource);
            const mirrorEntry = buildMirrorRawEntry(input, mirrorSource);
            mirrorState.dataset.drivers.unshift(mirrorEntry);
            mirrorState.touched = true;
          }
        }

        hasChanges = true;
        break;
      }

      if (action === 'edit') {
        printDivider();
        const index = await pickEntryIndex(rl, primaryState.dataset.drivers, 'edit');
        if (index === null) {
          process.stdout.write('Back to action menu.\n');
          continue;
        }
        const previousEntry = primaryState.dataset.drivers[index];
        process.stdout.write(`Editing: ${summarizeSingleEntry(previousEntry)}\n`);
        const input = await collectDriverInput(rl, source, previousEntry, true);
        if (!input) {
          process.stdout.write('Edit cancelled. Back to action menu.\n');
          continue;
        }
        primaryState.dataset.drivers[index] = input;
        primaryState.touched = true;
        changedIdSet.add(previousEntry.id || '');
        changedIdSet.add(input.id || '');

        const mirrorSource = getMirrorSource(source);
        if (mirrorSource) {
          const shouldMirror = await promptBoolean(rl, `Sync this edit to ${mirrorSource.editorLabel}`, true);
          if (shouldMirror) {
            const mirrorState = getState(mirrorSource);
            const mirrorEntry = buildMirrorRawEntry(input, mirrorSource);
            const mirrorIndex = findMirrorEntryIndex(mirrorState.dataset.drivers, previousEntry, mirrorEntry, mirrorSource);
            if (mirrorIndex >= 0) {
              mirrorState.dataset.drivers[mirrorIndex] = mirrorEntry;
            } else {
              const addMirror = await promptBoolean(rl, `No matching ${mirrorSource.editorLabel} entry found. Add mirrored entry`, true);
              if (addMirror) {
                mirrorState.dataset.drivers.unshift(mirrorEntry);
              }
            }
            mirrorState.touched = true;
          }
        }

        hasChanges = true;
        break;
      }

      if (action === 'remove') {
        printDivider();
        const index = await pickEntryIndex(rl, primaryState.dataset.drivers, 'remove');
        if (index === null) {
          process.stdout.write('Back to action menu.\n');
          continue;
        }
        const target = primaryState.dataset.drivers[index];
        process.stdout.write(`Remove: ${summarizeSingleEntry(target)}\n`);
        const confirmed = await promptBoolean(rl, 'Confirm remove', false);
        if (!confirmed) {
          process.stdout.write('Remove cancelled.\n');
          continue;
        }
        primaryState.dataset.drivers.splice(index, 1);
        primaryState.touched = true;
        changedIdSet.add(target.id || '');

        const mirrorSource = getMirrorSource(source);
        if (mirrorSource) {
          const shouldMirror = await promptBoolean(rl, `Also remove matching ${mirrorSource.editorLabel} entry`, true);
          if (shouldMirror) {
            const mirrorState = getState(mirrorSource);
            const mirrorIndex = findMirrorEntryIndex(mirrorState.dataset.drivers, target, {}, mirrorSource);
            if (mirrorIndex >= 0) {
              const removed = mirrorState.dataset.drivers[mirrorIndex];
              mirrorState.dataset.drivers.splice(mirrorIndex, 1);
              mirrorState.touched = true;
              changedIdSet.add((removed && removed.id) || '');
            } else {
              process.stdout.write(`No matching ${mirrorSource.editorLabel} entry found to remove.\n`);
            }
          }
        }

        hasChanges = true;
        break;
      }
    }

    if (!hasChanges) {
      return;
    }

    const touchedStates = Array.from(stateByFilename.values()).filter((state) => state.touched);
    touchedStates.forEach((state) => {
      normalizeAndValidateState(state);
    });

    const diffs = touchedStates
      .map((state) => buildDatasetDiff(state.filePath, state.source, state.originalDataset, state.dataset))
      .filter((diff) => hasDiffChanges(diff));

    if (!diffs.length) {
      process.stdout.write('No effective changes after normalization.\n');
      return;
    }

    printDivider();
    process.stdout.write('Pre-save diff preview\n');
    diffs.forEach((diff) => {
      printDivider();
      printDiffPreview(diff);
      diff.added.forEach((id) => changedIdSet.add(id));
      diff.changed.forEach((id) => changedIdSet.add(id));
      diff.removed.forEach((id) => changedIdSet.add(id));
    });

    printDivider();
    const applyChanges = await promptBoolean(rl, 'Apply these changes', true);
    if (!applyChanges) {
      process.stdout.write('Save cancelled. No files changed.\n');
      return;
    }

    const changedFilePaths = [];
    diffs.forEach((diff) => {
      const backupPath = createBackup(diff.filePath);
      if (backupPath) {
        process.stdout.write(`Backup created: ${backupPath}\n`);
      }
      const state = stateByFilename.get(diff.source.filename);
      writeDataset(diff.filePath, state.dataset);
      changedFilePaths.push(diff.filePath);
    });

    printDivider();
    changedFilePaths.forEach((filePath) => {
      const state = stateByFilename.get(path.basename(filePath));
      process.stdout.write(`Saved ${filePath}\n`);
      if (state && state.dataset.drivers.length) {
        process.stdout.write(`Newest: ${summarizeSingleEntry(state.dataset.drivers[0])}\n`);
      }
    });

    runDataSync(changedFilePaths);
    printDivider();
    printDeltaPreview(changedIdSet);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error.message || error)}\n`);
  process.exit(1);
});
