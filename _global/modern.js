document.addEventListener('DOMContentLoaded', function() {
  const settingsButton = document.querySelector('.settings-button');
  const settingsOverlay = document.getElementById('settings-overlay');
  const closeSettings = document.querySelector('.close-settings');

  if (settingsButton && settingsOverlay && closeSettings) {
    settingsButton.addEventListener('click', function() {
      settingsOverlay.style.display = 'block';
      // Force reflow
      void settingsOverlay.offsetWidth;
      settingsOverlay.classList.add('active');
    });

    closeSettings.addEventListener('click', function() {
      settingsOverlay.classList.remove('active');
      setTimeout(function() {
        settingsOverlay.style.display = 'none';
      }, 300);
    });

    settingsOverlay.addEventListener('click', function(e) {
      if (e.target === settingsOverlay) {
        settingsOverlay.classList.remove('active');
        setTimeout(function() {
          settingsOverlay.style.display = 'none';
        }, 300);
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

  const fontLink = document.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  document.head.appendChild(fontLink);

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