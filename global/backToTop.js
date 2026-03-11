document.addEventListener('DOMContentLoaded', function() {
    const backToTopButton = document.createElement('button');
    backToTopButton.type = 'button';
    backToTopButton.className = 'fixed bottom-6 right-4 z-40 hidden items-center justify-center w-12 h-12 rounded-full bg-primary-600 hover:bg-primary-700 text-white shadow-md hover:shadow-2xl transition-all duration-200';
    backToTopButton.setAttribute('aria-label', 'Back to top');

    const icon = document.createElement('span');
    icon.className = 'material-icons text-[20px]';
    icon.textContent = 'arrow_upward';
    backToTopButton.appendChild(icon);

    document.body.appendChild(backToTopButton);

    let scrollTimeout;

    function toggleButtonVisibility() {
        if (window.pageYOffset > 300) {
            backToTopButton.classList.remove('hidden');
            backToTopButton.classList.add('inline-flex');
        } else {
            backToTopButton.classList.add('hidden');
            backToTopButton.classList.remove('inline-flex');
        }
    }

    window.addEventListener('scroll', function() {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(toggleButtonVisibility, 80);
    }, { passive: true });

    backToTopButton.addEventListener('click', function() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    toggleButtonVisibility();
});
