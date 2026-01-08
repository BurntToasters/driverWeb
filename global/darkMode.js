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
            // localStorage unavailable (private browsing)
        }
    }

    const userPreference = getStoredDarkMode();
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;

    function applyDarkMode(isDark) {
        document.documentElement.style.setProperty('--transition-duration', '0.3s');
        if (isDark) {
            document.documentElement.classList.add('dark-mode');
        } else {
            document.documentElement.classList.remove('dark-mode');
        }
    }

    if (darkModeToggle) {
        if (userPreference === null) {
            applyDarkMode(prefersDarkScheme);
            darkModeToggle.checked = prefersDarkScheme;
        } else {
            applyDarkMode(userPreference === 'dark');
            darkModeToggle.checked = userPreference === 'dark';
        }

        darkModeToggle.addEventListener('change', () => {
            if (darkModeToggle.checked) {
                applyDarkMode(true);
                setStoredDarkMode('dark');
            } else {
                applyDarkMode(false);
                setStoredDarkMode('light');
            }
        });
    }
});
