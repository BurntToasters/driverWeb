document.addEventListener("DOMContentLoaded", function () {
    const regionIndicator = document.getElementById("region-indicator");

    function getStoredRegion() {
        try {
            return localStorage.getItem("userRegion") || "USA";
        } catch (e) {
            return "USA";
        }
    }

    function setStoredRegion(region) {
        try {
            localStorage.setItem("userRegion", region);
        } catch (e) {
        }
    }

    const savedRegion = getStoredRegion();
    updateRegionIndicator(savedRegion);

    function updateRegionIndicator(region) {
        if (regionIndicator) {
            const flag = region === "EU" ? "🇪🇺" : "🇺🇸";
            const label = region === "EU" ? "EU" : "USA";
            regionIndicator.textContent = `${flag} ${label}`;
        }
    }

    function toggleRegion() {
        const currentRegion = getStoredRegion();
        const newRegion = currentRegion === "USA" ? "EU" : "USA";
        setStoredRegion(newRegion);
        updateRegionIndicator(newRegion);

        const baseUrl = "https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/";

        if (typeof loadDrivers === 'function') {
            if (document.getElementById('nvidia-game-ready-drivers')) {
                loadDrivers(baseUrl + 'nvidia-game-ready.json', 'nvidia-game-ready-drivers');
                loadDrivers(baseUrl + 'nvidia-studio.json', 'nvidia-studio-drivers');
                loadDrivers(baseUrl + 'intel-game-on.json', 'intel-game-on-drivers');
                loadDrivers(baseUrl + 'intel-pro.json', 'intel-pro-drivers');
            } else if (document.getElementById('nvidia-game-ready-laptop-drivers')) {
                loadDrivers(baseUrl + 'nvidia-game-ready-laptop.json', 'nvidia-game-ready-laptop-drivers');
                loadDrivers(baseUrl + 'nvidia-studio-laptop.json', 'nvidia-studio-laptop-drivers');
            }
        }
    }

    if (regionIndicator) {
        regionIndicator.addEventListener("click", toggleRegion);
        regionIndicator.style.cursor = "pointer";
    }
});
