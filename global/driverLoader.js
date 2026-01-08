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
                warningDiv.className = 'warning-message';
                warningDiv.innerHTML = data.warningMessage;
                container.appendChild(warningDiv);
            }

            const category = containerId.includes('nvidia') ? (containerId.includes('studio') ? 'NVIDIA Studio' : 'NVIDIA Game Ready') :
                            (containerId.includes('intel') ? (containerId.includes('pro') ? 'Intel Pro' : 'Intel Game On') : 'Driver');
            const brand = containerId.includes('nvidia') ? 'nvidia' : 'intel';

            const driverList = document.createElement('div');
            driverList.className = 'driver-list';

            data.drivers.forEach(driver => {
                const driverItem = document.createElement('div');
                driverItem.className = driver.hasWarning ? 'driver-item warning' : 'driver-item';

                if (driver.isStable && driver.stabilityGrade) {
                    driverItem.dataset.stable = 'true';
                    driverItem.dataset.grade = driver.stabilityGrade;
                }

                const driverLink = document.createElement('a');
                if (driver.hasWarning && driver.warningUrl) {
                    driverLink.href = driver.warningUrl;
                    driverLink.className = 'amd-button';
                    driverLink.innerHTML = `<span class="material-icons" style="font-size:1rem">warning</span> ${driver.version} - ${driver.type}`;
                } else if (driver.downloadUrl) {
                    let downloadUrl = driver.downloadUrl;
                    if (containerId.includes('nvidia')) {
                        downloadUrl = getRegionalUrl(downloadUrl, userRegion);
                    }

                    driverLink.href = downloadUrl;
                    driverLink.target = '_blank';
                    driverLink.className = containerId.includes('nvidia') ? 'nvidia-button' : 'intel-button';
                    driverLink.textContent = `${driver.version} ${driver.type ? '- ' + driver.type : ''}`;
                    driverLink.dataset.originalUrl = driver.downloadUrl;
                } else {
                    driverLink.className = 'g-button';
                    driverLink.textContent = `${driver.version} ${driver.type ? '- ' + driver.type : ''} (No download link)`;
                }
                driverItem.appendChild(driverLink);

                const dateSpan = document.createElement('span');
                dateSpan.className = 'driver-date';
                dateSpan.textContent = `Released ${driver.releaseDate}`;
                driverItem.appendChild(dateSpan);

                const iconsContainer = document.createElement('div');
                iconsContainer.className = 'driver-icons-container';

                if (driver.isStable && driver.stabilityGrade) {
                    const gradeSpan = document.createElement('span');
                    gradeSpan.className = 'stability-grade';
                    gradeSpan.innerHTML = `${driver.stabilityGrade}`;
                    gradeSpan.title = "Stable driver based on community feedback";
                    iconsContainer.appendChild(gradeSpan);
                }

                if (driver.redditUrl) {
                    const communityLink = document.createElement('a');
                    communityLink.href = driver.redditUrl;
                    communityLink.target = '_blank';
                    communityLink.className = 'community-link';
                    communityLink.title = 'See community discussion';

                    const redditIcon = document.createElement('img');
                    redditIcon.src = 'https://prod.rexxit.net/drweb/assets/Reddit_Icon_2Color.svg';
                    redditIcon.alt = 'Reddit';

                    communityLink.appendChild(redditIcon);
                    iconsContainer.appendChild(communityLink);
                }

                if (driver.sha256sum) {
                    const copyHashBtn = document.createElement('button');
                    copyHashBtn.className = 'copy-hash-btn';
                    copyHashBtn.innerHTML = '<span class="material-icons">content_copy</span> SHA256';
                    copyHashBtn.title = 'Copy SHA256 hash';
                    copyHashBtn.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        navigator.clipboard.writeText(driver.sha256sum).then(() => {
                            copyHashBtn.classList.add('copied');
                            copyHashBtn.innerHTML = '<span class="material-icons">check</span> Copied!';
                            setTimeout(() => {
                                copyHashBtn.classList.remove('copied');
                                copyHashBtn.innerHTML = '<span class="material-icons">content_copy</span> SHA256';
                            }, 2000);
                        });
                    };
                    iconsContainer.appendChild(copyHashBtn);
                }

                if (typeof FavoritesModule !== 'undefined') {
                    const favBtn = document.createElement('button');
                    const isFav = FavoritesModule.isFavorite(driver.version, category);
                    favBtn.className = 'favorite-btn' + (isFav ? ' favorited' : '');
                    favBtn.innerHTML = `<span class="material-icons">${isFav ? 'star' : 'star_border'}</span>`;
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
                        favBtn.classList.toggle('favorited', nowFav);
                        favBtn.innerHTML = `<span class="material-icons">${nowFav ? 'star' : 'star_border'}</span>`;
                        favBtn.title = nowFav ? 'Remove from favorites' : 'Add to favorites';
                    };
                    iconsContainer.appendChild(favBtn);
                }

                driverItem.appendChild(iconsContainer);
                driverList.appendChild(driverItem);
            });

            container.appendChild(driverList);

            const updateNote = document.createElement('div');
            updateNote.className = 'update-note';
            updateNote.textContent = `Last updated: ${data.lastUpdated}`;
            container.appendChild(updateNote);
        })
        .catch(error => {
            console.error(`Error loading driver data from ${jsonUrl}:`, error);
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `
                    <div class="error-message">
                        <p>Error loading driver data. Please try refreshing the page.</p>
                        <p>Technical details: ${error.message}</p>
                    </div>
                `;
            }
        });
}

function applyFilters(filterType) {
    document.querySelectorAll('.driver-item').forEach(item => {
        if (filterType === 'all') {
            item.classList.remove('filtered-out');
        } else if (filterType === 'stable') {
            item.classList.toggle('filtered-out', item.dataset.stable !== 'true');
        } else if (filterType.startsWith('grade-')) {
            const grade = filterType.replace('grade-', '');
            item.classList.toggle('filtered-out', item.dataset.grade !== grade);
        }
    });
}