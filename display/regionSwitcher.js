document.addEventListener("DOMContentLoaded", function () {
    const regionSelect = document.getElementById("regionSelect");
    const settingsOverlay = document.getElementById("settings-overlay");
    const regionIndicator = document.getElementById("region-indicator");

    //region preference
    const savedRegion = localStorage.getItem("userRegion") || "USA";
    regionSelect.value = savedRegion;
    updateRegionIndicator(savedRegion);

    //listener
    regionSelect.addEventListener("change", function () {
        const selectedRegion = regionSelect.value;
        localStorage.setItem("userRegion", selectedRegion);
        updateRegionIndicator(selectedRegion);
        
        //Force reload
        const baseUrl = "https://raw.githubusercontent.com/BurntToasters/driverHub-data/main/";
        
        //Check & load drivers
        if (document.getElementById('nvidia-game-ready-drivers')) {
            //Desktop
            loadDrivers(baseUrl + 'nvidia-game-ready.json', 'nvidia-game-ready-drivers');
            loadDrivers(baseUrl + 'nvidia-studio.json', 'nvidia-studio-drivers');
        } else if (document.getElementById('nvidia-game-ready-laptop-drivers')) {
            //Laptop
            loadDrivers(baseUrl + 'nvidia-game-ready-laptop.json', 'nvidia-game-ready-laptop-drivers');
            loadDrivers(baseUrl + 'nvidia-studio-laptop.json', 'nvidia-studio-laptop-drivers');
        }
    });

    function updateRegionIndicator(region) {
        if (regionIndicator) {
            const flagUrl = region === "EU" 
                ? "https://prod.rexxit.net/global/_icons/EU.svg" 
                : "https://prod.rexxit.net/global/_icons/US.svg";
        
            regionIndicator.innerHTML = `Region: <img src="${flagUrl}" alt="${region} flag" class="region-flag clickable-flag" width="24" height="24">`;
        
            document.querySelector(".clickable-flag").addEventListener("click", () => {
                settingsOverlay.style.display = "block";
            });
        }
    }
});