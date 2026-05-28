document.addEventListener('DOMContentLoaded', () => {
    const darkModeToggle = document.getElementById('darkModeToggle');

    function getStoredDarkMode() {
        try {
            return localStorage.getItem('darkMode');
        } catch (e) {
            return null;
        }
    }

    function setStoredDarkMode(value) {
        try {
            localStorage.setItem('darkMode', value);
        } catch (e) {
        }
    }

    function updateToggleIcon(isDark) {
        if (!darkModeToggle) return;
        const icon = darkModeToggle.querySelector('.material-icons');
        if (!icon) return;
        icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    }

    function notifyModeChange(isDark) {
        document.dispatchEvent(new CustomEvent('driverhub:dark-mode-changed', {
            detail: { isDark }
        }));
    }

    function applyDarkMode(isDark) {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        updateToggleIcon(isDark);
        notifyModeChange(isDark);
    }

    const userPreference = getStoredDarkMode();
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = userPreference === 'dark' || (userPreference === null && prefersDarkScheme);

    applyDarkMode(isDarkMode);

    if (darkModeToggle) {
        darkModeToggle.addEventListener('click', () => {
            const currentlyDark = document.documentElement.classList.contains('dark');
            const nextDark = !currentlyDark;
            applyDarkMode(nextDark);
            setStoredDarkMode(nextDark ? 'dark' : 'light');
        });
    }
});
