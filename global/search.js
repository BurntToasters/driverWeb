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
        } finally {
            isLoading = false;
        }
    }

    function createSearchOverlay() {
        if (searchOverlay) return;

        searchOverlay = document.createElement('div');
        searchOverlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-start justify-center pt-[10vh] opacity-0 pointer-events-none transition-opacity duration-200';
        
        const container = document.createElement('div');
        container.className = 'w-full max-w-xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 transform scale-95 transition-transform duration-200';
        
        const colorBar = document.createElement('div');
        colorBar.className = 'h-1 bg-gradient-to-r from-nvidia via-primary-500 to-intel';
        container.appendChild(colorBar);
        
        const searchHeader = document.createElement('div');
        searchHeader.className = 'flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-800';
        
        const searchIcon = document.createElement('span');
        searchIcon.className = 'material-icons text-primary-500';
        searchIcon.textContent = 'search';
        searchHeader.appendChild(searchIcon);
        
        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'search-input flex-1 bg-transparent text-lg outline-none text-gray-900 dark:text-white placeholder-gray-400';
        searchInput.placeholder = 'Search drivers by version, type...';
        searchInput.autocomplete = 'off';
        searchHeader.appendChild(searchInput);
        
        const escKey = document.createElement('kbd');
        escKey.className = 'px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 text-gray-500';
        escKey.textContent = 'ESC';
        searchHeader.appendChild(escKey);
        
        container.appendChild(searchHeader);
        
        searchResults = document.createElement('div');
        searchResults.className = 'search-results max-h-[50vh] overflow-y-auto p-2';
        container.appendChild(searchResults);
        
        const footer = document.createElement('div');
        footer.className = 'flex items-center justify-center gap-6 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500';
        
        const navHint = document.createElement('span');
        const upKey = document.createElement('kbd');
        upKey.className = 'px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded';
        upKey.textContent = '↑';
        const downKey = document.createElement('kbd');
        downKey.className = 'px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded';
        downKey.textContent = '↓';
        navHint.appendChild(upKey);
        navHint.appendChild(document.createTextNode(' '));
        navHint.appendChild(downKey);
        navHint.appendChild(document.createTextNode(' navigate'));
        footer.appendChild(navHint);
        
        const enterHint = document.createElement('span');
        const enterKey = document.createElement('kbd');
        enterKey.className = 'px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded';
        enterKey.textContent = 'Enter';
        enterHint.appendChild(enterKey);
        enterHint.appendChild(document.createTextNode(' select'));
        footer.appendChild(enterHint);
        
        container.appendChild(footer);
        searchOverlay.appendChild(container);
        document.body.appendChild(searchOverlay);

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
            searchResults.textContent = '';
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'p-8 text-center text-gray-400';
            emptyDiv.textContent = 'Start typing to search drivers...';
            searchResults.appendChild(emptyDiv);
            return;
        }

        if (allDrivers.length === 0) {
            searchResults.textContent = '';
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'p-8 text-center text-gray-400 flex items-center justify-center gap-2';
            const loadingIcon = document.createElement('span');
            loadingIcon.className = 'material-icons animate-spin';
            loadingIcon.textContent = 'sync';
            loadingDiv.appendChild(loadingIcon);
            loadingDiv.appendChild(document.createTextNode(' Loading driver data...'));
            searchResults.appendChild(loadingDiv);
            loadAllDrivers().then(() => handleSearch());
            return;
        }

        const filtered = allDrivers.filter(driver => {
            const searchStr = `${driver.version} ${driver.type || ''} ${driver.category} ${driver.releaseDate || ''}`.toLowerCase();
            return searchStr.includes(query);
        });

        if (filtered.length === 0) {
            searchResults.textContent = '';
            const noResultsDiv = document.createElement('div');
            noResultsDiv.className = 'p-8 text-center text-gray-400';
            noResultsDiv.textContent = 'No drivers found matching your search.';
            searchResults.appendChild(noResultsDiv);
            return;
        }

        const grouped = {};
        filtered.slice(0, 20).forEach(driver => {
            if (!grouped[driver.category]) grouped[driver.category] = [];
            grouped[driver.category].push(driver);
        });

        searchResults.textContent = '';
        const fragment = document.createDocumentFragment();

        for (const [category, drivers] of Object.entries(grouped)) {
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider';
            categoryHeader.textContent = category;
            fragment.appendChild(categoryHeader);

            drivers.forEach((driver, idx) => {
                const brandColor = driver.brand === 'nvidia' ? 'bg-nvidia' : driver.brand === 'intel' ? 'bg-intel' : 'bg-amd';
                
                const resultItem = document.createElement('a');
                resultItem.href = driver.downloadUrl || driver.page;
                resultItem.className = 'search-result-item flex items-center justify-between px-4 py-3 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group';
                resultItem.dataset.index = idx;
                if (driver.downloadUrl) {
                    resultItem.target = '_blank';
                }

                const leftDiv = document.createElement('div');
                leftDiv.className = 'flex items-center gap-3';

                const brandDot = document.createElement('span');
                brandDot.className = `w-2 h-2 rounded-full ${brandColor}`;
                leftDiv.appendChild(brandDot);

                const versionSpan = document.createElement('span');
                versionSpan.className = 'font-semibold text-gray-900 dark:text-white';
                versionSpan.textContent = driver.version;
                leftDiv.appendChild(versionSpan);

                if (driver.type) {
                    const typeSpan = document.createElement('span');
                    typeSpan.className = 'text-gray-500';
                    typeSpan.textContent = `- ${driver.type}`;
                    leftDiv.appendChild(typeSpan);
                }

                if (driver.isStable && driver.stabilityGrade) {
                    const gradeColor = driver.stabilityGrade.startsWith('A') ? 'bg-emerald-500' : 
                                      driver.stabilityGrade.startsWith('B') ? 'bg-amber-500' : 'bg-red-500';
                    const stableTag = document.createElement('span');
                    stableTag.className = `px-1.5 py-0.5 text-xs font-bold rounded ${gradeColor} text-white`;
                    stableTag.textContent = driver.stabilityGrade || 'Stable';
                    leftDiv.appendChild(stableTag);
                }

                if (typeof FavoritesModule !== 'undefined' && FavoritesModule.isFavorite(driver.version, driver.category)) {
                    const favIcon = document.createElement('span');
                    favIcon.className = 'material-icons text-yellow-500 text-sm';
                    favIcon.textContent = 'star';
                    leftDiv.appendChild(favIcon);
                }

                resultItem.appendChild(leftDiv);

                if (driver.releaseDate) {
                    const dateSpan = document.createElement('span');
                    dateSpan.className = 'text-sm text-gray-400';
                    dateSpan.textContent = driver.releaseDate;
                    resultItem.appendChild(dateSpan);
                }

                fragment.appendChild(resultItem);
            });
        }

        if (filtered.length > 20) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'px-4 py-3 text-center text-sm text-gray-400 border-t border-gray-200 dark:border-gray-700 mt-2';
            moreDiv.textContent = `+${filtered.length - 20} more results...`;
            fragment.appendChild(moreDiv);
        }

        searchResults.appendChild(fragment);
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
        searchResults.textContent = '';
        const initialDiv = document.createElement('div');
        initialDiv.className = 'p-8 text-center text-gray-400';
        initialDiv.textContent = 'Start typing to search drivers...';
        searchResults.appendChild(initialDiv);
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
