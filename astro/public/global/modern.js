document.addEventListener('DOMContentLoaded', function() {
  const settingsButton = document.querySelector('.settings-button');
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsDialog = document.getElementById('settings-dialog');
  const closeSettings = settingsOverlay ? settingsOverlay.querySelector('.close-settings') : null;
  const settingsDarkToggle = document.getElementById('settingsDarkToggle');
  let settingsOpen = false;
  let settingsTrigger = null;

  const { getOverlayState, lockBodyScroll, unlockBodyScroll, getFocusable, trapFocus } = window.DriverHubShared;

  function setSettingsControlState(expanded) {
    if (!settingsButton) return;
    settingsButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function openSettings(triggerElement) {
    if (!settingsOverlay || settingsOpen) return;

    settingsOpen = true;
    settingsTrigger = triggerElement || document.activeElement;

    settingsOverlay.classList.remove('hidden');
    settingsOverlay.setAttribute('aria-hidden', 'false');
    setSettingsControlState(true);
    lockBodyScroll('settings');

    document.dispatchEvent(new CustomEvent('driverhub:overlay-opened', {
      detail: { id: 'settings' }
    }));

    const focusable = getFocusable(settingsOverlay);
    if (focusable.length) {
      focusable[0].focus();
    } else if (settingsDialog) {
      settingsDialog.focus();
    } else {
      settingsOverlay.focus();
    }
  }

  function closeSettingsPanel(restoreFocus) {
    if (!settingsOverlay || !settingsOpen) return;

    settingsOpen = false;

    settingsOverlay.classList.add('hidden');
    settingsOverlay.setAttribute('aria-hidden', 'true');
    setSettingsControlState(false);
    unlockBodyScroll('settings');

    if (restoreFocus !== false && settingsTrigger && typeof settingsTrigger.focus === 'function') {
      settingsTrigger.focus();
    }

    settingsTrigger = null;
  }

  if (settingsOverlay) {
    settingsOverlay.addEventListener('click', function(event) {
      if (event.target === settingsOverlay) {
        closeSettingsPanel(true);
      }
    });
  }

  if (settingsButton && settingsOverlay && closeSettings) {
    setSettingsControlState(false);
    settingsButton.addEventListener('click', function() {
      openSettings(settingsButton);
    });
    closeSettings.addEventListener('click', function() {
      closeSettingsPanel(true);
    });
  }

  document.addEventListener('driverhub:overlay-opened', function(event) {
    if (!settingsOpen) return;
    if (!event.detail || event.detail.id === 'settings') return;
    closeSettingsPanel(false);
  });

  document.addEventListener('keydown', function(event) {
    if (!settingsOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      closeSettingsPanel(true);
      return;
    }

    trapFocus(event, settingsOverlay);
  });

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

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('opacity-100', 'translate-y-0');
        entry.target.classList.remove('opacity-0', 'translate-y-4');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('[data-animate]').forEach(function(section) {
    if (prefersReducedMotion) {
      section.classList.add('opacity-100');
    } else {
      section.classList.add('opacity-0', 'translate-y-4', 'transition-all', 'duration-500');
      observer.observe(section);
    }
  });

  window.DriverHubUI = {
    refreshCollapsibles,
    updateOpenCollapsibleHeights
  };
});
