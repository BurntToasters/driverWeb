const FavoritesModule = (function() {
    const STORAGE_KEY = 'driverhub_favorites';

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
        const exists = favorites.find(f => f.version === driver.version && f.category === driver.category);
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
        favorites = favorites.filter(f => !(f.version === version && f.category === category));
        saveFavorites(favorites);
        updateFavoriteButtons();
        showToast('Removed from favorites');
    }

    function isFavorite(version, category) {
        const favorites = getFavorites();
        if (category) {
            return favorites.some(f => f.version === version && f.category === category);
        }
        return favorites.some(f => f.version === version);
    }

    function toggleFavorite(driver) {
        if (isFavorite(driver.version, driver.category)) {
            removeFavorite(driver.version, driver.category);
        } else {
            addFavorite(driver);
        }
    }

    function updateFavoriteButtons() {
        document.querySelectorAll('[data-version][data-category]').forEach(btn => {
            if (!btn.classList.contains('favorites-remove')) {
                const version = btn.dataset.version;
                const category = btn.dataset.category;
                const isFav = isFavorite(version, category);
                btn.className = isFav
                    ? 'p-1.5 rounded-lg text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30 transition-colors'
                    : 'p-1.5 rounded-lg text-gray-400 hover:text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors';
                const icon = btn.querySelector('.material-icons');
                if (icon) icon.textContent = isFav ? 'star' : 'star_border';
                btn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
            }
        });
    }

    function showToast(message) {
        let toast = document.querySelector('.toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl shadow-2xl font-medium z-[400] opacity-0 translate-y-4 transition-all duration-300 pointer-events-none';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.remove('opacity-0', 'translate-y-4');
        toast.classList.add('opacity-100', 'translate-y-0');
        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-4');
            toast.classList.remove('opacity-100', 'translate-y-0');
        }, 2000);
    }

    function renderFavoritesPanel() {
        const favorites = getFavorites();
        let panel = document.getElementById('favorites-panel');

        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'favorites-panel';
            panel.className = 'fixed inset-y-0 right-0 w-full max-w-sm bg-white dark:bg-gray-900 shadow-2xl z-[250] transform translate-x-full transition-transform duration-300';
            panel.innerHTML = `
                <div class="bg-gradient-to-r from-yellow-400 to-orange-500 p-5">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <span class="material-icons text-white text-2xl">star</span>
                            <span class="text-xl font-bold text-white">Favorites</span>
                        </div>
                        <button class="favorites-close p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition-colors">
                            <span class="material-icons">close</span>
                        </button>
                    </div>
                </div>
                <div class="favorites-content p-4 space-y-3 overflow-y-auto" style="max-height: calc(100vh - 88px);"></div>
            `;
            document.body.appendChild(panel);

            panel.querySelector('.favorites-close').addEventListener('click', () => {
                panel.classList.add('translate-x-full');
                panel.classList.remove('translate-x-0');
            });
        }

        const content = panel.querySelector('.favorites-content');

        if (favorites.length === 0) {
            content.innerHTML = `
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <span class="material-icons text-6xl text-gray-300 dark:text-gray-600 mb-4">star_border</span>
                    <p class="text-lg font-semibold text-gray-900 dark:text-white">No favorites yet</p>
                    <p class="text-sm text-gray-500 mt-1">Click the star icon on any driver to add it here</p>
                </div>
            `;
        } else {
            content.innerHTML = favorites.map(fav => {
                const brandColor = fav.brand === 'nvidia' ? 'bg-nvidia' : fav.brand === 'intel' ? 'bg-intel' : 'bg-amd';
                return `
                    <div class="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                        <span class="w-3 h-3 rounded-full ${brandColor}"></span>
                        <div class="flex-1 min-w-0">
                            <div class="font-semibold text-gray-900 dark:text-white truncate">${fav.version}</div>
                            ${fav.type ? `<div class="text-sm text-gray-500 truncate">${fav.type}</div>` : ''}
                        </div>
                        <div class="flex items-center gap-2">
                            ${fav.downloadUrl ? `<a href="${fav.downloadUrl}" target="_blank" class="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 hover:bg-primary-200 dark:hover:bg-primary-800/40 transition-colors" title="Download"><span class="material-icons text-lg">download</span></a>` : ''}
                            <button class="favorites-remove p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 hover:bg-red-200 dark:hover:bg-red-800/40 transition-colors" data-version="${fav.version}" data-category="${fav.category}" title="Remove">
                                <span class="material-icons text-lg">delete</span>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

            content.querySelectorAll('.favorites-remove').forEach(btn => {
                btn.addEventListener('click', () => {
                    removeFavorite(btn.dataset.version, btn.dataset.category);
                    renderFavoritesPanel();
                });
            });
        }
    }

    function openFavoritesPanel() {
        renderFavoritesPanel();
        const panel = document.getElementById('favorites-panel');
        panel.classList.remove('translate-x-full');
        panel.classList.add('translate-x-0');
    }

    function init() {
        const favBtn = document.getElementById('favorites-btn');
        if (favBtn) {
            favBtn.addEventListener('click', openFavoritesPanel);
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        add: addFavorite,
        remove: removeFavorite,
        toggle: toggleFavorite,
        isFavorite: isFavorite,
        getAll: getFavorites,
        updateButtons: updateFavoriteButtons,
        openPanel: openFavoritesPanel
    };
})();
