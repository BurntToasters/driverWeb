document.addEventListener('DOMContentLoaded', function() {
  const settingsButton = document.querySelector('.settings-button');
  const settingsOverlay = document.getElementById('settings-overlay');
  const closeSettings = document.querySelector('.close-settings');

  if (settingsButton && settingsOverlay && closeSettings) {
    function openSettings() {
      settingsOverlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeSettingsPanel() {
      settingsOverlay.classList.add('hidden');
      document.body.style.overflow = '';
    }

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

  const collapsibles = document.querySelectorAll('[data-collapsible]');

  collapsibles.forEach(function(coll) {
    coll.addEventListener('click', function() {
      const expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', !expanded);

      const icon = this.querySelector('.material-icons');
      if (icon && icon.textContent === 'expand_more') {
        icon.classList.toggle('rotate-180');
      }

      const content = this.nextElementSibling;

      if (content.style.maxHeight) {
        content.style.maxHeight = null;
        content.style.opacity = '0';
        setTimeout(() => {
          content.classList.add('hidden');
        }, 300);
      } else {
        content.classList.remove('hidden');
        content.style.opacity = '1';
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
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
});
