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

    function applyRegion(region, options) {
        const normalized = normalizeRegion(region);

        setStoredRegion(normalized);
        syncRegionSelects(normalized);

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
