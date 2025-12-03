const SITE_INFO = {
    version: "V 5.0.0",
    lastUpdated: "12/04/25"
};

document.addEventListener('DOMContentLoaded', function() {
    
    const versionElement = document.getElementById('site-version');
    const dateElement = document.getElementById('update-date');
    const fallbackVersion = "V 5.0.0";
    const fallbackDate = "12/02/25";
    
    function updateVersionInfo(version, date) {
        if (versionElement) versionElement.textContent = version + ' ';
        if (dateElement) dateElement.textContent = 'Updated ' + date + ' (mm/dd/yy)';
    }
    
   
    fetch('https://raw.githubusercontent.com/BurntToasters/driverWeb/main/versionInfo-block.json')
        .then(response => response.ok ? response.json() : Promise.reject('Failed to load'))
        .then(data => updateVersionInfo(data.version, data.lastUpdated))
        .catch(error => {
            console.log('Using fallback version info:', error);
            updateVersionInfo(fallbackVersion, fallbackDate);
        });
});