if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.getRegistrations().then(function(registrations) {
            return Promise.all(registrations.map(function(registration) {
                return registration.unregister();
            }));
        }).catch(function() {
        });

        if ('caches' in window) {
            caches.keys().then(function(keys) {
                return Promise.all(keys.map(function(key) {
                    return caches.delete(key);
                }));
            }).catch(function() {
            });
        }
    });
} 
