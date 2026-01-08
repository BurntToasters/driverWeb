const Navigation = (function() {
    const navItems = [
        { href: '/', label: 'Home', icon: 'home', class: 'download-button-h' },
        { href: '/display', label: 'Video Drivers', icon: 'videocam', class: 'nvidia-button' },
        { href: '/chipset', label: 'Chipset Drivers', icon: 'memory', class: 'chipset-button' },
        { href: '#', label: 'Network Drivers', icon: 'wifi', class: 'g-button', disabled: true },
        { href: '#', label: 'Audio Drivers', icon: 'headphones', class: 'g-button', disabled: true },
        { href: '/contact', label: 'Contact', icon: 'email', class: 'g-button' },
        {
            href: 'https://docs.rexxit.net/drivers-website/',
            label: 'Docs',
            icon: 'description',
            class: 'download-button',
            external: true
        }
    ];

    const externalIcon = `<svg width="14px" height="14px" viewBox="0 0 24 24"><g stroke-width="2.1" stroke="#ffffff" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 13.5 17 19.5 5 19.5 5 7.5 11 7.5"></polyline><path d="M14,4.5 L20,4.5 L20,10.5 M20,4.5 L11,13.5"></path></g></svg>`;

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
        const currentPage = getCurrentPage();

        return navItems.map(item => {
            const active = isActive(item.href);
            let className = item.class;
            let labelHTML = item.label;
            let attrs = '';

            if (item.disabled) {
                labelHTML = `<s>${item.label}</s>`;
                attrs = `title="Coming soon" aria-label="${item.label} (coming soon)"`;
            } else if (active) {
                className = item.class.replace('-button', '-button-h');
                if (!className.includes('-h')) className += '-h';
                labelHTML = `<u>${item.label}</u>`;
            }

            if (item.external) {
                attrs += ` target="_blank" rel="noopener noreferrer"`;
            }

            return `<a href="${item.href}" class="${className}" ${attrs}><span class="material-icons">${item.icon}</span> ${labelHTML}${item.external ? ' ' + externalIcon : ''}</a>`;
        }).join('\n            ');
    }

    function generateSettingsHTML() {
        return `
    <div id="settings-overlay" class="settings-overlay" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <div class="settings-content">
            <button class="close-settings" aria-label="Close settings">&times;</button>
            <h2 id="settings-title">Settings</h2>

            <label class="switch">
                <input type="checkbox" id="darkModeToggle">
                <span class="slider round"></span>
            </label>
            <span>Dark Mode</span>
            <hr>

            <label for="regionSelect">Select Region:</label>
            <select id="regionSelect" class="region-dropdown">
                <option value="USA">🇺🇸 USA</option>
                <option value="EU">🇪🇺 EU</option>
            </select>
            <a href="https://docs.rexxit.net/drivers-website/articles/region-selection">Learn more about region selection</a>
        </div>
    </div>`;
    }

    function generateFooterHTML() {
        return `
    <p><span id="site-version"></span>(<a href="https://docs.rexxit.net/drivers-website/releasenotes" target="_blank" rel="noopener noreferrer">Release notes</a>)
        <svg width="14px" height="14px" viewBox="0 0 24 24" style="cursor:pointer" aria-hidden="true">
            <g stroke-width="2.1" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6">
                <polyline points="17 13.5 17 19.5 5 19.5 5 7.5 11 7.5"></polyline>
                <path d="M14,4.5 L20,4.5 L20,10.5 M20,4.5 L11,13.5"></path>
            </g>
        </svg>
    </p>
    <p id="update-date"></p>
    <p><a href="https://www.buymeacoffee.com/burnttoasters" target="_blank" rel="noopener noreferrer">❤️ Support me :)</a> | <a href="/sitemap.xml">Sitemap</a></p>
    <br>
    <a href="https://www.digitalocean.com/?refcode=7bd0fa8e307c&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge" target="_blank" rel="noopener noreferrer">
        <img src="https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%201.svg" style="max-width: 120px;" alt="DigitalOcean Referral Badge" loading="lazy" />
    </a>`;
    }

    function init() {
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
        generateSettingsHTML,
        generateFooterHTML,
        getCurrentPage,
        navItems
    };
})();
