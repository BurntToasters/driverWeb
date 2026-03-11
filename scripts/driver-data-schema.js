const allowedRisk = new Set(['low', 'medium', 'high']);
const allowedFamilies = new Set(['graphics', 'graphics-laptop', 'chipset', 'audio', 'network']);
const allowedChannels = new Set(['game-ready', 'studio', 'game-on', 'pro', 'chipset', 'audio', 'network']);
const allowedVendors = new Set(['nvidia', 'intel', 'amd', 'realtek', 'broadcom', 'qualcomm', 'mediatek', 'generic']);

const requiredEntryFields = ['id', 'vendor', 'family', 'channel', 'version', 'releaseDateIso', 'publishedAt', 'riskLevel'];

function parseDateValue(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;

  const text = String(value).trim();
  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const month = Number(slashMatch[1]) - 1;
    const day = Number(slashMatch[2]);
    let year = Number(slashMatch[3]);
    if (year < 100) year += 2000;
    const parsed = new Date(Date.UTC(year, month, day));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  return null;
}

function toIsoDate(value, fallback) {
  const parsed = parseDateValue(value) || parseDateValue(fallback);
  if (!parsed) return '';
  return parsed.toISOString().slice(0, 10);
}

function toIsoDateTime(value, fallback) {
  const parsed = parseDateValue(value) || parseDateValue(fallback);
  if (!parsed) return '';
  return parsed.toISOString();
}

function normalizeUrl(value, options = {}) {
  const allowRelative = Boolean(options.allowRelative);
  if (!value) return '';
  const text = String(value).trim();
  if (!text) return '';

  if (allowRelative && text.startsWith('/')) {
    return text;
  }

  try {
    const url = new URL(text);
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeWarningUrl(value) {
  return normalizeUrl(value, { allowRelative: true });
}

function normalizeChecksum(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    const rawBlock = value;
    const rawValue = rawBlock.value ? String(rawBlock.value).trim() : '';
    if (!rawValue) return null;
    return {
      algorithm: String(rawBlock.algorithm || 'sha256').toLowerCase(),
      value: rawValue.toUpperCase()
    };
  }

  const raw = String(value).trim();
  if (!raw) return null;
  return {
    algorithm: 'sha256',
    value: raw.toUpperCase()
  };
}

function isValidChecksumBlock(checksum) {
  if (!checksum) return true;
  if (!checksum.value) return false;
  if (String(checksum.algorithm || 'sha256').toLowerCase() !== 'sha256') return false;
  return /^[A-Fa-f0-9]{64}$/.test(String(checksum.value));
}

function normalizeToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeDriverId(source, driver, index, releaseDateIso) {
  const explicit = driver.id ? String(driver.id).trim() : '';
  if (explicit) return explicit;

  const version = normalizeToken(driver.version || 'unknown');
  const type = normalizeToken(driver.type || '');
  const datePart = String(releaseDateIso || '').replace(/[^0-9]/g, '');
  const vendor = normalizeToken(driver.vendor || source.vendor || '');
  const family = normalizeToken(driver.family || source.family || '');
  const channel = normalizeToken(driver.channel || source.channel || '');

  const base = [vendor, family, channel, version, type, datePart].filter(Boolean).join('|');
  if (base) return base;
  return `driver|${index}`;
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeStringArray(value, { lowerCase = true, max = 50 } = {}) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];

  for (let i = 0; i < value.length && out.length < max; i += 1) {
    const normalized = String(value[i] || '').trim();
    if (!normalized) continue;
    const finalValue = lowerCase ? normalized.toLowerCase() : normalized;
    if (seen.has(finalValue)) continue;
    seen.add(finalValue);
    out.push(finalValue);
  }

  return out;
}

function deriveRiskLevel(driver) {
  const explicit = driver.riskLevel ? String(driver.riskLevel).toLowerCase().trim() : '';
  if (explicit && allowedRisk.has(explicit)) {
    return explicit;
  }
  if (normalizeBoolean(driver.hasWarning, false)) return 'high';
  if (normalizeBoolean(driver.isStable, false)) return 'low';
  return 'medium';
}

function deriveHighlights(driver, source) {
  if (Array.isArray(driver.highlights) && driver.highlights.length) {
    return normalizeStringArray(driver.highlights, { lowerCase: false, max: 5 });
  }

  const hints = [];
  if (driver.type) hints.push(String(driver.type).trim());
  if (normalizeBoolean(driver.isStable, false) && driver.stabilityGrade) hints.push(`Stable ${String(driver.stabilityGrade).trim()}`);
  if (source.channel === 'game-ready') hints.push('Optimized for latest game releases');
  if (source.channel === 'studio') hints.push('Tuned for creator workloads');
  if (source.channel === 'pro') hints.push('Professional certified branch');
  if (source.family === 'network') hints.push('Network adapter update');
  if (source.family === 'audio') hints.push('Audio codec and endpoint update');
  return hints.slice(0, 5);
}

function deriveIssueTags(driver) {
  if (Array.isArray(driver.issueTags) && driver.issueTags.length) {
    return normalizeStringArray(driver.issueTags, { lowerCase: true, max: 10 });
  }
  const tags = [];
  if (normalizeBoolean(driver.hasWarning, false)) tags.push('known-instability');
  if (driver.knownIssuesUrl) tags.push('known-issues');
  return tags;
}

function deriveOsSupport(driver) {
  const normalized = normalizeStringArray(driver.osSupport, { lowerCase: true, max: 12 });
  return normalized.length ? normalized : ['windows-10', 'windows-11'];
}

function deriveArchitectures(driver) {
  const normalized = normalizeStringArray(driver.architectures, { lowerCase: true, max: 8 });
  return normalized.length ? normalized : ['x64'];
}

function normalizeSourceList(driver) {
  const list = [];
  const seen = new Set();

  const pushIfValid = (type, urlValue) => {
    const normalizedType = String(type || '').trim().toLowerCase();
    const normalizedUrl = normalizeUrl(urlValue);
    if (!normalizedType || !normalizedUrl) return;
    const dedupe = `${normalizedType}|${normalizedUrl}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    list.push({ type: normalizedType, url: normalizedUrl });
  };

  if (Array.isArray(driver.sources)) {
    driver.sources.forEach((source) => {
      if (!source || typeof source !== 'object') return;
      pushIfValid(source.type || 'reference', source.url);
    });
  }

  pushIfValid('download', driver.downloadUrl);
  pushIfValid('release-notes', driver.releaseNotesUrl);
  pushIfValid('known-issues', driver.knownIssuesUrl);
  pushIfValid('community', driver.redditUrl);

  return list;
}

function normalizeEnumWithFallback(value, allowed, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  if (allowed.has(normalized)) return normalized;
  return fallback;
}

function normalizeDatasetDriver(source, data, driver, index) {
  const sourceVendor = normalizeEnumWithFallback(source.vendor, allowedVendors, 'generic');
  const sourceFamily = normalizeEnumWithFallback(source.family, allowedFamilies, 'graphics');
  const sourceChannel = normalizeEnumWithFallback(source.channel, allowedChannels, 'game-ready');

  const vendor = normalizeEnumWithFallback(driver.vendor, allowedVendors, sourceVendor);
  const family = normalizeEnumWithFallback(driver.family, allowedFamilies, sourceFamily);
  const channel = normalizeEnumWithFallback(driver.channel, allowedChannels, sourceChannel);

  const releaseDateIso = toIsoDate(driver.releaseDateIso || driver.releaseDate, data.lastUpdated);
  const publishedAt = toIsoDateTime(driver.publishedAt || driver.releaseDateIso || driver.releaseDate, data.lastUpdated);
  const checksum = normalizeChecksum(driver.sha256sum || driver.checksum);
  const downloadUrl = normalizeUrl(driver.downloadUrl);
  const releaseNotesUrl = normalizeUrl(driver.releaseNotesUrl);
  const knownIssuesUrl = normalizeUrl(driver.knownIssuesUrl);
  const warningUrl = normalizeWarningUrl(driver.warningUrl);
  const redditUrl = normalizeUrl(driver.redditUrl);
  const version = String(driver.version || 'Unknown version').trim();
  const type = String(driver.type || '').trim();
  const id = makeDriverId({ vendor, family, channel }, driver, index, releaseDateIso);
  const hasWarning = normalizeBoolean(driver.hasWarning, false);
  const isStable = normalizeBoolean(driver.isStable, false);
  const rawStabilityGrade = driver.stabilityGrade === null || driver.stabilityGrade === undefined ? '' : String(driver.stabilityGrade).trim().toUpperCase();
  const stabilityGrade = vendor === 'nvidia' ? rawStabilityGrade : '';

  return {
    id,
    vendor,
    family,
    channel,
    version,
    type,
    releaseDate: String(driver.releaseDate || releaseDateIso || '').trim(),
    releaseDateIso,
    publishedAt,
    downloadUrl,
    releaseNotesUrl,
    knownIssuesUrl,
    warningUrl,
    redditUrl,
    hasWarning,
    isStable,
    stabilityGrade,
    riskLevel: deriveRiskLevel({
      ...driver,
      hasWarning,
      isStable
    }),
    sha256sum: checksum ? checksum.value : '',
    checksum,
    sources: normalizeSourceList({ ...driver, downloadUrl, releaseNotesUrl, knownIssuesUrl, redditUrl }),
    highlights: deriveHighlights(
      {
        ...driver,
        type,
        isStable,
        stabilityGrade
      },
      { family, channel }
    ),
    issueTags: deriveIssueTags({
      ...driver,
      hasWarning,
      knownIssuesUrl
    }),
    supersedes: String(driver.supersedes || driver.previousVersion || '').trim(),
    supersededBy: String(driver.supersededBy || '').trim(),
    osSupport: deriveOsSupport(driver),
    architectures: deriveArchitectures(driver),
    previousVersion: String(driver.previousVersion || '').trim()
  };
}

function normalizeDriver(source, data, driver, index) {
  const base = normalizeDatasetDriver(source, data, driver, index);
  return {
    ...base,
    category: source.category,
    brand: source.brand,
    page: source.page,
    legacy: {
      sha256sum: base.sha256sum || '',
      warningMessage: data.warningMessage || ''
    }
  };
}

function findDescendingOrderError(list, label) {
  if (!Array.isArray(list) || list.length < 2) return '';
  for (let i = 1; i < list.length; i += 1) {
    const prev = parseDateValue(list[i - 1].publishedAt);
    const current = parseDateValue(list[i].publishedAt);
    if (prev && current && current.getTime() > prev.getTime()) {
      return `${label}: entries not in descending publishedAt order near index ${i}`;
    }
  }
  return '';
}

function validateEntries(entries, sourceResults = [], options = {}) {
  const errors = [];
  const warnings = [];
  const idSet = new Set();

  entries.forEach((entry, index) => {
    const ctx = `${entry.id || 'missing-id'} @${index}`;

    requiredEntryFields.forEach((field) => {
      if (!entry[field] || (Array.isArray(entry[field]) && entry[field].length === 0)) {
        errors.push(`${ctx}: missing required field ${field}`);
      }
    });

    if (idSet.has(entry.id)) {
      errors.push(`${ctx}: duplicate id ${entry.id}`);
    } else {
      idSet.add(entry.id);
    }

    if (!allowedVendors.has(entry.vendor)) {
      errors.push(`${ctx}: invalid vendor ${entry.vendor}`);
    }

    if (!allowedFamilies.has(entry.family)) {
      errors.push(`${ctx}: invalid family ${entry.family}`);
    }

    if (!allowedChannels.has(entry.channel)) {
      errors.push(`${ctx}: invalid channel ${entry.channel}`);
    }

    if (!allowedRisk.has(entry.riskLevel)) {
      errors.push(`${ctx}: invalid riskLevel ${entry.riskLevel}`);
    }

    if (!parseDateValue(entry.releaseDateIso)) {
      errors.push(`${ctx}: invalid releaseDateIso ${entry.releaseDateIso}`);
    }

    if (!parseDateValue(entry.publishedAt)) {
      errors.push(`${ctx}: invalid publishedAt ${entry.publishedAt}`);
    }

    if (!isValidChecksumBlock(entry.checksum)) {
      errors.push(`${ctx}: malformed checksum block`);
    }

    if (!Array.isArray(entry.osSupport) || !entry.osSupport.length) {
      warnings.push(`${ctx}: osSupport missing, fallback expected`);
    }

    if (!Array.isArray(entry.architectures) || !entry.architectures.length) {
      warnings.push(`${ctx}: architectures missing, fallback expected`);
    }
  });

  const globalLabel = options.globalOrderLabel || 'entries';
  const globalOrderError = findDescendingOrderError(entries, globalLabel);
  if (globalOrderError) errors.push(globalOrderError);

  sourceResults.forEach((result) => {
    const label = result && result.source && result.source.category ? result.source.category : 'source';
    const orderError = findDescendingOrderError(result.entries || [], label);
    if (orderError) errors.push(orderError);
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

function sortByPublishedAtDesc(entries) {
  entries.sort((a, b) => {
    const aTime = parseDateValue(a.publishedAt)?.getTime() || 0;
    const bTime = parseDateValue(b.publishedAt)?.getTime() || 0;
    return bTime - aTime;
  });
  return entries;
}

module.exports = {
  allowedRisk,
  allowedFamilies,
  allowedChannels,
  allowedVendors,
  requiredEntryFields,
  parseDateValue,
  toIsoDate,
  toIsoDateTime,
  normalizeUrl,
  normalizeWarningUrl,
  normalizeChecksum,
  isValidChecksumBlock,
  makeDriverId,
  deriveRiskLevel,
  deriveHighlights,
  deriveIssueTags,
  deriveOsSupport,
  deriveArchitectures,
  normalizeSourceList,
  normalizeDatasetDriver,
  normalizeDriver,
  validateEntries,
  sortByPublishedAtDesc
};
