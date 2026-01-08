document.addEventListener("DOMContentLoaded", function () {
    const regionSelect = document.getElementById("regionSelect");
    const settingsOverlay = document.getElementById("settings-overlay");
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
            // localStorage unavailable (private browsing)
        }
    }

    const savedRegion = getStoredRegion();
    if (regionSelect) {
        regionSelect.value = savedRegion;
    }
    updateRegionIndicator(savedRegion);

    if (regionSelect) {
        regionSelect.addEventListener("change", function () {
            const selectedRegion = regionSelect.value;
            setStoredRegion(selectedRegion);
            updateRegionIndicator(selectedRegion);

            const baseUrl = "https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/";

            if (document.getElementById('nvidia-game-ready-drivers')) {
                loadDrivers(baseUrl + 'nvidia-game-ready.json', 'nvidia-game-ready-drivers');
                loadDrivers(baseUrl + 'nvidia-studio.json', 'nvidia-studio-drivers');
                loadDrivers(baseUrl + 'intel-game-on.json', 'intel-game-on-drivers');
                loadDrivers(baseUrl + 'intel-pro.json', 'intel-pro-drivers');
            } else if (document.getElementById('nvidia-game-ready-laptop-drivers')) {
                loadDrivers(baseUrl + 'nvidia-game-ready-laptop.json', 'nvidia-game-ready-laptop-drivers');
                loadDrivers(baseUrl + 'nvidia-studio-laptop.json', 'nvidia-studio-laptop-drivers');
            }
        });
    }

    function updateRegionIndicator(region) {
        if (regionIndicator) {
            const flagUrl = region === "EU"
                ? "https://prod.rexxit.net/global/_icons/EU.svg"
                : "https://prod.rexxit.net/global/_icons/US.svg";

            regionIndicator.innerHTML = `Region: <img src="${flagUrl}" alt="${region} flag" class="region-flag clickable-flag" width="24" height="24">`;

            const flag = regionIndicator.querySelector(".clickable-flag");
            if (flag && settingsOverlay) {
                flag.addEventListener("click", () => {
                    settingsOverlay.style.display = "block";
                    settingsOverlay.classList.add("active");
                });
            }
        }
    }
});
