function getStoredRegion() {
    try {
        return localStorage.getItem("userRegion") || "USA";
    } catch (e) {
        return "USA";
    }
}

function getRegionalUrl(originalUrl, region) {
    if (region !== "EU") return originalUrl;
    try {
        const url = new URL(originalUrl);
        if (url.hostname === "us.download.nvidia.com") {
            url.hostname = "uk.download.nvidia.com";
        }
        return url.toString();
    } catch (e) {
        return originalUrl.replace("us.download.nvidia.com", "uk.download.nvidia.com");
    }
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

            if (data.warningMessage) {
                const warningDiv = document.createElement('div');
                warningDiv.className = 'p-4 mb-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-800 dark:text-amber-200 text-sm';
                warningDiv.innerHTML = data.warningMessage;
                container.appendChild(warningDiv);
            }

            const category = containerId.includes('nvidia') ? (containerId.includes('studio') ? 'NVIDIA Studio' : 'NVIDIA Game Ready') :
                            (containerId.includes('intel') ? (containerId.includes('pro') ? 'Intel Pro' : 'Intel Game On') : 'Driver');
            const brand = containerId.includes('nvidia') ? 'nvidia' : 'intel';

            const driverList = document.createElement('div');
            driverList.className = 'space-y-3';

            data.drivers.forEach(driver => {
                const driverItem = document.createElement('div');
                driverItem.className = driver.hasWarning
                    ? 'flex flex-wrap items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 transition-all duration-200'
                    : 'flex flex-wrap items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200';

                if (brand === 'nvidia') {
                    driverItem.className += ' hover:border-nvidia/50 hover:shadow-nvidia/10';
                } else {
                    driverItem.className += ' hover:border-intel/50 hover:shadow-intel/10';
                }

                if (driver.isStable && driver.stabilityGrade) {
                    driverItem.dataset.stable = 'true';
                    driverItem.dataset.grade = driver.stabilityGrade;
                }

                const driverLink = document.createElement('a');
                if (driver.hasWarning && driver.warningUrl) {
                    driverLink.href = driver.warningUrl;
                    driverLink.className = 'px-4 py-2 bg-gradient-to-r from-amd to-amd-light text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-glow-amd/50 inline-flex items-center gap-2 transition-all duration-200';
                    driverLink.innerHTML = `<span class="material-icons text-base">warning</span> ${driver.version} - ${driver.type}`;
                } else if (driver.downloadUrl) {
                    let downloadUrl = driver.downloadUrl;
                    if (containerId.includes('nvidia')) {
                        downloadUrl = getRegionalUrl(downloadUrl, userRegion);
                    }

                    driverLink.href = downloadUrl;
                    driverLink.target = '_blank';
                    if (containerId.includes('nvidia')) {
                        driverLink.className = 'px-4 py-2 bg-gradient-to-r from-nvidia to-nvidia-light text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-glow-nvidia/50 hover:-translate-y-0.5 inline-flex items-center gap-2 transition-all duration-200';
                    } else {
                        driverLink.className = 'px-4 py-2 bg-gradient-to-r from-intel to-intel-light text-white text-sm font-medium rounded-lg shadow-sm hover:shadow-glow-intel/50 hover:-translate-y-0.5 inline-flex items-center gap-2 transition-all duration-200';
                    }
                    driverLink.textContent = `${driver.version} ${driver.type ? '- ' + driver.type : ''}`;
                    driverLink.dataset.originalUrl = driver.downloadUrl;
                } else {
                    driverLink.className = 'px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-sm font-medium rounded-lg cursor-not-allowed';
                    driverLink.textContent = `${driver.version} ${driver.type ? '- ' + driver.type : ''} (No download link)`;
                }
                driverItem.appendChild(driverLink);

                const dateSpan = document.createElement('span');
                dateSpan.className = 'text-sm text-gray-500 dark:text-gray-400 ml-auto';
                dateSpan.textContent = `Released ${driver.releaseDate}`;
                driverItem.appendChild(dateSpan);

                const iconsContainer = document.createElement('div');
                iconsContainer.className = 'flex items-center gap-2';

                if (driver.isStable && driver.stabilityGrade) {
                    const gradeSpan = document.createElement('span');
                    const gradeColor = driver.stabilityGrade.startsWith('A') ? 'bg-emerald-500' :
                                       driver.stabilityGrade.startsWith('B') ? 'bg-amber-500' : 'bg-red-500';
                    gradeSpan.className = `px-2 py-0.5 text-xs font-bold rounded-md ${gradeColor} text-white`;
                    gradeSpan.innerHTML = `${driver.stabilityGrade}`;
                    gradeSpan.title = "Stable driver based on community feedback";
                    iconsContainer.appendChild(gradeSpan);
                }

                if (driver.redditUrl) {
                    const communityLink = document.createElement('a');
                    communityLink.href = driver.redditUrl;
                    communityLink.target = '_blank';
                    communityLink.className = 'p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors';
                    communityLink.title = 'See community discussion';

                    const redditIcon = document.createElement('img');
                    redditIcon.src = 'https://prod.rexxit.net/drweb/assets/Reddit_Icon_2Color.svg';
                    redditIcon.alt = 'Reddit';
                    redditIcon.className = 'w-5 h-5';

                    communityLink.appendChild(redditIcon);
                    iconsContainer.appendChild(communityLink);
                }

                if (driver.sha256sum) {
                    const copyHashBtn = document.createElement('button');
                    copyHashBtn.className = 'px-2 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-1';
                    copyHashBtn.innerHTML = '<span class="material-icons text-sm">content_copy</span> SHA256';
                    copyHashBtn.title = 'Copy SHA256 hash';
                    copyHashBtn.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        navigator.clipboard.writeText(driver.sha256sum).then(() => {
                            copyHashBtn.className = 'px-2 py-1 text-xs font-medium rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1';
                            copyHashBtn.innerHTML = '<span class="material-icons text-sm">check</span> Copied!';
                            setTimeout(() => {
                                copyHashBtn.className = 'px-2 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-400 transition-colors inline-flex items-center gap-1';
                                copyHashBtn.innerHTML = '<span class="material-icons text-sm">content_copy</span> SHA256';
                            }, 2000);
                        });
                    };
                    iconsContainer.appendChild(copyHashBtn);
                }

                if (typeof FavoritesModule !== 'undefined') {
                    const favBtn = document.createElement('button');
                    const isFav = FavoritesModule.isFavorite(driver.version, category);
                    favBtn.className = isFav
                        ? 'p-1.5 rounded-lg text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30 transition-colors'
                        : 'p-1.5 rounded-lg text-gray-400 hover:text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors';
                    favBtn.innerHTML = `<span class="material-icons text-lg">${isFav ? 'star' : 'star_border'}</span>`;
                    favBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
                    favBtn.dataset.version = driver.version;
                    favBtn.dataset.category = category;
                    favBtn.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        FavoritesModule.toggle({
                            version: driver.version,
                            type: driver.type,
                            category: category,
                            downloadUrl: driver.downloadUrl,
                            brand: brand
                        });
                        const nowFav = FavoritesModule.isFavorite(driver.version, category);
                        favBtn.className = nowFav
                            ? 'p-1.5 rounded-lg text-yellow-500 bg-yellow-100 dark:bg-yellow-900/30 transition-colors'
                            : 'p-1.5 rounded-lg text-gray-400 hover:text-yellow-500 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors';
                        favBtn.innerHTML = `<span class="material-icons text-lg">${nowFav ? 'star' : 'star_border'}</span>`;
                        favBtn.title = nowFav ? 'Remove from favorites' : 'Add to favorites';
                    };
                    iconsContainer.appendChild(favBtn);
                }

                driverItem.appendChild(iconsContainer);
                driverList.appendChild(driverItem);
            });

            container.appendChild(driverList);

            const updateNote = document.createElement('div');
            updateNote.className = 'mt-4 text-sm text-gray-500 dark:text-gray-400 text-center';
            updateNote.textContent = `Last updated: ${data.lastUpdated}`;
            container.appendChild(updateNote);
        })
        .catch(error => {
            console.error(`Error loading driver data from ${jsonUrl}:`, error);
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `
                    <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-800 dark:text-red-200">
                        <p class="font-medium">Error loading driver data. Please try refreshing the page.</p>
                        <p class="text-sm mt-1 opacity-75">Technical details: ${error.message}</p>
                    </div>
                `;
            }
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
}
