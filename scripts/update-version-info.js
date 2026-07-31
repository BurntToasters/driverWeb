const fs = require('fs');
const path = require('path');
const { loadDriverWebConf } = require('./load-driverweb-conf');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const versionInfoJsonPath = path.join(rootDir, 'versionInfo.json');
const versionInfoJsPath = path.join(rootDir, 'astro', 'public', 'global', 'versionInfo.js');
const manifestPath = path.join(rootDir, 'astro', 'public', 'manifest.webmanifest');

const DEFAULT_MANIFEST = {
  start_url: '/',
  scope: '/',
  display: 'browser',
  background_color: '#0f172a',
  theme_color: '#0f172a',
  icons: [
    {
      src: '/global/favicon.ico',
      sizes: '64x64',
      type: 'image/x-icon'
    }
  ]
};

function formatLocalDate(now = new Date()) {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = String(now.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

function githubRawVersionInfoUrl(githubUrl) {
  try {
    const parsed = new URL(githubUrl);
    const parts = parsed.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parsed.hostname !== 'github.com' || parts.length < 2) {
      return '';
    }
    const [owner, repo] = parts;
    return `https://raw.githubusercontent.com/${owner}/${repo}/main/versionInfo.json`;
  } catch {
    return '';
  }
}

function buildVersionInfoScript(versionLabel, lastUpdated, versionInfoFetchUrl) {
  const versionLiteral = JSON.stringify(versionLabel);
  const dateLiteral = JSON.stringify(lastUpdated);
  const fetchLiteral = JSON.stringify(versionInfoFetchUrl);

  return `const SITE_INFO = {
    version: ${versionLiteral},
    lastUpdated: ${dateLiteral}
};

document.addEventListener('DOMContentLoaded', function() {
    
    const versionElement = document.getElementById('site-version');
    const dateElement = document.getElementById('update-date');
    const fallbackVersion = ${versionLiteral};
    const fallbackDate = ${dateLiteral};
    
    function updateVersionInfo(version, date) {
        if (versionElement) versionElement.textContent = version + ' ';
        if (dateElement) dateElement.textContent = 'Updated ' + date + ' (mm/dd/yy)';
    }
    
    const versionInfoUrl = ${fetchLiteral};
    if (!versionInfoUrl) {
        updateVersionInfo(fallbackVersion, fallbackDate);
        return;
    }

    fetch(versionInfoUrl)
        .then(response => response.ok ? response.json() : Promise.reject('Failed to load'))
        .then(data => updateVersionInfo(data.version, data.lastUpdated))
        .catch(error => {
            updateVersionInfo(fallbackVersion, fallbackDate);
        });
});
`;
}

function writeManifest(siteConfig) {
  const existing = fs.existsSync(manifestPath)
    ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    : {};

  const manifest = {
    ...DEFAULT_MANIFEST,
    ...existing,
    name: siteConfig.NAME,
    short_name: siteConfig.NAME,
    description: siteConfig.META_DESCRIPTION
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const siteConfig = loadDriverWebConf(rootDir);
  const rawVersion = String(pkg.version || '').trim() || '0.0.0';
  const versionLabel = `V ${rawVersion}`;
  const lastUpdated = formatLocalDate(new Date());
  const versionInfoFetchUrl = githubRawVersionInfoUrl(siteConfig.GITHUB_URL);

  fs.writeFileSync(versionInfoJsonPath, `${JSON.stringify({ version: versionLabel, lastUpdated }, null, 2)}\n`);
  fs.writeFileSync(versionInfoJsPath, buildVersionInfoScript(versionLabel, lastUpdated, versionInfoFetchUrl));
  writeManifest(siteConfig);

  process.stdout.write(`Updated version info: ${versionLabel} (${lastUpdated})\n`);
  process.stdout.write(`Updated manifest from driverweb.conf (${siteConfig.NAME})\n`);
}

main();
