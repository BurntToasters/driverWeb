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
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const version = btn.dataset.version;
            const category = btn.dataset.category;
            const isFav = isFavorite(version, category);
            btn.classList.toggle('favorited', isFav);
            btn.querySelector('.material-icons').textContent = isFav ? 'star' : 'star_border';
            btn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
        });
    }

    function showToast(message) {
        let toast = document.querySelector('.toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast-notification';
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    function renderFavoritesPanel() {
        const favorites = getFavorites();
        let panel = document.getElementById('favorites-panel');

        if (!panel) {
            panel = document.createElement('div');
            panel.id = 'favorites-panel';
            panel.className = 'favorites-panel';
            panel.innerHTML = `
                <div class="favorites-header">
                    <span class="material-icons">star</span>
                    <span>Favorites</span>
                    <button class="favorites-close"><span class="material-icons">close</span></button>
                </div>
                <div class="favorites-content"></div>
            `;
            document.body.appendChild(panel);

            panel.querySelector('.favorites-close').addEventListener('click', () => {
                panel.classList.remove('open');
            });
        }

        const content = panel.querySelector('.favorites-content');

        if (favorites.length === 0) {
            content.innerHTML = '<div class="favorites-empty"><span class="material-icons">star_border</span><p>No favorites yet</p><p class="sub">Click the star icon on any driver to add it here</p></div>';
        } else {
            content.innerHTML = favorites.map(fav => {
                const brandClass = fav.brand || 'nvidia';
                return `
                    <div class="favorites-item">
                        <div class="favorites-item-info">
                            <span class="favorites-brand ${brandClass}"></span>
                            <span class="favorites-version">${fav.version}</span>
                            ${fav.type ? `<span class="favorites-type">- ${fav.type}</span>` : ''}
                        </div>
                        <div class="favorites-item-actions">
                            ${fav.downloadUrl ? `<a href="${fav.downloadUrl}" target="_blank" class="favorites-download" title="Download"><span class="material-icons">download</span></a>` : ''}
                            <button class="favorites-remove" data-version="${fav.version}" data-category="${fav.category}" title="Remove"><span class="material-icons">delete</span></button>
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
        document.getElementById('favorites-panel').classList.add('open');
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
