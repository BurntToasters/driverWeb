document.addEventListener('DOMContentLoaded', function() {
  const settingsButton = document.querySelector('.settings-button');
  const settingsOverlay = document.getElementById('settings-overlay');
  const closeSettings = settingsOverlay ? settingsOverlay.querySelector('.close-settings') : null;
  const settingsDarkToggle = document.getElementById('settingsDarkToggle');

  function openSettings() {
    if (!settingsOverlay) return;
    settingsOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeSettingsPanel() {
    if (!settingsOverlay) return;
    settingsOverlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

  if (settingsButton && settingsOverlay && closeSettings) {
    settingsButton.addEventListener('click', openSettings);
    closeSettings.addEventListener('click', closeSettingsPanel);

    settingsOverlay.addEventListener('click', function(e) {
      if (e.target === settingsOverlay) {
        closeSettingsPanel();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && !settingsOverlay.classList.contains('hidden')) {
        closeSettingsPanel();
      }
    });
  }

  if (settingsDarkToggle) {
    settingsDarkToggle.addEventListener('click', function() {
      const darkModeToggle = document.getElementById('darkModeToggle');
      if (darkModeToggle) {
        darkModeToggle.click();
      }
    });

    document.addEventListener('driverhub:dark-mode-changed', function(event) {
      const isDark = Boolean(event.detail && event.detail.isDark);
      settingsDarkToggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
    });

    const initialDark = document.documentElement.classList.contains('dark');
    settingsDarkToggle.setAttribute('aria-pressed', initialDark ? 'true' : 'false');
  }

  function getCollapsibleParts(button) {
    const content = button.nextElementSibling;
    const icon = button.querySelector('[data-collapsible-icon]');
    return { content, icon };
  }

  function openCollapsible(button) {
    const parts = getCollapsibleParts(button);
    if (!parts.content) return;

    button.setAttribute('aria-expanded', 'true');
    if (parts.icon) parts.icon.classList.add('rotate-180');

    parts.content.classList.remove('hidden');
    parts.content.style.opacity = '1';
    parts.content.style.maxHeight = parts.content.scrollHeight + 'px';
  }

  function closeCollapsible(button) {
    const parts = getCollapsibleParts(button);
    if (!parts.content) return;

    button.setAttribute('aria-expanded', 'false');
    if (parts.icon) parts.icon.classList.remove('rotate-180');

    parts.content.style.maxHeight = parts.content.scrollHeight + 'px';
    requestAnimationFrame(function() {
      parts.content.style.maxHeight = '0px';
      parts.content.style.opacity = '0';
    });
  }

  function bindCollapsible(button) {
    if (button.dataset.collapsibleBound === 'true') return;
    button.dataset.collapsibleBound = 'true';

    const parts = getCollapsibleParts(button);
    if (!parts.content) return;

    parts.content.addEventListener('transitionend', function(event) {
      if (event.propertyName !== 'max-height') return;
      const expanded = button.getAttribute('aria-expanded') === 'true';
      if (!expanded) {
        parts.content.classList.add('hidden');
      }
    });

    button.addEventListener('click', function() {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      if (expanded) {
        closeCollapsible(button);
      } else {
        openCollapsible(button);
      }
    });
  }

  function refreshCollapsibles() {
    document.querySelectorAll('[data-collapsible]').forEach(bindCollapsible);
  }

  function updateOpenCollapsibleHeights() {
    document.querySelectorAll('[data-collapsible]').forEach(function(button) {
      if (button.getAttribute('aria-expanded') !== 'true') return;
      const content = button.nextElementSibling;
      if (!content) return;
      content.style.maxHeight = content.scrollHeight + 'px';
      content.style.opacity = '1';
      content.classList.remove('hidden');
    });
  }

  refreshCollapsibles();

  document.addEventListener('driverhub:content-updated', function() {
    refreshCollapsibles();
    updateOpenCollapsibleHeights();
  });

  const observerOptions = {
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('opacity-100', 'translate-y-0');
        entry.target.classList.remove('opacity-0', 'translate-y-4');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('[data-animate]').forEach(section => {
    section.classList.add('opacity-0', 'translate-y-4', 'transition-all', 'duration-500');
    observer.observe(section);
  });

  window.DriverHubUI = {
    refreshCollapsibles,
    updateOpenCollapsibleHeights
  };
});
