const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const versionInfoJsonPath = path.join(rootDir, 'versionInfo.json');
const versionInfoJsPath = path.join(rootDir, 'global', 'versionInfo.js');

function formatLocalDate(now = new Date()) {
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const year = String(now.getFullYear()).slice(-2);
  return `${month}/${day}/${year}`;
}

function buildVersionInfoScript(versionLabel, lastUpdated) {
  return `const SITE_INFO = {
    version: "${versionLabel}",
    lastUpdated: "${lastUpdated}"
};

document.addEventListener('DOMContentLoaded', function() {
    
    const versionElement = document.getElementById('site-version');
    const dateElement = document.getElementById('update-date');
    const fallbackVersion = "${versionLabel}";
    const fallbackDate = "${lastUpdated}";
    
    function updateVersionInfo(version, date) {
        if (versionElement) versionElement.textContent = version + ' ';
        if (dateElement) dateElement.textContent = 'Updated ' + date + ' (mm/dd/yy)';
    }
    
   
    fetch('https://raw.githubusercontent.com/BurntToasters/driverWeb/main/versionInfo-block.json')
        .then(response => response.ok ? response.json() : Promise.reject('Failed to load'))
        .then(data => updateVersionInfo(data.version, data.lastUpdated))
        .catch(error => {
            updateVersionInfo(fallbackVersion, fallbackDate);
        });
});
`;
}

function main() {
  const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const rawVersion = String(pkg.version || '').trim() || '0.0.0';
  const versionLabel = `V ${rawVersion}`;
  const lastUpdated = formatLocalDate(new Date());

  fs.writeFileSync(versionInfoJsonPath, `${JSON.stringify({ version: versionLabel, lastUpdated }, null, 2)}\n`);
  fs.writeFileSync(versionInfoJsPath, buildVersionInfoScript(versionLabel, lastUpdated));

  process.stdout.write(`Updated version info: ${versionLabel} (${lastUpdated})\n`);
}

main();
