const assert = require('assert');
const {
  normalizeDatasetDriver,
  validateEntries,
  makeDriverId,
  normalizeChecksum,
  isValidChecksumBlock,
  sortByPublishedAtDesc
} = require('./driver-data-schema');

const source = {
  vendor: 'nvidia',
  family: 'graphics',
  channel: 'game-ready',
  category: 'NVIDIA Game Ready'
};

function run() {
  const normalized = normalizeDatasetDriver(
    source,
    { lastUpdated: '11-23-25', warningMessage: '' },
    {
      version: '581.94',
      type: 'HOTFIX',
      releaseDate: 'Nov 19, 2025',
      publishedAt: '2025-11-19',
      downloadUrl: 'https://example.com/driver.exe',
      redditUrl: 'https://redd.it/example',
      hasWarning: false,
      isStable: true,
      sha256sum: 'b596920f9c8fa4be09d122eb39506282a46c4113e90da6f48c0e00d26686f7e6'
    },
    0
  );

  assert.equal(normalized.releaseDateIso, '2025-11-19');
  assert.equal(normalized.publishedAt, '2025-11-19T00:00:00.000Z');
  assert.equal(normalized.riskLevel, 'low');
  assert.equal(normalized.sha256sum, 'B596920F9C8FA4BE09D122EB39506282A46C4113E90DA6F48C0E00D26686F7E6');
  assert.ok(isValidChecksumBlock(normalizeChecksum(normalized.sha256sum)));
  assert.equal(normalized.stabilityGrade, '');

  const nvidiaGradeNormalized = normalizeDatasetDriver(
    source,
    { lastUpdated: '11-23-25', warningMessage: '' },
    {
      version: '581.80',
      type: 'WHQL',
      releaseDate: '2025-11-04',
      stabilityGrade: 'a-',
      isStable: true
    },
    2
  );
  assert.equal(nvidiaGradeNormalized.stabilityGrade, 'A-');

  const warningNormalized = normalizeDatasetDriver(
    source,
    { lastUpdated: '11-23-25', warningMessage: '' },
    {
      version: '576.02',
      type: 'WHQL',
      releaseDate: '2025-04-16',
      hasWarning: true,
      isStable: false,
      warningUrl: '/display/warn?nvgrd=576.02',
      downloadUrl: 'https://example.com/driver-57602.exe'
    },
    5
  );
  assert.equal(warningNormalized.warningUrl, '/display/warn?nvgrd=576.02');

  const intelNormalized = normalizeDatasetDriver(
    {
      vendor: 'intel',
      family: 'graphics',
      channel: 'game-on'
    },
    { lastUpdated: '11-23-25', warningMessage: '' },
    {
      version: '32.0.101.8250',
      type: '',
      releaseDate: '2025-11-11',
      stabilityGrade: 'A',
      isStable: true
    },
    3
  );
  assert.equal(intelNormalized.stabilityGrade, '');

  const idA = makeDriverId(source, normalized, 0, normalized.releaseDateIso);
  const idB = makeDriverId(source, normalized, 99, normalized.releaseDateIso);
  assert.equal(idA, idB);

  const invalidEnumEntry = { ...normalized, family: 'bad-family' };
  const invalidRiskEntry = { ...normalized, id: `${normalized.id}|risk`, riskLevel: 'critical' };
  const invalidChecksumEntry = { ...normalized, id: `${normalized.id}|hash`, checksum: { algorithm: 'sha256', value: 'ABC' } };
  const duplicateEntry = { ...normalized };

  const invalidValidation = validateEntries(
    [normalized, duplicateEntry, invalidEnumEntry, invalidRiskEntry, invalidChecksumEntry],
    [{ source, entries: [normalized, duplicateEntry, invalidEnumEntry, invalidRiskEntry, invalidChecksumEntry] }],
    { globalOrderLabel: 'test' }
  );

  assert.equal(invalidValidation.isValid, false);
  assert.ok(invalidValidation.errors.some((error) => error.includes('duplicate id')));
  assert.ok(invalidValidation.errors.some((error) => error.includes('invalid family')));
  assert.ok(invalidValidation.errors.some((error) => error.includes('invalid riskLevel')));
  assert.ok(invalidValidation.errors.some((error) => error.includes('malformed checksum block')));

  const older = normalizeDatasetDriver(
    source,
    { lastUpdated: '11-20-25' },
    {
      version: '580.88',
      type: 'WHQL',
      releaseDate: '2025-10-19',
      publishedAt: '2025-10-19',
      downloadUrl: 'https://example.com/older.exe'
    },
    1
  );
  const edited = normalizeDatasetDriver(
    source,
    { lastUpdated: '11-25-25' },
    {
      ...normalized,
      version: '582.00',
      releaseDate: '2025-11-25',
      publishedAt: '2025-11-25'
    },
    0
  );
  const list = [older, edited];
  sortByPublishedAtDesc(list);
  assert.equal(list[0].version, '582.00');
  assert.equal(list[1].version, '580.88');

  const removed = [edited];
  const removedValidation = validateEntries(removed, [{ source, entries: removed }], { globalOrderLabel: 'test' });
  assert.equal(removedValidation.isValid, true);

  process.stdout.write('Editor normalization checks passed.\n');
}

run();
