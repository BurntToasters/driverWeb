const SITE_INFO = {
    version: "V 3.2.1-R2",
    lastUpdated: "6/23/25"
};

document.addEventListener('DOMContentLoaded', function() {
    
    const versionElement = document.getElementById('site-version');
    const dateElement = document.getElementById('update-date');
    const fallbackVersion = "V 3.2.1-R2";
    const fallbackDate = "6/23/25";
    
    function updateVersionInfo(version, date) {
        if (versionElement) versionElement.textContent = version + ' ';
        if (dateElement) dateElement.textContent = 'Updated ' + date + ' (mm/dd/yy)';
    }
    
   
    fetch('https://raw.githubusercontent.com/BurntToasters/driverWeb/main/versionInfo.json')
        .then(response => response.ok ? response.json() : Promise.reject('Failed to load'))
        .then(data => updateVersionInfo(data.version, data.lastUpdated))
        .catch(error => {
            console.log('Using fallback version info:', error);
            updateVersionInfo(fallbackVersion, fallbackDate);
        });
});