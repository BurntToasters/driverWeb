const Navigation = (function() {
    const navItems = [
        { href: '/', label: 'Home', icon: 'home' },
        { href: '/display', label: 'Graphics', icon: 'videocam' },
        { href: '/chipset', label: 'Chipset', icon: 'memory' },
        { href: '#', label: 'Network', icon: 'wifi', disabled: true },
        { href: '#', label: 'Audio', icon: 'headphones', disabled: true },
        { type: 'divider' },
        { href: '/contact', label: 'Contact', icon: 'mail_outline' },
        { href: 'https://docs.rexxit.net/drivers-website/', label: 'Docs', icon: 'description', external: true }
    ];

    const externalIcon = `<svg class="external-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;

    function getCurrentPage() {
        const path = window.location.pathname;
        if (path === '/' || path === '/index.html') return '/';
        if (path.includes('/display/laptop')) return '/display/laptop';
        if (path.includes('/display')) return '/display';
        if (path.includes('/chipset')) return '/chipset';
        if (path.includes('/contact')) return '/contact';
        if (path.includes('/network')) return '/network';
        if (path.includes('/audio')) return '/audio';
        return path;
    }

    function isActive(itemHref) {
        const current = getCurrentPage();
        if (itemHref === '/display' && (current === '/display' || current === '/display/laptop')) {
            return true;
        }
        return current === itemHref;
    }

    function generateNavHTML() {
        return navItems.map(item => {
            if (item.type === 'divider') {
                return '<span class="nav-divider"></span>';
            }

            const active = isActive(item.href);
            let classes = ['nav-link'];
            let attrs = '';

            if (item.disabled) {
                classes.push('disabled');
                attrs = `title="Coming soon" aria-disabled="true"`;
            }
            
            if (active) {
                classes.push('active');
            }

            if (item.external) {
                attrs += ` target="_blank" rel="noopener noreferrer"`;
            }

            return `<a href="${item.href}" class="${classes.join(' ')}" ${attrs}><span class="material-icons">${item.icon}</span>${item.label}${item.external ? externalIcon : ''}</a>`;
        }).join('');
    }

    function generateHeaderHTML() {
        return `
        <div class="header-top">
            <a href="/" class="logo-group">
                <img src="https://prod.rexxit.net/global/_icons/DH-logo-optim.webp" alt="DriverHub">
                <h1>DriverHub</h1>
            </a>
            <div class="header-actions">
                <button id="global-search-btn" class="action-btn" title="Search (Ctrl+K)">
                    <span class="material-icons">search</span>
                </button>
                <button id="favorites-btn" class="action-btn" title="Favorites">
                    <span class="material-icons">star_outline</span>
                </button>
            </div>
        </div>
        <nav class="nav-container" role="navigation" aria-label="Main navigation">
            ${generateNavHTML()}
        </nav>`;
    }

    function generateSettingsHTML() {
        return `
    <div id="settings-overlay" class="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="settings-content">
            <button class="close-settings" aria-label="Close settings">&times;</button>
            <h2 id="settings-title">Settings</h2>
            <div class="settings-row">
                <label class="switch">
                    <input type="checkbox" id="darkModeToggle">
                    <span class="slider round"></span>
                </label>
                <span>Dark Mode</span>
            </div>
            <hr>
            <label for="regionSelect">Download Region</label>
            <select id="regionSelect" class="region-dropdown">
                <option value="USA">🇺🇸 USA</option>
                <option value="EU">🇪🇺 EU</option>
            </select>
            <p class="info-text"><a href="https://docs.rexxit.net/drivers-website/articles/region-selection">Learn more about regions</a></p>
        </div>
    </div>`;
    }

    function generateFooterHTML() {
        return `
    <p><span id="site-version"></span> <a href="https://docs.rexxit.net/drivers-website/releasenotes" target="_blank" rel="noopener noreferrer">Release notes</a></p>
    <p id="update-date"></p>
    <p><a href="https://www.buymeacoffee.com/burnttoasters" target="_blank" rel="noopener noreferrer">❤️ Support</a> · <a href="/sitemap.xml">Sitemap</a></p>
    <a href="https://www.digitalocean.com/?refcode=7bd0fa8e307c&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge" target="_blank" rel="noopener noreferrer">
        <img src="https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%201.svg" style="max-width: 100px;" alt="DigitalOcean" loading="lazy">
    </a>`;
    }

    function init() {
        const headerContent = document.querySelector('.header-content');
        if (headerContent && headerContent.dataset.autoHeader === 'true') {
            headerContent.innerHTML = generateHeaderHTML();
        }

        const navContainer = document.querySelector('.nav-container');
        if (navContainer && navContainer.dataset.autoNav === 'true') {
            navContainer.innerHTML = generateNavHTML();
        }

        const settingsPlaceholder = document.getElementById('settings-placeholder');
        if (settingsPlaceholder) {
            settingsPlaceholder.outerHTML = generateSettingsHTML();
        }

        const footerPlaceholder = document.querySelector('footer[data-auto-footer="true"]');
        if (footerPlaceholder) {
            footerPlaceholder.innerHTML = generateFooterHTML();
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        generateNavHTML,
        generateHeaderHTML,
        generateSettingsHTML,
        generateFooterHTML,
        getCurrentPage,
        navItems
    };
})();
