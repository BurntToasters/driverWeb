const SearchModule = (function() {
    let searchOverlay = null;
    let searchContainer = null;
    let searchInput = null;
    let searchResults = null;
    let allDrivers = [];
    let isLoading = false;
    let isOpen = false;
    let selectedIndex = -1;
    let lastTrigger = null;
    let optionCounter = 0;

    const driverSources = [
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-game-ready.json', category: 'NVIDIA Game Ready', brand: 'nvidia', page: '/display' },
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-studio.json', category: 'NVIDIA Studio', brand: 'nvidia', page: '/display' },
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/intel-game-on.json', category: 'Intel Game On', brand: 'intel', page: '/display' },
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/intel-pro.json', category: 'Intel Pro', brand: 'intel', page: '/display' },
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-game-ready-laptop.json', category: 'NVIDIA Laptop Game Ready', brand: 'nvidia', page: '/display/laptop' },
        { url: 'https://raw.githubusercontent.com/BurntToasters/driverWeb-data/main/nvidia-studio-laptop.json', category: 'NVIDIA Laptop Studio', brand: 'nvidia', page: '/display/laptop' }
    ];

    function getOverlayState() {
        if (!window.__driverhubOverlayState) {
            window.__driverhubOverlayState = { locks: new Set(), previousOverflow: '' };
        }
        return window.__driverhubOverlayState;
    }

    function lockBodyScroll(lockId) {
        const state = getOverlayState();
        if (!state.locks.size) {
            state.previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        state.locks.add(lockId);
    }

    function unlockBodyScroll(lockId) {
        const state = getOverlayState();
        state.locks.delete(lockId);
        if (!state.locks.size) {
            document.body.style.overflow = state.previousOverflow || '';
            state.previousOverflow = '';
        }
    }

    function getFocusable(container) {
        if (!container) return [];
        const selector = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');

        return Array.from(container.querySelectorAll(selector)).filter(function(el) {
            return !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden');
        });
    }

    function trapFocus(event, container) {
        if (event.key !== 'Tab') return;

        const focusable = getFocusable(container);
        if (!focusable.length) {
            event.preventDefault();
            return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function setSearchControlState(expanded) {
        const searchBtn = document.getElementById('global-search-btn');
        if (searchBtn) {
            searchBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
    }

    async function loadAllDrivers() {
        if (allDrivers.length > 0 || isLoading) return;
        isLoading = true;

        try {
            const promises = driverSources.map(async function(source) {
                try {
                    const response = await fetch(source.url);
                    if (!response.ok) return [];
                    const data = await response.json();
                    return data.drivers.map(function(driver) {
                        return {
                            ...driver,
                            category: source.category,
                            brand: source.brand,
                            page: source.page
                        };
                    });
                } catch {
                    return [];
                }
            });

            const results = await Promise.all(promises);
            allDrivers = results.flat();
        } finally {
            isLoading = false;
        }
    }

    function createSearchOverlay() {
        if (searchOverlay) return;

        searchOverlay = document.createElement('div');
        searchOverlay.id = 'search-overlay';
        searchOverlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-start justify-center pt-[10vh] opacity-0 pointer-events-none transition-opacity duration-200';
        searchOverlay.setAttribute('role', 'dialog');
        searchOverlay.setAttribute('aria-modal', 'true');
        searchOverlay.setAttribute('aria-labelledby', 'search-title');
        searchOverlay.setAttribute('aria-hidden', 'true');
        searchOverlay.setAttribute('tabindex', '-1');

        searchContainer = document.createElement('div');
        searchContainer.className = 'w-full max-w-xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 transform scale-95 transition-transform duration-200';

        const colorBar = document.createElement('div');
        colorBar.className = 'h-1 bg-gradient-to-r from-nvidia via-primary-500 to-intel';
        searchContainer.appendChild(colorBar);

        const searchHeader = document.createElement('div');
        searchHeader.className = 'flex items-center gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-800';

        const title = document.createElement('h2');
        title.id = 'search-title';
        title.className = 'sr-only';
        title.textContent = 'Search drivers';
        searchHeader.appendChild(title);

        const searchIcon = document.createElement('span');
        searchIcon.className = 'material-icons text-primary-500';
        searchIcon.textContent = 'search';
        searchHeader.appendChild(searchIcon);

        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'search-input flex-1 bg-transparent text-lg outline-none text-gray-900 dark:text-white placeholder-gray-400';
        searchInput.placeholder = 'Search drivers by version, type...';
        searchInput.autocomplete = 'off';
        searchInput.setAttribute('aria-label', 'Search drivers');
        searchInput.setAttribute('aria-controls', 'search-results');
        searchInput.setAttribute('aria-autocomplete', 'list');
        searchHeader.appendChild(searchInput);

        const escKey = document.createElement('kbd');
        escKey.className = 'px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 text-gray-500';
        escKey.textContent = 'ESC';
        searchHeader.appendChild(escKey);

        searchContainer.appendChild(searchHeader);

        searchResults = document.createElement('div');
        searchResults.id = 'search-results';
        searchResults.className = 'search-results max-h-[50vh] overflow-y-auto p-2';
        searchResults.setAttribute('role', 'listbox');
        searchResults.setAttribute('aria-label', 'Search results');
        searchContainer.appendChild(searchResults);

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

        searchContainer.appendChild(footer);
        searchOverlay.appendChild(searchContainer);
        document.body.appendChild(searchOverlay);

        searchOverlay.addEventListener('click', function(event) {
            if (event.target === searchOverlay) closeSearch({ restoreFocus: true });
        });

        searchInput.addEventListener('input', debounce(handleSearch, 150));
        searchInput.addEventListener('keydown', handleKeyNav);
    }

    function debounce(fn, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                fn.apply(this, args);
            }.bind(this), delay);
        };
    }

    function setInitialSearchState() {
        searchInput.value = '';
        searchResults.textContent = '';
        selectedIndex = -1;
        optionCounter = 0;
        const initialDiv = document.createElement('div');
        initialDiv.className = 'p-8 text-center text-gray-400';
        initialDiv.textContent = 'Start typing to search drivers...';
        searchResults.appendChild(initialDiv);
        searchResults.removeAttribute('aria-activedescendant');
    }

    function handleSearch() {
        const query = searchInput.value.trim().toLowerCase();
        selectedIndex = -1;
        optionCounter = 0;

        if (!query) {
            searchResults.textContent = '';
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'p-8 text-center text-gray-400';
            emptyDiv.textContent = 'Start typing to search drivers...';
            searchResults.appendChild(emptyDiv);
            searchResults.removeAttribute('aria-activedescendant');
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
            searchResults.removeAttribute('aria-activedescendant');
            loadAllDrivers().then(function() { handleSearch(); });
            return;
        }

        const filtered = allDrivers.filter(function(driver) {
            const searchStr = `${driver.version} ${driver.type || ''} ${driver.category} ${driver.releaseDate || ''}`.toLowerCase();
            return searchStr.includes(query);
        });

        if (!filtered.length) {
            searchResults.textContent = '';
            const noResultsDiv = document.createElement('div');
            noResultsDiv.className = 'p-8 text-center text-gray-400';
            noResultsDiv.textContent = 'No drivers found matching your search.';
            searchResults.appendChild(noResultsDiv);
            searchResults.removeAttribute('aria-activedescendant');
            return;
        }

        const grouped = {};
        filtered.slice(0, 20).forEach(function(driver) {
            if (!grouped[driver.category]) grouped[driver.category] = [];
            grouped[driver.category].push(driver);
        });

        searchResults.textContent = '';
        const fragment = document.createDocumentFragment();

        Object.entries(grouped).forEach(function(entry) {
            const category = entry[0];
            const drivers = entry[1];

            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider';
            categoryHeader.textContent = category;
            fragment.appendChild(categoryHeader);

            drivers.forEach(function(driver) {
                const brandColor = driver.brand === 'nvidia' ? 'bg-nvidia' : driver.brand === 'intel' ? 'bg-intel' : 'bg-amd';

                const resultItem = document.createElement('a');
                resultItem.id = `search-result-${optionCounter}`;
                optionCounter += 1;
                resultItem.href = driver.downloadUrl || driver.page;
                resultItem.className = 'search-result-item flex items-center justify-between px-4 py-3 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors group';
                resultItem.setAttribute('role', 'option');
                resultItem.setAttribute('aria-selected', 'false');
                resultItem.setAttribute('tabindex', '-1');
                if (driver.downloadUrl) {
                    resultItem.target = '_blank';
                    resultItem.rel = 'noopener noreferrer';
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
        });

        if (filtered.length > 20) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'px-4 py-3 text-center text-sm text-gray-400 border-t border-gray-200 dark:border-gray-700 mt-2';
            moreDiv.textContent = `+${filtered.length - 20} more results...`;
            fragment.appendChild(moreDiv);
        }

        searchResults.appendChild(fragment);
        searchResults.removeAttribute('aria-activedescendant');
    }

    function handleKeyNav(event) {
        const items = searchResults.querySelectorAll('.search-result-item');
        if (!items.length) return;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
            updateSelection(items);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
            updateSelection(items);
        } else if (event.key === 'Enter' && selectedIndex >= 0 && items[selectedIndex]) {
            event.preventDefault();
            items[selectedIndex].click();
            closeSearch({ restoreFocus: true });
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closeSearch({ restoreFocus: true });
        }
    }

    function updateSelection(items) {
        items.forEach(function(item, index) {
            if (index === selectedIndex) {
                item.classList.add('bg-primary-100', 'dark:bg-primary-900/30');
                item.setAttribute('aria-selected', 'true');
                searchResults.setAttribute('aria-activedescendant', item.id);
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('bg-primary-100', 'dark:bg-primary-900/30');
                item.setAttribute('aria-selected', 'false');
            }
        });
    }

    function handleOverlayKeydown(event) {
        if (!isOpen) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeSearch({ restoreFocus: true });
            return;
        }

        trapFocus(event, searchOverlay);
    }

    function openSearch(triggerElement) {
        createSearchOverlay();
        if (isOpen) {
            searchInput.focus();
            return;
        }

        isOpen = true;
        lastTrigger = triggerElement || document.activeElement;

        searchOverlay.classList.remove('opacity-0', 'pointer-events-none');
        searchOverlay.classList.add('opacity-100', 'pointer-events-auto');
        searchOverlay.setAttribute('aria-hidden', 'false');

        if (searchContainer) {
            searchContainer.classList.remove('scale-95');
        }

        setSearchControlState(true);
        lockBodyScroll('search');

        setInitialSearchState();

        document.addEventListener('keydown', handleOverlayKeydown);
        document.dispatchEvent(new CustomEvent('driverhub:overlay-opened', {
            detail: { id: 'search' }
        }));

        requestAnimationFrame(function() {
            searchInput.focus();
        });

        loadAllDrivers();
    }

    function closeSearch(options) {
        if (!searchOverlay || !isOpen) return;

        const settings = options || {};
        const shouldRestoreFocus = settings.restoreFocus !== false;

        isOpen = false;

        searchOverlay.classList.add('opacity-0', 'pointer-events-none');
        searchOverlay.classList.remove('opacity-100', 'pointer-events-auto');
        searchOverlay.setAttribute('aria-hidden', 'true');

        if (searchContainer) {
            searchContainer.classList.add('scale-95');
        }

        setSearchControlState(false);
        unlockBodyScroll('search');
        document.removeEventListener('keydown', handleOverlayKeydown);

        if (shouldRestoreFocus && lastTrigger && typeof lastTrigger.focus === 'function') {
            lastTrigger.focus();
        }

        lastTrigger = null;
    }

    function init() {
        document.addEventListener('driverhub:overlay-opened', function(event) {
            if (!isOpen) return;
            if (!event.detail || event.detail.id === 'search') return;
            closeSearch({ restoreFocus: false });
        });

        document.addEventListener('keydown', function(event) {
            if (isOpen) return;

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                openSearch(document.activeElement);
                return;
            }

            if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
                event.preventDefault();
                openSearch(document.activeElement);
            }
        });

        const searchBtn = document.getElementById('global-search-btn');
        if (searchBtn) {
            searchBtn.setAttribute('aria-expanded', 'false');
            searchBtn.addEventListener('click', function() {
                openSearch(searchBtn);
            });
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        open: openSearch,
        close: closeSearch
    };
})();
