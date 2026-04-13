const SITE_INFO = {
    version: "V 5.0.1",
    lastUpdated: "4/13/26"
};

document.addEventListener('DOMContentLoaded', function() {
    
    const versionElement = document.getElementById('site-version');
    const dateElement = document.getElementById('update-date');
    const fallbackVersion = "V 5.0.1";
    const fallbackDate = "4/13/26";
    
    function updateVersionInfo(version, date) {
        if (versionElement) versionElement.textContent = version + ' ';
        if (dateElement) dateElement.textContent = 'Updated ' + date + ' (mm/dd/yy)';
    }
    
   
    fetch('https://raw.githubusercontent.com/BurntToasters/driverWeb/main/versionInfo.json')
        .then(response => response.ok ? response.json() : Promise.reject('Failed to load'))
        .then(data => updateVersionInfo(data.version, data.lastUpdated))
        .catch(error => {
            updateVersionInfo(fallbackVersion, fallbackDate);
        });
});
