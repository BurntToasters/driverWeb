const fs = require('fs');
const path = require('path');
const { validateEntries } = require('./driver-data-schema');

const rootDir = path.resolve(__dirname, '..');
const feedPath = path.join(rootDir, 'feeds', 'drivers.json');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(feedPath)) {
  fail('feeds/drivers.json does not exist. Run npm run build:feeds first.');
}

const feed = JSON.parse(fs.readFileSync(feedPath, 'utf8'));
if (!feed || !Array.isArray(feed.entries)) {
  fail('feeds/drivers.json has no entries array.');
}

const validation = validateEntries(feed.entries, [], { globalOrderLabel: 'entries' });
if (!validation.isValid) {
  const first = validation.errors.slice(0, 8).map((entry) => `- ${entry}`).join('\n');
  fail(`Data contract validation failed (${validation.errors.length} errors)\n${first}`);
}

process.stdout.write(`Data contract checks passed for ${feed.entries.length} entries`);
if (validation.warnings.length) {
  process.stdout.write(` with ${validation.warnings.length} warnings`);
}
process.stdout.write('.\n');
