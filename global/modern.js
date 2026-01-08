document.addEventListener('DOMContentLoaded', function() {
  const settingsButton = document.querySelector('.settings-button');
  const settingsOverlay = document.getElementById('settings-overlay');
  const closeSettings = document.querySelector('.close-settings');

  if (settingsButton && settingsOverlay && closeSettings) {
    function openSettings() {
      settingsOverlay.style.display = 'block';
      void settingsOverlay.offsetWidth;
      settingsOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    function closeSettingsPanel() {
      settingsOverlay.classList.remove('active');
      setTimeout(function() {
        settingsOverlay.style.display = 'none';
        document.body.style.overflow = '';
      }, 300);
    }

    settingsButton.addEventListener('click', openSettings);
    closeSettings.addEventListener('click', closeSettingsPanel);

    settingsOverlay.addEventListener('click', function(e) {
      if (e.target === settingsOverlay) {
        closeSettingsPanel();
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && settingsOverlay.classList.contains('active')) {
        closeSettingsPanel();
      }
    });
  }

  const collapsibles = document.querySelectorAll('.Ncollapsible, .Acollapsible, .Icollapsible, .collapsible');
  
  collapsibles.forEach(function(coll) {
    coll.addEventListener('click', function() {
      this.classList.toggle('active');
      
      const content = this.nextElementSibling;
      
      if (content.style.maxHeight) {
        content.style.maxHeight = null;
        setTimeout(() => {
          content.classList.remove('visible');
        }, 300);
      } else {
        content.classList.add('visible');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });

  document.querySelectorAll('a').forEach(link => {
    if (!link.querySelector('img')) { 
      link.classList.add('hover-effect');
    }
  });

  const observerOptions = {
    threshold: 0.1
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.driver-section').forEach(section => {
    observer.observe(section);
  });
});