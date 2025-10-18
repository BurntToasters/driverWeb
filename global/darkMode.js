document.addEventListener('DOMContentLoaded', () => {
    const userPreference = localStorage.getItem('darkMode');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const settingsOverlay = document.getElementById('settings-overlay');
    const closeSettings = document.querySelector('.close-settings');

    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;

    function applyDarkMode(isDark) {
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
                localStorage.setItem('darkMode', 'dark');
            } else {
                applyDarkMode(false);
                localStorage.setItem('darkMode', 'light');
            }
        });
    }

    const settingsButton = document.querySelector('.settings-button');
    if (settingsButton && settingsOverlay) {
        settingsButton.addEventListener('click', () => {
            settingsOverlay.style.display = 'block';
        });
    }

    if (closeSettings && settingsOverlay) {
        closeSettings.addEventListener('click', () => {
            settingsOverlay.style.display = 'none';
        });

        window.addEventListener('click', (e) => {
            if (e.target === settingsOverlay) {
                settingsOverlay.style.display = 'none';
            }
        });
    }
});
