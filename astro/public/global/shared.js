window.DriverHubShared = (function() {
    'use strict';

    function getOverlayState() {
        if (!window.__driverhubOverlayState) {
            window.__driverhubOverlayState = { locks: new Set(), previousOverflow: '' };
        }
        return window.__driverhubOverlayState;
    }

    function lockBodyScroll(lockId) {
        var state = getOverlayState();
        if (!state.locks.size) {
            state.previousOverflow = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
        }
        state.locks.add(lockId);
    }

    function unlockBodyScroll(lockId) {
        var state = getOverlayState();
        state.locks.delete(lockId);
        if (!state.locks.size) {
            document.body.style.overflow = state.previousOverflow || '';
            state.previousOverflow = '';
        }
    }

    function getFocusable(container) {
        if (!container) return [];
        var selector = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])'
        ].join(',');
        return Array.from(container.querySelectorAll(selector)).filter(function(el) {
            return !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden');
        });
    }

    function trapFocus(event, container) {
        if (event.key !== 'Tab') return;
        var focusable = getFocusable(container);
        if (!focusable.length) { event.preventDefault(); return; }
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        var active = document.activeElement;
        if (event.shiftKey && active === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && active === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function normalizeBrand(brand) {
        var normalized = (brand || '').toLowerCase();
        return ['nvidia', 'intel', 'amd', 'audio', 'network'].includes(normalized) ? normalized : '';
    }

    function normalizeChannel(channel) {
        var normalized = (channel || '').toLowerCase();
        return ['game-ready', 'studio', 'game-on', 'pro', 'audio', 'network'].includes(normalized) ? normalized : '';
    }

    function normalizeRisk(risk) {
        var normalized = (risk || '').toLowerCase();
        return ['low', 'medium', 'high'].includes(normalized) ? normalized : '';
    }

    return {
        getOverlayState: getOverlayState,
        lockBodyScroll: lockBodyScroll,
        unlockBodyScroll: unlockBodyScroll,
        getFocusable: getFocusable,
        trapFocus: trapFocus,
        escapeHtml: escapeHtml,
        normalizeBrand: normalizeBrand,
        normalizeChannel: normalizeChannel,
        normalizeRisk: normalizeRisk
    };
})();
