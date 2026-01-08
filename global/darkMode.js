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

    const userPreference = getStoredDarkMode();
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDarkMode = userPreference === 'dark' || (userPreference === null && prefersDarkScheme);

    function applyDarkMode(isDark) {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        updateToggleIcon(isDark);
    }

    function updateToggleIcon(isDark) {
        if (darkModeToggle) {
            const icon = darkModeToggle.querySelector('.material-icons');
            if (icon) {
                icon.textContent = isDark ? 'light_mode' : 'dark_mode';
            }
        }
    }

    if (darkModeToggle) {
        applyDarkMode(isDarkMode);

        darkModeToggle.addEventListener('click', () => {
            const currentlyDark = document.documentElement.classList.contains('dark');
            applyDarkMode(!currentlyDark);
            setStoredDarkMode(!currentlyDark ? 'dark' : 'light');
        });
    }
});
