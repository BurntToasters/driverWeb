const SHOW_DRIVER_WARNING_NOTICE = false;
const LOAD_TIMEOUT_MS = 15000;

const loadRegistry = {};
let activeFilter = 'all';
let activeQuery = '';
let activeBrand = '';

function getStoredRegion() {
    try {
        return localStorage.getItem('userRegion') || 'USA';
    } catch (e) {
        return 'USA';
    }
}

function getRegionalUrl(originalUrl, region) {
    if (region !== 'EU') return originalUrl;
    try {
        const url = new URL(originalUrl);
        if (url.hostname === 'us.download.nvidia.com') {
            url.hostname = 'uk.download.nvidia.com';
        }
        return url.toString();
    } catch (e) {
        return originalUrl.replace('us.download.nvidia.com', 'uk.download.nvidia.com');
    }
}

function cloneTemplateElement(templateId, fallbackTag) {
    const template = document.getElementById(templateId);
    if (template && template.tagName === 'TEMPLATE' && template.content.firstElementChild) {
        return template.content.firstElementChild.cloneNode(true);
    }
    return document.createElement(fallbackTag || 'div');
}

function getDriverCategory(containerId) {
    if (containerId.includes('nvidia')) {
        return containerId.includes('studio') ? 'NVIDIA Studio' : 'NVIDIA Game Ready';
    }
    if (containerId.includes('intel')) {
        return containerId.includes('pro') ? 'Intel Pro' : 'Intel Game On';
    }
    if (containerId.includes('amd')) {
        return 'AMD Driver';
    }
    return 'Driver';
}

function getDriverBrand(containerId) {
    if (containerId.includes('nvidia')) return 'nvidia';
    if (containerId.includes('intel')) return 'intel';
    if (containerId.includes('amd')) return 'amd';
    return 'intel';
}

function getSourceLabel(brand) {
    if (brand === 'nvidia') return 'NVIDIA';
    if (brand === 'amd') return 'AMD';
    return 'Intel';
}

function getDriverTitle(driver) {
    return `${driver.version}${driver.type ? ' - ' + driver.type : ''}`;
}

function notifyContentUpdated() {
    document.dispatchEvent(new CustomEvent('driverhub:content-updated'));
    if (window.DriverHubUI && typeof window.DriverHubUI.updateOpenCollapsibleHeights === 'function') {
        window.DriverHubUI.updateOpenCollapsibleHeights();
    }
}

function notifyDriversLoaded(category, brand, drivers) {
    document.dispatchEvent(new CustomEvent('driverhub:drivers-loaded', {
        detail: {
            category: category,
            brand: brand,
            drivers: Array.isArray(drivers) ? drivers : []
        }
    }));
}

function createWarningNotice(message) {
    const warningDiv = document.createElement('div');
    warningDiv.className = 'p-4 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-800 dark:text-amber-200 text-sm';
    warningDiv.innerHTML = message;

    warningDiv.querySelectorAll('a').forEach(function(link) {
        const href = link.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href)) {
            link.removeAttribute('href');
            return;
        }
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.style.textDecoration = 'underline';
    });

    return warningDiv;
}

function parseDateValue(value) {
    if (!value) return null;
    const directDate = new Date(value);
    if (!Number.isNaN(directDate.getTime())) return directDate;

    const slashMatch = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (slashMatch) {
        const month = Number(slashMatch[1]) - 1;
        const day = Number(slashMatch[2]);
        let year = Number(slashMatch[3]);
        if (year < 100) {
            year += 2000;
        }
        const parsed = new Date(year, month, day);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    return null;
}

function formatDaysAgo(dateValue) {
    const parsed = parseDateValue(dateValue);
    if (!parsed) return '';
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.max(0, Math.floor((now - parsed) / dayMs));
    if (diffDays === 0) return 'Updated today';
    if (diffDays === 1) return 'Updated 1 day ago';
    return `Updated ${diffDays} days ago`;
}

function copyToClipboard(text, onSuccess) {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') return;
    navigator.clipboard.writeText(text).then(function() {
        if (typeof onSuccess === 'function') {
            onSuccess();
        }
    });
}

function getRowDeepLink(driver, brand) {
    const page = driver.page || window.location.pathname;
    const params = new URLSearchParams();
    params.set('q', driver.version || '');
    if (brand) {
        params.set('brand', brand);
    }
    return `${page}?${params.toString()}`;
}

function createActionLink(label, href, iconName) {
    const actionLink = cloneTemplateElement('driver-action-link-template', 'a');
    actionLink.href = href;
    const icon = actionLink.querySelector('[data-action-icon]');
    const text = actionLink.querySelector('[data-action-label]');
    if (icon) icon.textContent = iconName || 'open_in_new';
    if (text) {
        text.textContent = label;
    } else {
        actionLink.textContent = label;
    }
    return actionLink;
}

function createActionButton(label, iconName, onClick) {
    const actionButton = cloneTemplateElement('driver-action-btn-template', 'button');
    const icon = actionButton.querySelector('[data-action-icon]');
    const text = actionButton.querySelector('[data-action-label]');
    if (icon) icon.textContent = iconName || 'content_copy';
    if (text) {
        text.textContent = label;
    } else {
        actionButton.textContent = label;
    }
    actionButton.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        if (typeof onClick === 'function') {
            onClick(actionButton);
        }
    });
    return actionButton;
}

function createDriverActions(driver, brand) {
    const actions = document.createElement('div');
    actions.className = 'w-full flex flex-wrap items-center gap-2';

    const deepLink = getRowDeepLink(driver, brand);
    const deepLinkButton = createActionButton('Copy deep link', 'share', function(button) {
        copyToClipboard(new URL(deepLink, window.location.origin).toString(), function() {
            const labelNode = button.querySelector('[data-action-label]');
            if (labelNode) {
                labelNode.textContent = 'Copied!';
                setTimeout(function() {
                    labelNode.textContent = 'Copy deep link';
                }, 1500);
            }
        });
    });
    deepLinkButton.title = 'Copy link with query parameters';
    actions.appendChild(deepLinkButton);

    if (driver.releaseNotesUrl) {
        actions.appendChild(createActionLink('Release notes', driver.releaseNotesUrl, 'notes'));
    }

    if (driver.knownIssuesUrl) {
        actions.appendChild(createActionLink('Known issues', driver.knownIssuesUrl, 'warning'));
    }

    if (driver.previousVersion) {
        const previousParams = new URLSearchParams();
        previousParams.set('q', driver.previousVersion);
        previousParams.set('brand', brand);
        const previousHref = `${driver.page || window.location.pathname}?${previousParams.toString()}`;
        actions.appendChild(createActionLink(`Previous stable: ${driver.previousVersion}`, previousHref, 'history'));
    }

    return actions;
}

function createDriverLink(driver, brand, containerId, userRegion) {
    if (driver.hasWarning && driver.warningUrl) {
        const warningLink = cloneTemplateElement('driver-warning-link-template', 'a');
        warningLink.href = driver.warningUrl;
        const label = warningLink.querySelector('[data-driver-label]');
        if (label) {
            label.textContent = getDriverTitle(driver);
        } else {
            warningLink.textContent = getDriverTitle(driver);
        }
        return warningLink;
    }

    if (driver.downloadUrl) {
        const downloadLink = cloneTemplateElement('driver-download-link-template', 'a');
        let downloadUrl = driver.downloadUrl;
        if (containerId.includes('nvidia')) {
            downloadUrl = getRegionalUrl(downloadUrl, userRegion);
        }

        downloadLink.href = downloadUrl;
        if (!downloadLink.className) {
            downloadLink.className = 'px-4 py-2 text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-md inline-flex items-center gap-2 transition-all duration-200';
        }

        if (brand === 'nvidia') {
            downloadLink.classList.add('bg-nvidia', 'hover:bg-nvidia-dark');
        } else if (brand === 'amd') {
            downloadLink.classList.add('bg-amd', 'hover:bg-amd-dark');
        } else {
            downloadLink.classList.add('bg-intel', 'hover:bg-intel-dark');
        }

        downloadLink.textContent = getDriverTitle(driver);
        downloadLink.dataset.originalUrl = driver.downloadUrl;
        return downloadLink;
    }

    const disabledLink = cloneTemplateElement('driver-disabled-link-template', 'span');
    if (!disabledLink.className) {
        disabledLink.className = 'px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed';
    }
    disabledLink.textContent = `${getDriverTitle(driver)} (No download link)`;
    return disabledLink;
}

function setFavoriteButtonState(button, icon, isFavorite) {
    button.className = isFavorite
        ? 'p-1.5 rounded-lg text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30 transition-colors'
        : 'p-1.5 rounded-lg text-gray-400 hover:text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors';
    icon.textContent = isFavorite ? 'star' : 'star_border';
    button.title = isFavorite ? 'Remove from watchlist' : 'Add to watchlist';
}

function createIcons(driver, category, brand) {
    const iconsContainer = cloneTemplateElement('driver-icons-template', 'div');
    if (!iconsContainer.className) {
        iconsContainer.className = 'flex items-center gap-2';
    }

    if (driver.isStable && driver.stabilityGrade) {
        const gradeSpan = cloneTemplateElement('driver-grade-template', 'span');
        if (!gradeSpan.className) {
            gradeSpan.className = 'px-2 py-0.5 text-xs font-bold rounded-md text-white';
        }
        const gradeColor = driver.stabilityGrade.startsWith('A') ? 'bg-emerald-500' :
            driver.stabilityGrade.startsWith('B') ? 'bg-amber-500' : 'bg-red-500';
        gradeSpan.classList.add(gradeColor);
        gradeSpan.textContent = driver.stabilityGrade;
        gradeSpan.title = 'Stable driver based on community feedback';
        iconsContainer.appendChild(gradeSpan);
    }

    if (driver.redditUrl) {
        const communityLink = cloneTemplateElement('driver-reddit-link-template', 'a');
        if (!communityLink.className) {
            communityLink.className = 'p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors';
        }
        communityLink.href = driver.redditUrl;
        communityLink.target = '_blank';
        communityLink.rel = 'noopener noreferrer';
        iconsContainer.appendChild(communityLink);
    }

    if (driver.sha256sum) {
        const copyHashBtn = cloneTemplateElement('driver-copy-btn-template', 'button');
        const normalClass = 'px-2 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-1';
        const copiedClass = 'px-2 py-1 text-xs font-medium rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1';

        function setCopyState(isCopied) {
            copyHashBtn.className = isCopied ? copiedClass : normalClass;
            const icon = copyHashBtn.querySelector('.material-icons');
            const label = copyHashBtn.querySelector('[data-copy-label]');
            if (icon) icon.textContent = isCopied ? 'check' : 'content_copy';
            if (label) label.textContent = isCopied ? 'Copied!' : 'SHA256';
        }

        setCopyState(false);
        copyHashBtn.title = 'Copy SHA256 hash';
        copyHashBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            copyToClipboard(driver.sha256sum, function() {
                setCopyState(true);
                setTimeout(function() {
                    setCopyState(false);
                }, 2000);
            });
        });

        iconsContainer.appendChild(copyHashBtn);
    }

    if (typeof FavoritesModule !== 'undefined') {
        const favBtn = cloneTemplateElement('driver-fav-btn-template', 'button');
        const favIcon = favBtn.querySelector('.material-icons') || document.createElement('span');
        if (!favIcon.classList.contains('material-icons')) {
            favIcon.className = 'material-icons text-lg';
            favBtn.appendChild(favIcon);
        }

        const isFav = FavoritesModule.isFavorite(driver.version, category);
        setFavoriteButtonState(favBtn, favIcon, isFav);

        favBtn.dataset.version = driver.version;
        favBtn.dataset.category = category;

        favBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();

            FavoritesModule.toggle({
                version: driver.version,
                type: driver.type,
                category: category,
                downloadUrl: driver.downloadUrl,
                brand: brand,
                page: driver.page || window.location.pathname
            });

            const nowFav = FavoritesModule.isFavorite(driver.version, category);
            setFavoriteButtonState(favBtn, favIcon, nowFav);
        });

        iconsContainer.appendChild(favBtn);
    }

    return iconsContainer;
}

function createTrustChip(text, iconName) {
    const chip = document.createElement('span');
    chip.className = 'trust-chip';
    const icon = document.createElement('span');
    icon.className = 'material-icons text-[14px]';
    icon.textContent = iconName;
    chip.appendChild(icon);
    chip.appendChild(document.createTextNode(text));
    return chip;
}

function createDriverRow(driver, category, brand, containerId, userRegion) {
    const rowTemplate = driver.hasWarning ? 'driver-item-warning-template' : 'driver-item-template';
    const driverItem = cloneTemplateElement(rowTemplate, 'div');

    if (!driverItem.className) {
        driverItem.className = driver.hasWarning
            ? 'flex flex-wrap items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800 transition-all duration-200'
            : 'flex flex-wrap items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 transition-all duration-200';
    }

    if (brand === 'nvidia') {
        driverItem.classList.add('hover:border-nvidia/50', 'hover:shadow-nvidia/10');
    } else if (brand === 'amd') {
        driverItem.classList.add('hover:border-amd/50', 'hover:shadow-amd/10');
    } else {
        driverItem.classList.add('hover:border-intel/50', 'hover:shadow-intel/10');
    }

    driverItem.classList.add('driver-row');
    driverItem.dataset.brand = brand;
    driverItem.dataset.category = category;
    driverItem.dataset.search = `${driver.version || ''} ${driver.type || ''} ${driver.releaseDate || ''} ${category}`.toLowerCase();

    if (driver.isStable && driver.stabilityGrade) {
        driverItem.dataset.stable = 'true';
        driverItem.dataset.grade = driver.stabilityGrade;
    }

    const driverLink = createDriverLink(driver, brand, containerId, userRegion);
    driverItem.appendChild(driverLink);

    const dateSpan = cloneTemplateElement('driver-date-template', 'span');
    if (!dateSpan.className) {
        dateSpan.className = 'text-sm text-gray-500 dark:text-gray-400 ml-auto';
    }
    dateSpan.textContent = driver.releaseDate ? `Released ${driver.releaseDate}` : '';
    driverItem.appendChild(dateSpan);

    const iconsContainer = createIcons(driver, category, brand);
    driverItem.appendChild(iconsContainer);

    const actions = createDriverActions({
        version: driver.version,
        releaseNotesUrl: driver.releaseNotesUrl,
        knownIssuesUrl: driver.knownIssuesUrl,
        previousVersion: driver.previousVersion,
        page: driver.page
    }, brand);
    driverItem.appendChild(actions);

    return driverItem;
}

function renderLoadingState(container) {
    if (!container) return;
    container.innerHTML = '';
    const loading = cloneTemplateElement('driver-loading-template', 'div');
    if (!loading.className) {
        loading.className = 'space-y-3';
    }
    container.appendChild(loading);
}

function fetchJsonWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(function() {
        controller.abort();
    }, timeoutMs);

    return fetch(url, { signal: controller.signal })
        .then(function(response) {
            if (!response.ok) {
                throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .finally(function() {
            clearTimeout(timeout);
        });
}

function normalizeFilter(filterType) {
    if (!filterType || filterType === 'all') return 'all';
    if (filterType === 'stable') return 'stable';
    if (filterType === 'grade-A+' || filterType === 'grade-A' || filterType === 'grade-A-') return filterType;
    return 'all';
}

function normalizeBrand(brand) {
    const normalized = (brand || '').toLowerCase();
    if (normalized === 'nvidia' || normalized === 'intel' || normalized === 'amd') return normalized;
    return '';
}

function matchesFilter(row) {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'stable') {
        return row.dataset.stable === 'true';
    }
    if (activeFilter.startsWith('grade-')) {
        return row.dataset.grade === activeFilter.replace('grade-', '');
    }
    return true;
}

function matchesQuery(row) {
    if (!activeQuery) return true;
    return (row.dataset.search || '').includes(activeQuery);
}

function matchesBrand(row) {
    if (!activeBrand) return true;
    return (row.dataset.brand || '') === activeBrand;
}

function applyRowVisibility() {
    document.querySelectorAll('.driver-row').forEach(function(row) {
        const visible = matchesFilter(row) && matchesQuery(row) && matchesBrand(row);
        row.classList.toggle('hidden', !visible);
        row.classList.toggle('ring-1', visible && Boolean(activeQuery));
        row.classList.toggle('ring-primary-400/50', visible && Boolean(activeQuery));
    });

    document.querySelectorAll('[data-brand-section]').forEach(function(section) {
        if (!activeBrand) {
            section.classList.remove('hidden');
            return;
        }
        section.classList.toggle('hidden', section.dataset.brandSection !== activeBrand);
    });
}

function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    activeFilter = normalizeFilter(params.get('filter'));
    activeQuery = (params.get('q') || '').trim().toLowerCase();
    activeBrand = normalizeBrand(params.get('brand'));
}

function writeStateToUrl() {
    const params = new URLSearchParams(window.location.search);
    if (activeFilter && activeFilter !== 'all') {
        params.set('filter', activeFilter);
    } else {
        params.delete('filter');
    }

    if (activeQuery) {
        params.set('q', activeQuery);
    } else {
        params.delete('q');
    }

    if (activeBrand) {
        params.set('brand', activeBrand);
    } else {
        params.delete('brand');
    }

    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', next);
}

function setFilterState(filterType, options) {
    const settings = options || {};
    activeFilter = normalizeFilter(filterType);
    applyRowVisibility();
    if (!settings.skipUrlUpdate) {
        writeStateToUrl();
    }
    notifyContentUpdated();
}

function setQueryState(query, options) {
    const settings = options || {};
    activeQuery = (query || '').trim().toLowerCase();
    applyRowVisibility();
    if (!settings.skipUrlUpdate) {
        writeStateToUrl();
    }
    notifyContentUpdated();
}

function setBrandState(brand, options) {
    const settings = options || {};
    activeBrand = normalizeBrand(brand);
    applyRowVisibility();
    if (!settings.skipUrlUpdate) {
        writeStateToUrl();
    }
    notifyContentUpdated();
}

function createUpdateMetaRow(data, brand) {
    const metaRow = document.createElement('div');
    metaRow.className = 'mt-4 flex flex-wrap items-center justify-center gap-2';

    const sourceLabel = getSourceLabel(brand);
    metaRow.appendChild(createTrustChip(`Source: ${sourceLabel}`, 'verified'));

    if (Array.isArray(data.drivers) && data.drivers.some(function(driver) {
        return Boolean(driver.sha256sum);
    })) {
        metaRow.appendChild(createTrustChip('SHA256 available', 'security'));
    }

    const freshnessText = formatDaysAgo(data.lastUpdated);
    if (freshnessText) {
        metaRow.appendChild(createTrustChip(freshnessText, 'schedule'));
    } else if (data.lastUpdated) {
        metaRow.appendChild(createTrustChip(`Last updated: ${data.lastUpdated}`, 'schedule'));
    }

    return metaRow;
}

function loadDrivers(jsonUrl, containerId) {
    const userRegion = getStoredRegion();
    const container = document.getElementById(containerId);
    if (!container) return;

    loadRegistry[containerId] = { jsonUrl: jsonUrl, containerId: containerId };
    renderLoadingState(container);

    fetchJsonWithTimeout(jsonUrl, LOAD_TIMEOUT_MS)
        .then(function(data) {
            container.innerHTML = '';

            if (SHOW_DRIVER_WARNING_NOTICE && data.warningMessage) {
                container.appendChild(createWarningNotice(data.warningMessage));
            }

            const category = getDriverCategory(containerId);
            const brand = getDriverBrand(containerId);
            const drivers = Array.isArray(data.drivers) ? data.drivers : [];

            const driverList = document.createElement('div');
            driverList.className = 'space-y-3';

            drivers.forEach(function(driver) {
                const row = createDriverRow(driver, category, brand, containerId, userRegion);
                driverList.appendChild(row);
            });

            container.appendChild(driverList);
            container.appendChild(createUpdateMetaRow(data, brand));

            notifyDriversLoaded(category, brand, drivers);
            applyRowVisibility();
            notifyContentUpdated();
        })
        .catch(function() {
            container.innerHTML = '';
            const errorDiv = cloneTemplateElement('driver-error-template', 'div');
            if (!errorDiv.className) {
                errorDiv.className = 'p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200';
                const errorTitle = document.createElement('p');
                errorTitle.className = 'font-medium';
                errorTitle.textContent = 'Error loading driver data. Please try refreshing the page.';
                errorDiv.appendChild(errorTitle);
            }

            const retryButton = errorDiv.querySelector('[data-driver-retry]');
            if (retryButton) {
                retryButton.addEventListener('click', function() {
                    loadDrivers(jsonUrl, containerId);
                });
            }

            container.appendChild(errorDiv);
            notifyContentUpdated();
        });
}

function applyFilters(filterType) {
    setFilterState(filterType);
}

function initDriverState() {
    readStateFromUrl();
}

initDriverState();

window.DriverHubDrivers = {
    applyFilters: setFilterState,
    setQuery: setQueryState,
    setBrand: setBrandState,
    getState: function() {
        return {
            filter: activeFilter,
            q: activeQuery,
            brand: activeBrand
        };
    },
    syncFromUrl: function() {
        readStateFromUrl();
        applyRowVisibility();
    }
};
