const SITE_INFO = {
    version: "V 6.2.0",
    lastUpdated: "8/22/26"
};

document.addEventListener('DOMContentLoaded', function() {
    
    const versionElement = document.getElementById('site-version');
    const dateElement = document.getElementById('update-date');
    const fallbackVersion = "V 6.2.0";
    const fallbackDate = "8/22/26";
    
    function updateVersionInfo(version, date) {
        if (versionElement) versionElement.textContent = version + ' ';
        if (dateElement) dateElement.textContent = 'Updated ' + date + ' (mm/dd/yy)';
    }
    
    const versionInfoUrl = "https://raw.githubusercontent.com/BurntToasters/driverWeb/main/versionInfo.json";
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
