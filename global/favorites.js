const FavoritesModule = (function() {
    const STORAGE_KEY = 'driverhub_favorites';
    let panel = null;
    let backdrop = null;
    let isOpen = false;
    let lastTrigger = null;

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

    function getFavorites() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
        } catch {
            return [];
        }
    }

    function saveFavorites(favorites) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    }

    function addFavorite(driver) {
        const favorites = getFavorites();
        const exists = favorites.find(function(f) {
            return f.version === driver.version && f.category === driver.category;
        });

        if (!exists) {
            favorites.unshift({
                version: driver.version,
                type: driver.type,
                category: driver.category,
                downloadUrl: driver.downloadUrl,
                brand: driver.brand,
                addedAt: Date.now()
            });
            saveFavorites(favorites);
        }

        updateFavoriteButtons();
        showToast('Added to favorites');
    }

    function removeFavorite(version, category) {
        let favorites = getFavorites();
        favorites = favorites.filter(function(f) {
            return !(f.version === version && f.category === category);
        });
        saveFavorites(favorites);
        updateFavoriteButtons();
        showToast('Removed from favorites');
    }

    function isFavorite(version, category) {
        const favorites = getFavorites();
        if (category) {
            return favorites.some(function(f) {
                return f.version === version && f.category === category;
            });
        }
        return favorites.some(function(f) {
            return f.version === version;
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
                btn.title = favorite ? 'Remove from favorites' : 'Add to favorites';
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

    function closeFavoritesPanel(restoreFocus) {
        if (!panel || !backdrop || !isOpen) return;

        isOpen = false;

        backdrop.classList.add('opacity-0', 'pointer-events-none');
        backdrop.classList.remove('opacity-100', 'pointer-events-auto');

        panel.classList.add('translate-x-full');
        panel.classList.remove('translate-x-0');
        panel.setAttribute('aria-hidden', 'true');

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
        panel.className = 'fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl z-[250] transform translate-x-full transition-transform duration-300';
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
        title.textContent = 'Favorites';
        leftHeader.appendChild(title);

        headerFlex.appendChild(leftHeader);

        const closeBtn = document.createElement('button');
        closeBtn.className = 'favorites-close p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close favorites');
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

        const favorites = getFavorites();
        const content = panel.querySelector('.favorites-content');
        content.textContent = '';

        if (!favorites.length) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'flex flex-col items-center justify-center py-12 text-center';

            const emptyIcon = document.createElement('span');
            emptyIcon.className = 'material-icons text-6xl text-gray-300 dark:text-gray-600 mb-4';
            emptyIcon.textContent = 'star_border';
            emptyDiv.appendChild(emptyIcon);

            const emptyTitle = document.createElement('p');
            emptyTitle.className = 'text-lg font-semibold text-gray-900 dark:text-white';
            emptyTitle.textContent = 'No favorites yet';
            emptyDiv.appendChild(emptyTitle);

            const emptyText = document.createElement('p');
            emptyText.className = 'text-sm text-gray-500 mt-1';
            emptyText.textContent = 'Click the star icon on any driver to add it here';
            emptyDiv.appendChild(emptyText);

            content.appendChild(emptyDiv);
            return;
        }

        favorites.forEach(function(fav) {
            const brandColor = fav.brand === 'nvidia' ? 'bg-nvidia' : fav.brand === 'intel' ? 'bg-intel' : 'bg-amd';

            const favItem = document.createElement('div');
            favItem.className = 'flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700';

            const brandDot = document.createElement('span');
            brandDot.className = `w-3 h-3 rounded-full ${brandColor}`;
            favItem.appendChild(brandDot);

            const infoDiv = document.createElement('div');
            infoDiv.className = 'flex-1 min-w-0';

            const versionDiv = document.createElement('div');
            versionDiv.className = 'font-semibold text-gray-900 dark:text-white truncate';
            versionDiv.textContent = fav.version;
            infoDiv.appendChild(versionDiv);

            if (fav.type) {
                const typeDiv = document.createElement('div');
                typeDiv.className = 'text-sm text-gray-500 truncate';
                typeDiv.textContent = fav.type;
                infoDiv.appendChild(typeDiv);
            }

            favItem.appendChild(infoDiv);

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'flex items-center gap-2';

            if (fav.downloadUrl) {
                const downloadLink = document.createElement('a');
                downloadLink.href = fav.downloadUrl;
                downloadLink.target = '_blank';
                downloadLink.rel = 'noopener noreferrer';
                downloadLink.className = 'p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 hover:bg-primary-200 dark:hover:bg-primary-800/40 transition-colors';
                downloadLink.title = 'Download';
                const downloadIcon = document.createElement('span');
                downloadIcon.className = 'material-icons text-lg';
                downloadIcon.textContent = 'download';
                downloadLink.appendChild(downloadIcon);
                actionsDiv.appendChild(downloadLink);
            }

            const removeBtn = document.createElement('button');
            removeBtn.className = 'favorites-remove p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors';
            removeBtn.type = 'button';
            removeBtn.dataset.version = fav.version;
            removeBtn.dataset.category = fav.category;
            removeBtn.title = 'Remove';
            const removeIcon = document.createElement('span');
            removeIcon.className = 'material-icons text-lg';
            removeIcon.textContent = 'delete';
            removeBtn.appendChild(removeIcon);
            removeBtn.addEventListener('click', function() {
                removeFavorite(fav.version, fav.category);
                renderFavoritesPanel();
            });
            actionsDiv.appendChild(removeBtn);

            favItem.appendChild(actionsDiv);
            content.appendChild(favItem);
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
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        add: addFavorite,
        remove: removeFavorite,
        toggle: toggleFavorite,
        isFavorite: isFavorite,
        getAll: getFavorites,
        updateButtons: updateFavoriteButtons,
        openPanel: openFavoritesPanel,
        closePanel: closeFavoritesPanel
    };
})();
