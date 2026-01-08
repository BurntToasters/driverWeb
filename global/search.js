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
        searchOverlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-start justify-center pt-[10vh] opacity-0 pointer-events-none transition-opacity duration-200';
        searchOverlay.innerHTML = `
            <div class="w-full max-w-xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 transform scale-95 transition-transform duration-200">
                <div class="h-1 bg-gradient-to-r from-nvidia via-primary-500 to-intel"></div>
                <div class="flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-800">
                    <span class="material-icons text-primary-500">search</span>
                    <input type="text" class="search-input flex-1 bg-transparent text-lg outline-none text-gray-900 dark:text-white placeholder-gray-400" placeholder="Search drivers by version, type..." autocomplete="off">
                    <kbd class="px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 text-gray-500">ESC</kbd>
                </div>
                <div class="search-results max-h-[50vh] overflow-y-auto p-2"></div>
                <div class="flex items-center justify-center gap-6 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500">
                    <span><kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑</kbd> <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↓</kbd> navigate</span>
                    <span><kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> select</span>
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
            searchResults.innerHTML = '<div class="p-8 text-center text-gray-400">Start typing to search drivers...</div>';
            return;
        }

        if (allDrivers.length === 0) {
            searchResults.innerHTML = '<div class="p-8 text-center text-gray-400 flex items-center justify-center gap-2"><span class="material-icons animate-spin">sync</span> Loading driver data...</div>';
            loadAllDrivers().then(() => handleSearch());
            return;
        }

        const filtered = allDrivers.filter(driver => {
            const searchStr = `${driver.version} ${driver.type || ''} ${driver.category} ${driver.releaseDate || ''}`.toLowerCase();
            return searchStr.includes(query);
        });

        if (filtered.length === 0) {
            searchResults.innerHTML = '<div class="p-8 text-center text-gray-400">No drivers found matching your search.</div>';
            return;
        }

        const grouped = {};
        filtered.slice(0, 20).forEach(driver => {
            if (!grouped[driver.category]) grouped[driver.category] = [];
            grouped[driver.category].push(driver);
        });

        let html = '';
        for (const [category, drivers] of Object.entries(grouped)) {
            html += `<div class="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">${category}</div>`;
            drivers.forEach((driver, idx) => {
                const brandColor = driver.brand === 'nvidia' ? 'bg-nvidia' : driver.brand === 'intel' ? 'bg-intel' : 'bg-amd';
                const gradeColor = driver.stabilityGrade?.startsWith('A') ? 'bg-emerald-500' : driver.stabilityGrade?.startsWith('B') ? 'bg-amber-500' : 'bg-red-500';
                const stableTag = driver.isStable ? `<span class="px-1.5 py-0.5 text-xs font-bold rounded ${gradeColor} text-white">${driver.stabilityGrade || 'Stable'}</span>` : '';
                const favorited = typeof FavoritesModule !== 'undefined' && FavoritesModule.isFavorite(driver.version, driver.category) ? '<span class="material-icons text-yellow-500 text-sm">star</span>' : '';
                html += `
                    <a href="${driver.downloadUrl || driver.page}" class="search-result-item flex items-center justify-between px-4 py-3 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group" data-index="${idx}" ${driver.downloadUrl ? 'target="_blank"' : ''}>
                        <div class="flex items-center gap-3">
                            <span class="w-2 h-2 rounded-full ${brandColor}"></span>
                            <span class="font-semibold text-gray-900 dark:text-white">${driver.version}</span>
                            ${driver.type ? `<span class="text-gray-500">- ${driver.type}</span>` : ''}
                            ${stableTag}
                            ${favorited}
                        </div>
                        <span class="text-sm text-gray-400">${driver.releaseDate || ''}</span>
                    </a>
                `;
            });
        }

        if (filtered.length > 20) {
            html += `<div class="px-4 py-3 text-center text-sm text-gray-400 border-t border-gray-200 dark:border-gray-700 mt-2">+${filtered.length - 20} more results...</div>`;
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
            if (i === selectedIndex) {
                item.classList.add('bg-primary-100', 'dark:bg-primary-900/30');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('bg-primary-100', 'dark:bg-primary-900/30');
            }
        });
    }

    function openSearch() {
        createSearchOverlay();
        searchOverlay.classList.remove('opacity-0', 'pointer-events-none');
        searchOverlay.classList.add('opacity-100', 'pointer-events-auto');
        searchOverlay.querySelector('.bg-white, .dark\\:bg-gray-900')?.classList.remove('scale-95');
        searchInput.value = '';
        searchResults.innerHTML = '<div class="p-8 text-center text-gray-400">Start typing to search drivers...</div>';
        selectedIndex = -1;
        setTimeout(() => searchInput.focus(), 50);
        loadAllDrivers();
    }

    function closeSearch() {
        if (searchOverlay) {
            searchOverlay.classList.add('opacity-0', 'pointer-events-none');
            searchOverlay.classList.remove('opacity-100', 'pointer-events-auto');
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
