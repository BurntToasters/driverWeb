document.addEventListener('DOMContentLoaded', function() {
    const backToTopButton = document.createElement('button');
    backToTopButton.className = 'back-to-top';
    backToTopButton.setAttribute('aria-label', 'Back to top');
    const icon = document.createElement('span');
    icon.className = 'material-icons';
    icon.textContent = 'arrow_upward';
    backToTopButton.appendChild(icon);
    document.body.appendChild(backToTopButton);

    let scrollTimeout;
    const toggleButtonVisibility = () => {
        if (window.pageYOffset > 300) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    };

    window.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(toggleButtonVisibility, 100);
    }, { passive: true });

    backToTopButton.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    toggleButtonVisibility();
});
