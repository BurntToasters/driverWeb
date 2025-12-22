const SearchModule = (function() {
    let searchOverlay = null;
    let searchInput = null;
    let searchResults = null;
    let allDrivers = [];
    let isLoading = false;

    const driverSources = [
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-game-ready.json', category: 'NVIDIA Game Ready', brand: 'nvidia', page: '/display' },
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-studio.json', category: 'NVIDIA Studio', brand: 'nvidia', page: '/display' },
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/intel-game-on.json', category: 'Intel Game On', brand: 'intel', page: '/display' },
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/intel-pro.json', category: 'Intel Pro', brand: 'intel', page: '/display' },
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-game-ready-laptop.json', category: 'NVIDIA Laptop Game Ready', brand: 'nvidia', page: '/display/laptop' },
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-studio-laptop.json', category: 'NVIDIA Laptop Studio', brand: 'nvidia', page: '/display/laptop' }
    ];

    async function loadAllDrivers() {
        if (allDrivers.length > 0 || isLoading) return;
        isLoading = true;

        try {
            const promises = driverSources.map(async (source) => {
                try {
                    const response = await fetch(source.url);
                    if (!response.ok) return [];
                    const data = await response.json();
                    return data.drivers.map(driver => ({
                        ...driver,
                        category: source.category,
                        brand: source.brand,
                        page: source.page
                    }));
                } catch {
                    return [];
                }
            });

            const results = await Promise.all(promises);
            allDrivers = results.flat();
        } catch (err) {
            console.error('Error loading drivers for search:', err);
        } finally {
            isLoading = false;
        }
    }

    function createSearchOverlay() {
        if (searchOverlay) return;

        searchOverlay = document.createElement('div');
        searchOverlay.className = 'search-overlay';
        searchOverlay.innerHTML = `
            <div class="search-modal">
                <div class="search-header">
                    <span class="material-icons search-icon">search</span>
                    <input type="text" class="search-input" placeholder="Search drivers by version, type..." autocomplete="off">
                    <kbd class="search-kbd">ESC</kbd>
                </div>
                <div class="search-results"></div>
                <div class="search-footer">
                    <span><kbd>↑</kbd> <kbd>↓</kbd> to navigate</span>
                    <span><kbd>Enter</kbd> to select</span>
                    <span><kbd>Esc</kbd> to close</span>
                </div>
            </div>
        `;

        document.body.appendChild(searchOverlay);
        searchInput = searchOverlay.querySelector('.search-input');
        searchResults = searchOverlay.querySelector('.search-results');

        searchOverlay.addEventListener('click', (e) => {
            if (e.target === searchOverlay) closeSearch();
        });

        searchInput.addEventListener('input', debounce(handleSearch, 150));
        searchInput.addEventListener('keydown', handleKeyNav);
    }

    function debounce(fn, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function handleSearch() {
        const query = searchInput.value.trim().toLowerCase();

        if (!query) {
            searchResults.innerHTML = '<div class="search-empty">Start typing to search drivers...</div>';
            return;
        }

        if (allDrivers.length === 0) {
            searchResults.innerHTML = '<div class="search-loading"><span class="material-icons spinning">sync</span> Loading driver data...</div>';
            loadAllDrivers().then(() => handleSearch());
            return;
        }

        const filtered = allDrivers.filter(driver => {
            const searchStr = `${driver.version} ${driver.type || ''} ${driver.category} ${driver.releaseDate || ''}`.toLowerCase();
            return searchStr.includes(query);
        });

        if (filtered.length === 0) {
            searchResults.innerHTML = '<div class="search-empty">No drivers found matching your search.</div>';
            return;
        }

        const grouped = {};
        filtered.slice(0, 20).forEach(driver => {
            if (!grouped[driver.category]) grouped[driver.category] = [];
            grouped[driver.category].push(driver);
        });

        let html = '';
        for (const [category, drivers] of Object.entries(grouped)) {
            html += `<div class="search-category">${category}</div>`;
            drivers.forEach((driver, idx) => {
                const brandClass = driver.brand === 'nvidia' ? 'nvidia' : driver.brand === 'intel' ? 'intel' : 'amd';
                const stableTag = driver.isStable ? `<span class="search-stable">${driver.stabilityGrade || 'Stable'}</span>` : '';
                const favorited = FavoritesModule && FavoritesModule.isFavorite(driver.version) ? '<span class="material-icons search-fav-icon">star</span>' : '';
                html += `
                    <a href="${driver.downloadUrl || driver.page}" class="search-result-item" data-index="${idx}" ${driver.downloadUrl ? 'target="_blank"' : ''}>
                        <div class="search-result-main">
                            <span class="search-brand ${brandClass}"></span>
                            <span class="search-version">${driver.version}</span>
                            ${driver.type ? `<span class="search-type">- ${driver.type}</span>` : ''}
                            ${stableTag}
                            ${favorited}
                        </div>
                        <span class="search-date">${driver.releaseDate || ''}</span>
                    </a>
                `;
            });
        }

        if (filtered.length > 20) {
            html += `<div class="search-more">${filtered.length - 20} more results...</div>`;
        }

        searchResults.innerHTML = html;
    }

    let selectedIndex = -1;

    function handleKeyNav(e) {
        const items = searchResults.querySelectorAll('.search-result-item');

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelection(items);
        } else if (e.key === 'Enter' && selectedIndex >= 0 && items[selectedIndex]) {
            e.preventDefault();
            items[selectedIndex].click();
            closeSearch();
        } else if (e.key === 'Escape') {
            closeSearch();
        }
    }

    function updateSelection(items) {
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === selectedIndex);
            if (i === selectedIndex) {
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    function openSearch() {
        createSearchOverlay();
        searchOverlay.classList.add('active');
        searchInput.value = '';
        searchResults.innerHTML = '<div class="search-empty">Start typing to search drivers...</div>';
        selectedIndex = -1;
        setTimeout(() => searchInput.focus(), 50);
        loadAllDrivers();
    }

    function closeSearch() {
        if (searchOverlay) {
            searchOverlay.classList.remove('active');
        }
    }

    function init() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                openSearch();
            }
            if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                e.preventDefault();
                openSearch();
            }
        });

        const searchBtn = document.getElementById('global-search-btn');
        if (searchBtn) {
            searchBtn.addEventListener('click', openSearch);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return { open: openSearch, close: closeSearch };
})();
