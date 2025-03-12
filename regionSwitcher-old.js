document.addEventListener("DOMContentLoaded", function () {
    const regionSelect = document.getElementById("regionSelect");
    const settingsOverlay = document.getElementById("settings-overlay");
    const regionIndicator = document.getElementById("region-indicator");
    const nvidiaLinks = document.querySelectorAll("a.nvidia-button");

    // Load region preference
    const savedRegion = localStorage.getItem("userRegion") || "USA";
    regionSelect.value = savedRegion;
    updateNvidiaLinks(savedRegion);
    updateRegionIndicator(savedRegion);

    // Listen region changes
    regionSelect.addEventListener("change", function () {
        const selectedRegion = regionSelect.value;
        localStorage.setItem("userRegion", selectedRegion);
        updateNvidiaLinks(selectedRegion);
        updateRegionIndicator(selectedRegion);
    });

    // Update Nvidia
    function updateNvidiaLinks(region) {
        nvidiaLinks.forEach(link => {
            let url = link.href;
            if (region === "EU") {
                link.href = url.replace("us.download.nvidia.com", "uk.download.nvidia.com");
            } else {
                link.href = url.replace("uk.download.nvidia.com", "us.download.nvidia.com");
            }
        });
    }

    function updateRegionIndicator(region) {
        const flagUrl = region === "EU" 
            ? "https://prod.rexxit.net/global/_icons/EU.svg" 
            : "https://prod.rexxit.net/global/_icons/US.svg";
    
        regionIndicator.innerHTML = `<b style="color:#de3430;">NEW:</b> Region: <img src="${flagUrl}" alt="${region} flag" class="region-flag clickable-flag">`;
    
        document.querySelector(".clickable-flag").addEventListener("click", () => {
            settingsOverlay.style.display = "block";
        });
    }
    
});