document.addEventListener('DOMContentLoaded', function() {
    function getStoredRegion() {
        try {
            return localStorage.getItem('userRegion') || 'USA';
        } catch (e) {
            return 'USA';
        }
    }

    function setStoredRegion(region) {
        try {
            localStorage.setItem('userRegion', region);
        } catch (e) {
        }
    }

    function normalizeRegion(region) {
        return region === 'EU' ? 'EU' : 'USA';
    }

    function syncRegionSelects(region) {
        document.querySelectorAll('#regionSelect').forEach(function(select) {
            if (select.value !== region) {
                select.value = region;
            }
        });
    }

    function emitRegionChanged(region) {
        document.dispatchEvent(new CustomEvent('driverhub:region-changed', {
            detail: { region }
        }));
    }

    function reloadDriverLists() {
        if (typeof loadDrivers !== 'function') return;

        const baseUrl = 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/';
        const driverSources = [
            { id: 'nvidia-game-ready-drivers', file: 'nvidia-game-ready.json' },
            { id: 'nvidia-studio-drivers', file: 'nvidia-studio.json' },
            { id: 'intel-game-on-drivers', file: 'intel-game-on.json' },
            { id: 'intel-pro-drivers', file: 'intel-pro.json' },
            { id: 'nvidia-game-ready-laptop-drivers', file: 'nvidia-game-ready-laptop.json' },
            { id: 'nvidia-studio-laptop-drivers', file: 'nvidia-studio-laptop.json' }
        ];

        driverSources.forEach(function(source) {
            if (document.getElementById(source.id)) {
                loadDrivers(baseUrl + source.file, source.id);
            }
        });
    }

    function applyRegion(region, options) {
        const normalized = normalizeRegion(region);
        const settings = options || {};

        setStoredRegion(normalized);
        syncRegionSelects(normalized);

        if (!settings.skipReload) {
            reloadDriverLists();
        }

        emitRegionChanged(normalized);
    }

    const initialRegion = normalizeRegion(getStoredRegion());
    syncRegionSelects(initialRegion);
    emitRegionChanged(initialRegion);

    document.querySelectorAll('#regionSelect').forEach(function(select) {
        select.addEventListener('change', function(event) {
            applyRegion(event.target.value);
        });
    });

    window.DriverHubRegion = {
        get: function() {
            return normalizeRegion(getStoredRegion());
        },
        set: function(region, options) {
            applyRegion(region, options);
        }
    };
});
