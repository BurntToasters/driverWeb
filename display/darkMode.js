document.addEventListener('DOMContentLoaded', () => {
    // Check if user has a preference saved
    const userPreference = localStorage.getItem('darkMode');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const settingsOverlay = document.getElementById('settings-overlay');
    const closeSettings = document.querySelector('.close-settings');

    // Check if the user has dark mode enabled in their system
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)").matches;

    // Function to apply dark or light mode
    function applyDarkMode(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    // Apply saved preference or system default
    if (darkModeToggle) {
        if (userPreference === null) {
            applyDarkMode(prefersDarkScheme);
            darkModeToggle.checked = prefersDarkScheme;
        } else {
            applyDarkMode(userPreference === 'dark');
            darkModeToggle.checked = userPreference === 'dark';
        }

        // Toggle dark mode and save preference
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

    // Show settings overlay
    const settingsButton = document.querySelector('.settings-button');
    if (settingsButton && settingsOverlay) {
        settingsButton.addEventListener('click', () => {
            settingsOverlay.style.display = 'block';
        });
    }

    // Close settings overlay when clicking the X or outside the content
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
