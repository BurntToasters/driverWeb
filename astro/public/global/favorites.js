const FavoritesModule = (function() {
    const STORAGE_KEY = 'driverhub_watchlist';
    const LEGACY_STORAGE_KEY = 'driverhub_favorites';
    const META_KEY = 'driverhub_watchlist_meta';

    let panel = null;
    let backdrop = null;
    let isOpen = false;
    let lastTrigger = null;
    const latestByCategory = {};
    const deltaLatestByCategory = {};
    const deltaRecentByCategory = {};

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

    function setFavoritesControlState(expanded) {
        const button = document.getElementById('favorites-btn');
        if (button) {
            button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
    }

    function getMeta() {
        try {
            const parsed = JSON.parse(localStorage.getItem(META_KEY));
            if (!parsed || typeof parsed !== 'object') {
                return { seenLatestByCategory: {} };
            }
            if (!parsed.seenLatestByCategory || typeof parsed.seenLatestByCategory !== 'object') {
                parsed.seenLatestByCategory = {};
            }
            return parsed;
        } catch {
            return { seenLatestByCategory: {} };
        }
    }

    function saveMeta(meta) {
        localStorage.setItem(META_KEY, JSON.stringify(meta));
    }

    function getWatchlist() {
        try {
            const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (Array.isArray(current)) {
                return current;
            }
        } catch {
        }

        try {
            const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
            if (Array.isArray(legacy)) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
                return legacy;
            }
        } catch {
        }

        return [];
    }

    function saveWatchlist(watchlist) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(watchlist));
    }

    function addFavorite(driver) {
        const watchlist = getWatchlist();
        const exists = watchlist.find(function(item) {
            return item.version === driver.version && item.category === driver.category;
        });

        if (!exists) {
            watchlist.unshift({
                version: driver.version,
                type: driver.type,
                category: driver.category,
                downloadUrl: driver.downloadUrl,
                brand: driver.brand,
                page: driver.page || '/display',
                id: driver.id || '',
                channel: driver.channel || '',
                riskLevel: driver.riskLevel || '',
                publishedAt: driver.publishedAt || '',
                addedAt: Date.now()
            });
            saveWatchlist(watchlist);
        }

        updateFavoriteButtons();
        updateHeaderNotification();
        showToast('Added to watchlist');
    }

    function removeFavorite(version, category) {
        let watchlist = getWatchlist();
        watchlist = watchlist.filter(function(item) {
            return !(item.version === version && item.category === category);
        });
        saveWatchlist(watchlist);
        updateFavoriteButtons();
        updateHeaderNotification();
        showToast('Removed from watchlist');
    }

    function isFavorite(version, category) {
        const watchlist = getWatchlist();
        if (category) {
            return watchlist.some(function(item) {
                return item.version === version && item.category === category;
            });
        }
        return watchlist.some(function(item) {
            return item.version === version;
        });
    }

    function toggleFavorite(driver) {
        if (isFavorite(driver.version, driver.category)) {
            removeFavorite(driver.version, driver.category);
        } else {
            addFavorite(driver);
        }
    }

    function updateFavoriteButtons() {
        document.querySelectorAll('[data-version][data-category]').forEach(function(btn) {
            if (!btn.classList.contains('favorites-remove')) {
                const version = btn.dataset.version;
                const category = btn.dataset.category;
                const favorite = isFavorite(version, category);
                btn.className = favorite
                    ? 'p-1.5 rounded-lg text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30 transition-colors'
                    : 'p-1.5 rounded-lg text-gray-400 hover:text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors';
                const icon = btn.querySelector('.material-icons');
                if (icon) icon.textContent = favorite ? 'star' : 'star_border';
                btn.title = favorite ? 'Remove from watchlist' : 'Add to watchlist';
            }
        });
    }

    function showToast(message) {
        let toast = document.querySelector('.toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-notification fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl shadow-2xl font-medium z-[400] opacity-0 translate-y-4 transition-all duration-300 pointer-events-none';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            toast.setAttribute('aria-atomic', 'true');
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.classList.remove('opacity-0', 'translate-y-4');
        toast.classList.add('opacity-100', 'translate-y-0');

        setTimeout(function() {
            toast.classList.add('opacity-0', 'translate-y-4');
            toast.classList.remove('opacity-100', 'translate-y-0');
        }, 2000);
    }

    function getLatestVersionForCategory(category) {
        return deltaLatestByCategory[category] || latestByCategory[category] || '';
    }

    function hasNewForItem(item) {
        const latest = getLatestVersionForCategory(item.category);
        if (!latest || latest === item.version) {
            return false;
        }
        const meta = getMeta();
        return meta.seenLatestByCategory[item.category] !== latest;
    }

    function hasAnyNewUpdates() {
        const watchlist = getWatchlist();
        return watchlist.some(function(item) {
            return hasNewForItem(item);
        });
    }

    function updateHeaderNotification() {
        const button = document.getElementById('favorites-btn');
        if (!button) return;

        button.classList.add('relative');

        let dot = button.querySelector('[data-watchlist-dot]');
        const shouldShow = hasAnyNewUpdates();
        if (!dot) {
            dot = document.createElement('span');
            dot.dataset.watchlistDot = 'true';
            dot.className = 'hidden absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-950';
            button.appendChild(dot);
        }

        dot.classList.toggle('hidden', !shouldShow);
        button.title = shouldShow ? 'Watchlist (new updates)' : 'Watchlist';
    }

    function markWatchlistCategoriesSeen() {
        const watchlist = getWatchlist();
        const meta = getMeta();

        watchlist.forEach(function(item) {
            const latest = getLatestVersionForCategory(item.category);
            if (latest) {
                meta.seenLatestByCategory[item.category] = latest;
            }
        });

        saveMeta(meta);
        updateHeaderNotification();
    }

    function closeFavoritesPanel(restoreFocus) {
        if (!panel || !backdrop || !isOpen) return;

        isOpen = false;

        backdrop.classList.add('opacity-0', 'pointer-events-none');
        backdrop.classList.remove('opacity-100', 'pointer-events-auto');

        panel.classList.add('translate-x-full');
        panel.classList.remove('translate-x-0');
        panel.setAttribute('aria-hidden', 'true');

        markWatchlistCategoriesSeen();

        setFavoritesControlState(false);
        unlockBodyScroll('favorites');

        if (restoreFocus !== false && lastTrigger && typeof lastTrigger.focus === 'function') {
            lastTrigger.focus();
        }

        lastTrigger = null;
    }

    function handlePanelKeydown(event) {
        if (!isOpen || !panel) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            closeFavoritesPanel(true);
            return;
        }

        trapFocus(event, panel);
    }

    function ensureFavoritesUI() {
        if (panel && backdrop) return;

        backdrop = document.createElement('div');
        backdrop.id = 'favorites-backdrop';
        backdrop.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-[240] opacity-0 pointer-events-none transition-opacity duration-300';
        backdrop.addEventListener('click', function() {
            closeFavoritesPanel(true);
        });

        panel = document.createElement('div');
        panel.id = 'favorites-panel';
        panel.className = 'fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl z-[250] transform translate-x-full transition-transform duration-300';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-labelledby', 'favorites-title');
        panel.setAttribute('aria-hidden', 'true');
        panel.setAttribute('tabindex', '-1');

        const header = document.createElement('div');
        header.className = 'bg-gradient-to-r from-yellow-400 to-orange-500 p-5';

        const headerFlex = document.createElement('div');
        headerFlex.className = 'flex items-center justify-between';

        const leftHeader = document.createElement('div');
        leftHeader.className = 'flex items-center gap-3';

        const starIcon = document.createElement('span');
        starIcon.className = 'material-icons text-white text-2xl';
        starIcon.textContent = 'star';
        leftHeader.appendChild(starIcon);

        const title = document.createElement('span');
        title.id = 'favorites-title';
        title.className = 'text-xl font-bold text-white';
        title.textContent = 'Watchlist';
        leftHeader.appendChild(title);

        headerFlex.appendChild(leftHeader);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'favorites-close p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close watchlist');
        const closeIcon = document.createElement('span');
        closeIcon.className = 'material-icons';
        closeIcon.textContent = 'close';
        closeBtn.appendChild(closeIcon);
        closeBtn.addEventListener('click', function() {
            closeFavoritesPanel(true);
        });
        headerFlex.appendChild(closeBtn);

        header.appendChild(headerFlex);
        panel.appendChild(header);

        const content = document.createElement('div');
        content.className = 'favorites-content p-4 space-y-3 overflow-y-auto';
        content.style.maxHeight = 'calc(100vh - 88px)';
        panel.appendChild(content);

        document.body.appendChild(backdrop);
        document.body.appendChild(panel);

        document.addEventListener('keydown', handlePanelKeydown);
    }

    function renderFavoritesPanel() {
        ensureFavoritesUI();

        const watchlist = getWatchlist();
        const content = panel.querySelector('.favorites-content');
        content.textContent = '';

        if (!watchlist.length) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'flex flex-col items-center justify-center py-12 text-center';

            const emptyIcon = document.createElement('span');
            emptyIcon.className = 'material-icons text-6xl text-gray-300 dark:text-gray-600 mb-4';
            emptyIcon.textContent = 'star_border';
            emptyDiv.appendChild(emptyIcon);

            const emptyTitle = document.createElement('p');
            emptyTitle.className = 'text-lg font-semibold text-gray-900 dark:text-white';
            emptyTitle.textContent = 'No watchlist items yet';
            emptyDiv.appendChild(emptyTitle);

            const emptyText = document.createElement('p');
            emptyText.className = 'text-sm text-gray-500 mt-1';
            emptyText.textContent = 'Click the star icon on any driver to add it here';
            emptyDiv.appendChild(emptyText);

            content.appendChild(emptyDiv);
            return;
        }

        watchlist.forEach(function(item) {
            const brandColor = item.brand === 'nvidia' ? 'bg-nvidia' : item.brand === 'intel' ? 'bg-intel' : 'bg-amd';
            const hasNew = hasNewForItem(item);

            const watchItem = document.createElement('div');
            watchItem.className = 'p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-3';

            const topRow = document.createElement('div');
            topRow.className = 'flex items-start gap-3';

            const brandDot = document.createElement('span');
            brandDot.className = `w-3 h-3 rounded-full ${brandColor} mt-1`;
            topRow.appendChild(brandDot);

            const infoDiv = document.createElement('div');
            infoDiv.className = 'flex-1 min-w-0';

            const versionRow = document.createElement('div');
            versionRow.className = 'flex items-center gap-2 flex-wrap';

            const versionDiv = document.createElement('div');
            versionDiv.className = 'font-semibold text-gray-900 dark:text-white truncate';
            versionDiv.textContent = item.version;
            versionRow.appendChild(versionDiv);

            if (hasNew) {
                const badge = document.createElement('span');
                badge.className = 'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
                badge.textContent = 'New update';
                versionRow.appendChild(badge);
            }

            infoDiv.appendChild(versionRow);

            const metaDiv = document.createElement('div');
            metaDiv.className = 'text-sm text-gray-500 dark:text-gray-400 truncate';
            metaDiv.textContent = item.type || item.category;
            infoDiv.appendChild(metaDiv);

            if (hasNew && deltaRecentByCategory[item.category]) {
                const updateDiv = document.createElement('div');
                updateDiv.className = 'text-xs text-emerald-600 dark:text-emerald-300 mt-0.5 truncate';
                updateDiv.textContent = `Latest: ${deltaRecentByCategory[item.category].version}`;
                infoDiv.appendChild(updateDiv);
            }

            topRow.appendChild(infoDiv);
            watchItem.appendChild(topRow);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'flex items-center gap-2 flex-wrap';

            const openPageLink = document.createElement('a');
            const params = new URLSearchParams();
            params.set('q', item.version);
            if (item.brand) {
                params.set('brand', item.brand);
            }
            openPageLink.href = `${item.page || '/display'}?${params.toString()}`;
            openPageLink.className = 'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-300 transition-colors';
            openPageLink.title = 'Open on DriverHub';
            openPageLink.innerHTML = '<span class="material-icons text-[14px]">open_in_new</span>Open';
            actionsDiv.appendChild(openPageLink);

            if (item.downloadUrl) {
                const downloadLink = document.createElement('a');
                downloadLink.href = item.downloadUrl;
                downloadLink.target = '_blank';
                downloadLink.rel = 'noopener noreferrer';
                downloadLink.className = 'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-600 hover:bg-primary-200 dark:hover:bg-primary-800/40 transition-colors';
                downloadLink.title = 'Download';
                downloadLink.innerHTML = '<span class="material-icons text-[14px]">download</span>Download';
                actionsDiv.appendChild(downloadLink);
            }

            const removeBtn = document.createElement('button');
            removeBtn.className = 'favorites-remove inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors';
            removeBtn.type = 'button';
            removeBtn.dataset.version = item.version;
            removeBtn.dataset.category = item.category;
            removeBtn.title = 'Remove from watchlist';
            removeBtn.innerHTML = '<span class="material-icons text-[14px]">delete</span>Remove';
            removeBtn.addEventListener('click', function() {
                removeFavorite(item.version, item.category);
                renderFavoritesPanel();
            });
            actionsDiv.appendChild(removeBtn);

            watchItem.appendChild(actionsDiv);
            content.appendChild(watchItem);
        });
    }

    function openFavoritesPanel(triggerElement) {
        renderFavoritesPanel();
        if (!panel || !backdrop) return;

        if (isOpen) {
            const focusable = getFocusable(panel);
            if (focusable.length) {
                focusable[0].focus();
            } else {
                panel.focus();
            }
            return;
        }

        isOpen = true;
        lastTrigger = triggerElement || document.activeElement;

        backdrop.classList.remove('opacity-0', 'pointer-events-none');
        backdrop.classList.add('opacity-100', 'pointer-events-auto');

        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
        panel.setAttribute('aria-hidden', 'false');

        setFavoritesControlState(true);
        lockBodyScroll('favorites');

        document.dispatchEvent(new CustomEvent('driverhub:overlay-opened', {
            detail: { id: 'favorites' }
        }));

        const focusable = getFocusable(panel);
        if (focusable.length) {
            focusable[0].focus();
        } else {
            panel.focus();
        }
    }

    function handleDriversLoadedEvent(event) {
        if (!event.detail || !Array.isArray(event.detail.drivers)) return;
        const category = event.detail.category;
        if (!category) return;

        const firstDriver = event.detail.drivers[0];
        if (firstDriver && firstDriver.version) {
            latestByCategory[category] = firstDriver.version;
        }

        updateHeaderNotification();
        if (isOpen) {
            renderFavoritesPanel();
        }
    }

    function loadDeltaFeed() {
        fetch('/feeds/drivers-delta.json')
            .then(function(response) {
                if (!response.ok) return null;
                return response.json();
            })
            .then(function(data) {
                if (!data || !Array.isArray(data.recent)) return;
                data.recent.forEach(function(item) {
                    if (!item.category) return;
                    if (!deltaLatestByCategory[item.category]) {
                        deltaLatestByCategory[item.category] = item.version || '';
                    }
                    if (!deltaRecentByCategory[item.category]) {
                        deltaRecentByCategory[item.category] = item;
                    }
                });
                updateHeaderNotification();
                if (isOpen) {
                    renderFavoritesPanel();
                }
            })
            .catch(function() {
            });
    }

    function init() {
        const favBtn = document.getElementById('favorites-btn');
        if (favBtn) {
            favBtn.setAttribute('aria-expanded', 'false');
            favBtn.addEventListener('click', function() {
                openFavoritesPanel(favBtn);
            });
        }

        document.addEventListener('driverhub:overlay-opened', function(event) {
            if (!isOpen) return;
            if (!event.detail || event.detail.id === 'favorites') return;
            closeFavoritesPanel(false);
        });

        document.addEventListener('driverhub:drivers-loaded', handleDriversLoadedEvent);

        updateFavoriteButtons();
        updateHeaderNotification();
        loadDeltaFeed();
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        add: addFavorite,
        remove: removeFavorite,
        toggle: toggleFavorite,
        isFavorite: isFavorite,
        getAll: getWatchlist,
        updateButtons: updateFavoriteButtons,
        openPanel: openFavoritesPanel,
        closePanel: closeFavoritesPanel
    };
})();
