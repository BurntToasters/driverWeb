const SHOW_DRIVER_WARNING_NOTICE = false;

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
    return 'Driver';
}

function getDriverBrand(containerId) {
    if (containerId.includes('nvidia')) return 'nvidia';
    if (containerId.includes('intel')) return 'intel';
    return 'intel';
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
    button.title = isFavorite ? 'Remove from favorites' : 'Add to favorites';
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

            if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
                return;
            }

            navigator.clipboard.writeText(driver.sha256sum).then(function() {
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
                brand: brand
            });

            const nowFav = FavoritesModule.isFavorite(driver.version, category);
            setFavoriteButtonState(favBtn, favIcon, nowFav);
        });

        iconsContainer.appendChild(favBtn);
    }

    return iconsContainer;
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
    } else {
        driverItem.classList.add('hover:border-intel/50', 'hover:shadow-intel/10');
    }

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

    return driverItem;
}

function loadDrivers(jsonUrl, containerId) {
    const userRegion = getStoredRegion();

    fetch(jsonUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load ${jsonUrl}: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = '';

            if (SHOW_DRIVER_WARNING_NOTICE && data.warningMessage) {
                container.appendChild(createWarningNotice(data.warningMessage));
            }

            const category = getDriverCategory(containerId);
            const brand = getDriverBrand(containerId);

            const driverList = document.createElement('div');
            driverList.className = 'space-y-3';

            data.drivers.forEach(driver => {
                const row = createDriverRow(driver, category, brand, containerId, userRegion);
                driverList.appendChild(row);
            });

            container.appendChild(driverList);

            const updateNote = document.createElement('div');
            updateNote.className = 'mt-4 text-sm text-gray-500 dark:text-gray-400 text-center';
            updateNote.textContent = `Last updated: ${data.lastUpdated}`;
            container.appendChild(updateNote);

            notifyContentUpdated();
        })
        .catch(() => {
            const container = document.getElementById(containerId);
            if (!container) return;

            container.innerHTML = '';
            const errorDiv = cloneTemplateElement('driver-error-template', 'div');
            if (!errorDiv.className) {
                errorDiv.className = 'p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200';
                const errorTitle = document.createElement('p');
                errorTitle.className = 'font-medium';
                errorTitle.textContent = 'Error loading driver data. Please try refreshing the page.';
                errorDiv.appendChild(errorTitle);
            }
            container.appendChild(errorDiv);
            notifyContentUpdated();
        });
}

function applyFilters(filterType) {
    document.querySelectorAll('[data-stable]').forEach(item => {
        if (filterType === 'all') {
            item.classList.remove('hidden');
        } else if (filterType === 'stable') {
            item.classList.toggle('hidden', item.dataset.stable !== 'true');
        } else if (filterType.startsWith('grade-')) {
            const grade = filterType.replace('grade-', '');
            item.classList.toggle('hidden', item.dataset.grade !== grade);
        }
    });

    notifyContentUpdated();
}
