/**
 * @param {string} jsonUrl 
 * @param {string} containerId
 */
function loadDrivers(jsonUrl, containerId) {
    console.log(`Loading drivers from: ${jsonUrl} into #${containerId}`);
    
    const userRegion = localStorage.getItem("userRegion") || "USA";
    
    fetch(jsonUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load ${jsonUrl}: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`Successfully loaded data from ${jsonUrl}`, data);
            const container = document.getElementById(containerId);
            if (!container) {
                console.error(`Container element with ID ${containerId} not found`);
                return;
            }
            
            container.innerHTML = '';
            
            if (data.warningMessage) {
                const warningDiv = document.createElement('div');
                warningDiv.className = 'warning-message';
                warningDiv.innerHTML = data.warningMessage;
                container.appendChild(warningDiv);
            }
            
            const driverList = document.createElement('div');
            driverList.className = 'driver-list';
                   
            data.drivers.forEach(driver => {
                const driverItem = document.createElement('div');
                driverItem.className = driver.hasWarning ? 'driver-item warning' : 'driver-item';
                
                
                const driverLink = document.createElement('a');
                if (driver.hasWarning && driver.warningUrl) {
                    driverLink.href = driver.warningUrl;
                    driverLink.className = 'amd-button';
                    driverLink.innerHTML = `⚠️ ${driver.version} - ${driver.type}`;
                } else if (driver.downloadUrl) {
                    
                    let downloadUrl = driver.downloadUrl;
                    if (containerId.includes('nvidia') && userRegion === "EU") {
                        downloadUrl = downloadUrl.replace("us.download.nvidia.com", "uk.download.nvidia.com");
                    }
                    
                    driverLink.href = downloadUrl;
                    driverLink.target = '_blank';
                    driverLink.className = containerId.includes('nvidia') ? 'nvidia-button' : 'intel-button';
                    driverLink.textContent = `${driver.version} ${driver.type ? '- ' + driver.type : ''}`;
                    
                    driverLink.dataset.originalUrl = driver.downloadUrl;
                } else {
                    //Fallback
                    driverLink.className = 'g-button';
                    driverLink.textContent = `${driver.version} ${driver.type ? '- ' + driver.type : ''} (No download link)`;
                }
                driverItem.appendChild(driverLink);
                
                //release
                const dateSpan = document.createElement('span');
                dateSpan.className = 'driver-date';
                dateSpan.textContent = `Released ${driver.releaseDate}`;
                driverItem.appendChild(dateSpan);
                
                if (driver.sha256sum) {
                    const hashContainer = document.createElement('div');
                    hashContainer.className = 'hash-container';
                    hashContainer.style.display = 'none';
                    hashContainer.innerHTML = `<span class="hash-label">SHA256:</span> <span class="hash-value">${driver.sha256sum}</span>`;
                    
                    const hashButton = document.createElement('button');
                    hashButton.className = 'hash-button';
                    hashButton.innerHTML = '<span class="material-icons">fingerprint</span>';
                    hashButton.title = 'Show SHA256 hash';
                    hashButton.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (hashContainer.style.display === 'none') {
                            hashContainer.style.display = 'block';
                            hashButton.title = 'Hide SHA256 hash';
                            hashButton.classList.add('active');
                        } else {
                            hashContainer.style.display = 'none';
                            hashButton.title = 'Show SHA256 hash';
                            hashButton.classList.remove('active');
                        }
                    };
                    
                    driverItem.appendChild(hashButton);
                    driverItem.appendChild(hashContainer);
                }
                
                const iconsContainer = document.createElement('div');
                iconsContainer.className = 'driver-icons-container';
                
                if (driver.redditUrl) {
                    const communityLink = document.createElement('a');
                    communityLink.href = driver.redditUrl;
                    communityLink.target = '_blank';
                    communityLink.className = 'community-link';
                    
                    const redditIcon = document.createElement('img');
                    redditIcon.src = 'https://prod.rexxit.net/drweb/assets/Reddit_Icon_2Color.svg';
                    redditIcon.title = 'See community discussion.';
                    redditIcon.alt = 'See discussion';
                    
                    communityLink.appendChild(redditIcon);
                    iconsContainer.appendChild(communityLink);
                }
                
                if (driver.isStable && driver.stabilityGrade) {
                    const gradeSpan = document.createElement('span');
                    gradeSpan.className = 'stability-grade';
                    gradeSpan.innerHTML = `<b>GRADE: </b><b style="color: forestgreen;">${driver.stabilityGrade}</b><b> | </b>`;
                    gradeSpan.title = "This driver is considered stable based on community feedback";
                    iconsContainer.appendChild(gradeSpan);
                }
                
                driverItem.appendChild(iconsContainer);
                driverList.appendChild(driverItem);
            });
            
            container.appendChild(driverList);
            
            const updateNote = document.createElement('div');
            updateNote.className = 'update-note';
            updateNote.textContent = `Drivers list updated: ${data.lastUpdated}`;
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