const SearchModule = (function() {
    let searchOverlay = null;
    let searchContainer = null;
    let searchInput = null;
    let searchResults = null;
    let allDrivers = [];
    let isOpen = false;
    let selectedIndex = -1;
    let lastTrigger = null;
    let seededUrlQuery = '';

    const facets = {
        brand: '',
        channel: '',
        risk: ''
    };

    function normalizeBrand(brand) {
        const normalized = (brand || '').toLowerCase();
        return ['nvidia', 'intel', 'amd', 'audio', 'network'].includes(normalized) ? normalized : '';
    }

    function normalizeChannel(channel) {
        const normalized = (channel || '').toLowerCase();
        return ['game-ready', 'studio', 'game-on', 'pro', 'chipset', 'audio', 'network'].includes(normalized) ? normalized : '';
    }

    function normalizeRisk(risk) {
        const normalized = (risk || '').toLowerCase();
        return ['low', 'medium', 'high'].includes(normalized) ? normalized : '';
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeInternalPath(pathValue) {
        const value = String(pathValue || '').trim();
        if (value.startsWith('/') && !value.startsWith('//')) return value;
        return '/display';
    }

    function parseDate(value) {
        if (!value) return 0;
        const d = new Date(value);
        if (!Number.isNaN(d.getTime())) return d.getTime();
        return 0;
    }

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

    function buildSearchBlob(driver) {
        return [
            driver.version || '',
            driver.type || '',
            driver.category || '',
            driver.vendor || '',
            driver.channel || '',
            driver.releaseDate || '',
            (driver.highlights || []).join(' '),
            (driver.issueTags || []).join(' ')
        ].join(' ').toLowerCase();
    }

    function scoreResult(driver, query) {
        if (!query) return 20 + (driver.isStable ? 5 : 0);
        const value = query.toLowerCase();
        const version = String(driver.version || '').toLowerCase();
        const type = String(driver.type || '').toLowerCase();
        const blob = buildSearchBlob(driver);
        let score = 0;
        if (version === value) score += 120;
        if (version.startsWith(value)) score += 90;
        if (version.includes(value)) score += 65;
        if (type.includes(value)) score += 35;
        if (blob.includes(value)) score += 25;
        if ((driver.channel || '').includes(value)) score += 15;
        if (driver.isStable) score += 5;
        const freshness = parseDate(driver.publishedAt || driver.releaseDateIso || driver.releaseDate);
        if (freshness > 0) score += Math.min(10, Math.floor((freshness / 86400000) % 30));
        return score;
    }

    async function loadAllDrivers() {
        if (allDrivers.length) return allDrivers;
        const response = await fetch('/feeds/drivers.json');
        if (!response.ok) throw new Error('search feed unavailable');
        const data = await response.json();
        allDrivers = Array.isArray(data.entries) ? data.entries : [];
        return allDrivers;
    }

    function getResultHref(driver, options) {
        const settings = options || {};
        const params = new URLSearchParams();
        if (driver.version) params.set('q', driver.version);
        if (driver.brand) params.set('brand', driver.brand);
        if (driver.channel) params.set('channel', driver.channel);
        if (settings.detailId) params.set('detail', settings.detailId);
        return `${safeInternalPath(driver.page)}${params.toString() ? `?${params.toString()}` : ''}`;
    }

    function createFacetSelect(id, label, options) {
        const wrap = document.createElement('label');
        wrap.className = 'flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300';
        const title = document.createElement('span');
        title.textContent = label;
        wrap.appendChild(title);
        const select = document.createElement('select');
        select.id = id;
        select.className = 'px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 border border-transparent focus:border-primary-500 outline-none text-xs text-gray-700 dark:text-gray-200';
        options.forEach(function(option) {
            const item = document.createElement('option');
            item.value = option.value;
            item.textContent = option.label;
            select.appendChild(item);
        });
        wrap.appendChild(select);
        return { wrap, select };
    }

    function createSearchOverlay() {
        if (searchOverlay) return;

        searchOverlay = document.createElement('div');
        searchOverlay.id = 'search-overlay';
        searchOverlay.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[300] flex items-start justify-center pt-[8vh] opacity-0 pointer-events-none transition-opacity duration-200';
        searchOverlay.setAttribute('role', 'dialog');
        searchOverlay.setAttribute('aria-modal', 'true');

        searchContainer = document.createElement('div');
        searchContainer.className = 'w-full max-w-4xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-800 transform scale-95 transition-transform duration-200';

        const header = document.createElement('div');
        header.className = 'px-5 py-4 border-b border-gray-200 dark:border-gray-800 space-y-3';

        const top = document.createElement('div');
        top.className = 'flex items-center gap-3';

        const icon = document.createElement('span');
        icon.className = 'material-icons text-primary-500';
        icon.textContent = 'search';
        top.appendChild(icon);

        searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'search-input flex-1 bg-transparent text-lg outline-none text-gray-900 dark:text-white placeholder-gray-400';
        searchInput.placeholder = 'Search versions, channels, vendors, risk tags...';
        top.appendChild(searchInput);

        const esc = document.createElement('kbd');
        esc.className = 'px-2 py-1 text-xs font-mono bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 text-gray-500';
        esc.textContent = 'ESC';
        top.appendChild(esc);

        header.appendChild(top);

        const facetsRow = document.createElement('div');
        facetsRow.className = 'flex flex-wrap items-center gap-3';

        const brandFacet = createFacetSelect('search-facet-brand', 'Brand', [
            { value: '', label: 'All' },
            { value: 'nvidia', label: 'NVIDIA' },
            { value: 'intel', label: 'Intel' },
            { value: 'amd', label: 'AMD' },
            { value: 'audio', label: 'Audio' },
            { value: 'network', label: 'Network' }
        ]);
        const channelFacet = createFacetSelect('search-facet-channel', 'Channel', [
            { value: '', label: 'All' },
            { value: 'game-ready', label: 'Game Ready' },
            { value: 'studio', label: 'Studio' },
            { value: 'game-on', label: 'Game On' },
            { value: 'pro', label: 'Pro' },
            { value: 'audio', label: 'Audio' },
            { value: 'network', label: 'Network' }
        ]);
        const riskFacet = createFacetSelect('search-facet-risk', 'Risk', [
            { value: '', label: 'All' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' }
        ]);

        facetsRow.appendChild(brandFacet.wrap);
        facetsRow.appendChild(channelFacet.wrap);
        facetsRow.appendChild(riskFacet.wrap);

        const clearFacets = document.createElement('button');
        clearFacets.type = 'button';
        clearFacets.className = 'text-xs text-primary-600 dark:text-primary-400 hover:underline';
        clearFacets.textContent = 'Clear facets';
        clearFacets.addEventListener('click', function() {
            facets.brand = '';
            facets.channel = '';
            facets.risk = '';
            brandFacet.select.value = '';
            channelFacet.select.value = '';
            riskFacet.select.value = '';
            handleSearch();
        });
        facetsRow.appendChild(clearFacets);

        brandFacet.select.addEventListener('change', function(event) {
            facets.brand = normalizeBrand(event.target.value);
            handleSearch();
        });
        channelFacet.select.addEventListener('change', function(event) {
            facets.channel = normalizeChannel(event.target.value);
            handleSearch();
        });
        riskFacet.select.addEventListener('change', function(event) {
            facets.risk = normalizeRisk(event.target.value);
            handleSearch();
        });

        header.appendChild(facetsRow);

        searchContainer.appendChild(header);

        searchResults = document.createElement('div');
        searchResults.className = 'search-results max-h-[58vh] overflow-y-auto p-2';
        searchContainer.appendChild(searchResults);

        const footer = document.createElement('div');
        footer.className = 'flex items-center justify-center gap-6 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500';
        footer.innerHTML = '<span><kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↑</kbd> <kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">↓</kbd> navigate</span><span><kbd class="px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd> open</span>';
        searchContainer.appendChild(footer);

        searchOverlay.appendChild(searchContainer);
        document.body.appendChild(searchOverlay);

        searchOverlay.addEventListener('click', function(event) {
            if (event.target === searchOverlay) closeSearch({ restoreFocus: true });
        });

        searchInput.addEventListener('input', function() { handleSearch(); });
        searchInput.addEventListener('keydown', handleKeyNav);
    }

    function renderNoResults(message) {
        searchResults.textContent = '';
        const noResults = document.createElement('div');
        noResults.className = 'p-8 text-center text-gray-400';
        noResults.textContent = message;
        searchResults.appendChild(noResults);
    }

    function createQuickButton(label, icon, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30';
        button.innerHTML = `<span class="material-icons text-[13px]">${icon}</span>${label}`;
        button.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            onClick();
        });
        return button;
    }

    function handleSearch() {
        if (!searchInput || !searchResults) return;
        const query = searchInput.value.trim().toLowerCase();
        seededUrlQuery = query;
        selectedIndex = -1;

        if (!allDrivers.length) {
            renderNoResults('Loading driver data...');
            return;
        }

        let filtered = allDrivers.filter(function(driver) {
            if (facets.brand && normalizeBrand(driver.brand) !== facets.brand) return false;
            if (facets.channel && normalizeChannel(driver.channel) !== facets.channel) return false;
            if (facets.risk && normalizeRisk(driver.riskLevel) !== facets.risk) return false;
            return true;
        }).map(function(driver) {
            return { driver, score: scoreResult(driver, query) };
        }).filter(function(item) {
            return query ? item.score > 0 : true;
        }).sort(function(a, b) {
            if (b.score !== a.score) return b.score - a.score;
            return parseDate(b.driver.publishedAt || b.driver.releaseDateIso || b.driver.releaseDate) - parseDate(a.driver.publishedAt || a.driver.releaseDateIso || a.driver.releaseDate);
        }).slice(0, 40);

        if (!filtered.length) {
            renderNoResults('No drivers found matching your query/facets.');
            return;
        }

        searchResults.textContent = '';
        filtered.forEach(function(item, index) {
            const driver = item.driver;
            const row = document.createElement('a');
            row.href = getResultHref(driver);
            row.className = 'search-result-item block p-3 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors';
            row.setAttribute('data-result-index', String(index));
            row.setAttribute('tabindex', '-1');
            row.setAttribute('role', 'option');
            const safeVersion = escapeHtml(driver.version || 'Unknown');
            const safeType = escapeHtml(driver.type || '');
            const safeCategory = escapeHtml(driver.category || 'Driver');
            const safeChannel = escapeHtml(driver.channel || 'general');
            const safeRisk = escapeHtml(driver.riskLevel || 'medium');
            const safeReleaseDate = escapeHtml(driver.releaseDate || '');
            row.innerHTML = `<div class="flex items-start justify-between gap-3"><div class="min-w-0"><div class="font-semibold text-gray-900 dark:text-white truncate">${safeVersion}${safeType ? ` - ${safeType}` : ''}</div><div class="text-xs text-gray-500 mt-0.5">${safeCategory} · ${safeChannel} · ${safeRisk} risk</div></div><div class="text-xs text-gray-400">${safeReleaseDate}</div></div>`;

            const quick = document.createElement('div');
            quick.className = 'mt-2 flex flex-wrap items-center gap-2';
            quick.appendChild(createQuickButton('Open', 'open_in_new', function() {
                window.location.href = getResultHref(driver);
                closeSearch({ restoreFocus: true });
            }));

            quick.appendChild(createQuickButton('Details', 'info', function() {
                window.location.href = getResultHref(driver, { detailId: driver.id || '' });
                closeSearch({ restoreFocus: true });
            }));

            if (window.DriverHubDrivers && typeof window.DriverHubDrivers.addToCompare === 'function') {
                quick.appendChild(createQuickButton('Compare', 'compare_arrows', function() {
                    window.DriverHubDrivers.addToCompare(driver.id);
                }));
            }

            if (typeof FavoritesModule !== 'undefined' && typeof FavoritesModule.toggle === 'function') {
                quick.appendChild(createQuickButton('Watch', 'star', function() {
                    FavoritesModule.toggle({
                        id: driver.id,
                        version: driver.version,
                        type: driver.type,
                        category: driver.category,
                        downloadUrl: driver.downloadUrl,
                        brand: driver.brand,
                        page: driver.page || '/display',
                        channel: driver.channel,
                        riskLevel: driver.riskLevel,
                        publishedAt: driver.publishedAt
                    });
                }));
            }

            row.appendChild(quick);
            searchResults.appendChild(row);
        });
    }

    function updateSelection(items) {
        items.forEach(function(item, index) {
            item.classList.toggle('bg-primary-100', index === selectedIndex);
            item.classList.toggle('dark:bg-primary-900/30', index === selectedIndex);
            item.setAttribute('aria-selected', index === selectedIndex ? 'true' : 'false');
            if (index === selectedIndex) item.scrollIntoView({ block: 'nearest' });
        });
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
            window.location.href = items[selectedIndex].href;
            closeSearch({ restoreFocus: true });
        } else if (event.key === 'Escape') {
            event.preventDefault();
            closeSearch({ restoreFocus: true });
        }
    }

    function openSearch(triggerElement, options) {
        createSearchOverlay();
        const settings = options || {};
        if (typeof settings.query === 'string') seededUrlQuery = settings.query.trim();
        if (settings.brand !== undefined) facets.brand = normalizeBrand(settings.brand);
        if (settings.channel !== undefined) facets.channel = normalizeChannel(settings.channel);
        if (settings.risk !== undefined) facets.risk = normalizeRisk(settings.risk);

        if (isOpen) {
            searchInput.focus();
            return;
        }

        isOpen = true;
        lastTrigger = triggerElement || document.activeElement;

        searchOverlay.classList.remove('opacity-0', 'pointer-events-none');
        searchOverlay.classList.add('opacity-100', 'pointer-events-auto');
        searchContainer.classList.remove('scale-95');

        searchInput.value = seededUrlQuery || '';
        lockBodyScroll('search');
        document.dispatchEvent(new CustomEvent('driverhub:overlay-opened', { detail: { id: 'search' } }));

        requestAnimationFrame(function() {
            searchInput.focus();
            if (searchInput.value) searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        });

        handleSearch();
    }

    function closeSearch(options) {
        if (!searchOverlay || !isOpen) return;
        const settings = options || {};
        const restoreFocus = settings.restoreFocus !== false;

        isOpen = false;
        searchOverlay.classList.add('opacity-0', 'pointer-events-none');
        searchOverlay.classList.remove('opacity-100', 'pointer-events-auto');
        searchContainer.classList.add('scale-95');
        unlockBodyScroll('search');

        if (restoreFocus && lastTrigger && typeof lastTrigger.focus === 'function') lastTrigger.focus();
        lastTrigger = null;
    }

    function parseUrlSeedState() {
        const params = new URLSearchParams(window.location.search);
        seededUrlQuery = (params.get('q') || '').trim();
        facets.brand = normalizeBrand(params.get('brand'));
        facets.channel = normalizeChannel(params.get('channel'));
        facets.risk = normalizeRisk(params.get('risk'));
    }

    function init() {
        parseUrlSeedState();

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

        loadAllDrivers().then(function() {
            if (isOpen) handleSearch();
        }).catch(function() {
            allDrivers = [];
        });
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        open: function(triggerElement, options) {
            openSearch(triggerElement, options);
        },
        close: closeSearch,
        openWithQuery: function(query, options) {
            const settings = options || {};
            openSearch(document.activeElement, {
                query: query,
                brand: settings.brand || '',
                channel: settings.channel || '',
                risk: settings.risk || ''
            });
        }
    };
})();
