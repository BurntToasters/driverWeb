const LOAD_TIMEOUT_MS = 15000;
const COMPARE_MAX = 3;

const loadRegistry = {};
const driverStore = new Map();

let activeFilter = 'all';
let activeQuery = '';
let activeBrand = '';
let activeChannel = '';
let activeRisk = '';
let activeOs = '';
let activeView = 'comfortable';
let activeCompare = [];

let compareUi = null;
let detailUi = null;

function getStoredRegion() {
    try {
        return localStorage.getItem('userRegion') || 'USA';
    } catch (e) {
        return 'USA';
    }
}

function getRegionalUrl(originalUrl, region) {
    if (region !== 'EU') return originalUrl;
    try {
        const url = new URL(originalUrl);
        if (url.hostname === 'us.download.nvidia.com') url.hostname = 'uk.download.nvidia.com';
        return url.toString();
    } catch (e) {
        return String(originalUrl || '').replace('us.download.nvidia.com', 'uk.download.nvidia.com');
    }
}

function parseDateValue(value) {
    if (!value) return null;
    const directDate = new Date(value);
    if (!Number.isNaN(directDate.getTime())) return directDate;
    const slashMatch = String(value).match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (slashMatch) {
        const month = Number(slashMatch[1]) - 1;
        const day = Number(slashMatch[2]);
        let year = Number(slashMatch[3]);
        if (year < 100) year += 2000;
        const parsed = new Date(year, month, day);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
}

function formatDaysAgo(dateValue) {
    const parsed = parseDateValue(dateValue);
    if (!parsed) return '';
    const dayMs = 24 * 60 * 60 * 1000;
    const diffDays = Math.max(0, Math.floor((new Date() - parsed) / dayMs));
    if (diffDays === 0) return 'Updated today';
    if (diffDays === 1) return 'Updated 1 day ago';
    return `Updated ${diffDays} days ago`;
}

function normalizeBrand(brand) {
    const normalized = (brand || '').toLowerCase();
    return ['nvidia', 'intel', 'amd', 'audio', 'network'].includes(normalized) ? normalized : '';
}

function normalizeChannel(channel) {
    const normalized = (channel || '').toLowerCase();
    return ['game-ready', 'studio', 'game-on', 'pro', 'chipset', 'audio', 'network'].includes(normalized) ? normalized : '';
}

function normalizeRisk(risk) {
    const normalized = (risk || '').toLowerCase();
    return ['low', 'medium', 'high'].includes(normalized) ? normalized : '';
}

function normalizeOs(osValue) {
    const normalized = (osValue || '').toLowerCase();
    return ['windows-10', 'windows-11'].includes(normalized) ? normalized : '';
}

function normalizeFilter(filterType) {
    if (!filterType || filterType === 'all') return 'all';
    if (filterType === 'stable') return 'stable';
    if (filterType === 'grade-A+' || filterType === 'grade-A' || filterType === 'grade-A-') return filterType;
    return 'all';
}

function notifyContentUpdated() {
    document.dispatchEvent(new CustomEvent('driverhub:content-updated'));
}

function notifyDriversLoaded(category, brand, drivers) {
    document.dispatchEvent(new CustomEvent('driverhub:drivers-loaded', {
        detail: { category, brand, drivers: Array.isArray(drivers) ? drivers : [] }
    }));
}

function readStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    activeFilter = normalizeFilter(params.get('filter'));
    activeQuery = (params.get('q') || '').trim().toLowerCase();
    activeBrand = normalizeBrand(params.get('brand'));
    activeChannel = normalizeChannel(params.get('channel'));
    activeRisk = normalizeRisk(params.get('risk'));
    activeOs = normalizeOs(params.get('os'));
    activeView = params.get('view') === 'dense' ? 'dense' : 'comfortable';
    activeCompare = (params.get('compare') || '').split(',').map((v) => v.trim()).filter(Boolean).slice(0, COMPARE_MAX);
}

function writeStateToUrl() {
    const params = new URLSearchParams(window.location.search);
    if (activeFilter !== 'all') params.set('filter', activeFilter); else params.delete('filter');
    if (activeQuery) params.set('q', activeQuery); else params.delete('q');
    if (activeBrand) params.set('brand', activeBrand); else params.delete('brand');
    if (activeChannel) params.set('channel', activeChannel); else params.delete('channel');
    if (activeRisk) params.set('risk', activeRisk); else params.delete('risk');
    if (activeOs) params.set('os', activeOs); else params.delete('os');
    if (activeView !== 'comfortable') params.set('view', activeView); else params.delete('view');
    if (activeCompare.length) params.set('compare', activeCompare.join(',')); else params.delete('compare');
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash || ''}`;
    window.history.replaceState({}, '', next);
}

function riskClass(level) {
    if (level === 'low') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    if (level === 'high') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
}

function channelLabel(channel) {
    if (!channel) return 'General';
    return channel.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function copyToClipboard(text, onSuccess) {
    if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') return;
    navigator.clipboard.writeText(text).then(function() {
        if (typeof onSuccess === 'function') onSuccess();
    });
}

function ensureCompareUi() {
    if (compareUi) return compareUi;
    const bar = document.createElement('div');
    bar.id = 'driver-compare-bar';
    bar.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-[260] w-[min(920px,calc(100%-1.5rem))] hidden';
    bar.innerHTML = '<div class="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur px-4 py-3 shadow-2xl"><div class="flex flex-wrap items-center gap-2 justify-between"><div id="driver-compare-items" class="flex flex-wrap items-center gap-1"></div><div class="flex items-center gap-2"><button id="driver-compare-clear" type="button" class="btn-secondary !px-3 !py-1.5 text-sm">Clear</button><button id="driver-compare-open" type="button" class="btn-primary !px-3 !py-1.5 text-sm">Open Compare</button></div></div></div>';
    const overlay = document.createElement('div');
    overlay.id = 'driver-compare-overlay';
    overlay.className = 'hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[270] p-4';
    overlay.innerHTML = '<div class="max-w-5xl mx-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl h-full max-h-[90vh] overflow-hidden flex flex-col"><div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"><h2 class="section-heading">Driver Compare</h2><button id="driver-compare-close" type="button" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><span class="material-icons">close</span></button></div><div id="driver-compare-content" class="p-5 overflow-auto"></div></div>';
    document.body.appendChild(bar);
    document.body.appendChild(overlay);
    bar.querySelector('#driver-compare-clear').addEventListener('click', function() {
        activeCompare = [];
        writeStateToUrl();
        updateCompareUi();
        updateCompareButtons();
    });
    bar.querySelector('#driver-compare-open').addEventListener('click', function() {
        renderCompareModal();
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        document.dispatchEvent(new CustomEvent('driverhub:overlay-opened', { detail: { id: 'driver-compare' } }));
    });
    function close() {
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }
    overlay.querySelector('#driver-compare-close').addEventListener('click', close);
    overlay.addEventListener('click', function(event) { if (event.target === overlay) close(); });
    compareUi = { bar, overlay, items: bar.querySelector('#driver-compare-items'), content: overlay.querySelector('#driver-compare-content') };
    return compareUi;
}

function ensureDetailUi() {
    if (detailUi) return detailUi;
    const overlay = document.createElement('div');
    overlay.className = 'hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[255]';
    const panel = document.createElement('div');
    panel.className = 'fixed top-0 right-0 h-full w-full max-w-lg bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-2xl z-[256] transform translate-x-full transition-transform duration-200 flex flex-col';
    panel.innerHTML = '<div class="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between"><h2 class="section-heading">Driver Details</h2><button id="driver-detail-close" type="button" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"><span class="material-icons">close</span></button></div><div id="driver-detail-content" class="p-5 overflow-auto space-y-4"></div>';
    document.body.appendChild(overlay);
    document.body.appendChild(panel);
    function close() {
        overlay.classList.add('hidden');
        panel.classList.add('translate-x-full');
        panel.classList.remove('translate-x-0');
        document.body.style.overflow = '';
    }
    panel.querySelector('#driver-detail-close').addEventListener('click', close);
    overlay.addEventListener('click', close);
    detailUi = { overlay, panel, content: panel.querySelector('#driver-detail-content'), close };
    return detailUi;
}
function openDetailPanel(driver) {
    const ui = ensureDetailUi();
    const sources = (driver.sources || []).map((s) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">${s.type}</a>`).join(' · ');
    ui.content.innerHTML = `
        <div class="space-y-2">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">${driver.version}${driver.type ? ` - ${driver.type}` : ''}</h3>
            <div class="flex flex-wrap gap-2">
                <span class="px-2 py-1 rounded text-xs font-semibold ${riskClass(driver.riskLevel)}">${driver.riskLevel || 'medium'} risk</span>
                <span class="px-2 py-1 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">${channelLabel(driver.channel)}</span>
            </div>
        </div>
        <div class="grid sm:grid-cols-2 gap-3 text-sm">
            <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800"><div class="text-xs text-gray-500 mb-1">Release Date</div><div class="font-medium text-gray-900 dark:text-white">${driver.releaseDate || 'Unknown'}</div></div>
            <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800"><div class="text-xs text-gray-500 mb-1">Published</div><div class="font-medium text-gray-900 dark:text-white">${driver.publishedAt || 'Unknown'}</div></div>
            <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800"><div class="text-xs text-gray-500 mb-1">OS Support</div><div class="font-medium text-gray-900 dark:text-white">${(driver.osSupport || []).join(', ') || 'Unknown'}</div></div>
            <div class="p-3 rounded-lg bg-gray-100 dark:bg-gray-800"><div class="text-xs text-gray-500 mb-1">Architecture</div><div class="font-medium text-gray-900 dark:text-white">${(driver.architectures || []).join(', ') || 'Unknown'}</div></div>
        </div>
        <div class="text-sm text-gray-600 dark:text-gray-300">${(driver.highlights || []).join(' • ') || 'No highlights'}</div>
        <div class="text-sm text-gray-600 dark:text-gray-300">${sources || 'No sources listed.'}</div>
        <div class="flex flex-wrap gap-2">
            ${driver.downloadUrl ? `<a href="${driver.downloadUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary !px-3 !py-2 text-sm"><span class="material-icons text-base">download</span>Download</a>` : ''}
            ${driver.releaseNotesUrl ? `<a href="${driver.releaseNotesUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary !px-3 !py-2 text-sm"><span class="material-icons text-base">notes</span>Release Notes</a>` : ''}
            ${driver.knownIssuesUrl ? `<a href="${driver.knownIssuesUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary !px-3 !py-2 text-sm"><span class="material-icons text-base">warning</span>Known Issues</a>` : ''}
        </div>
    `;
    ui.overlay.classList.remove('hidden');
    ui.panel.classList.remove('translate-x-full');
    ui.panel.classList.add('translate-x-0');
    document.body.style.overflow = 'hidden';
    document.dispatchEvent(new CustomEvent('driverhub:overlay-opened', { detail: { id: 'driver-detail' } }));
}

function renderCompareModal() {
    const ui = ensureCompareUi();
    const selected = activeCompare.map((id) => driverStore.get(id)).filter(Boolean);
    if (!selected.length) {
        ui.content.innerHTML = '<p class="text-gray-500">No drivers selected.</p>';
        return;
    }
    const headers = selected.map((d) => `<th class="px-3 py-2 text-left align-top min-w-[170px]"><div class="font-semibold text-gray-900 dark:text-white">${d.version}</div><div class="text-xs text-gray-500">${d.type || d.category}</div></th>`).join('');
    function row(label, fn) {
        return `<tr class="border-t border-gray-200 dark:border-gray-700"><th class="px-3 py-2 text-xs uppercase tracking-wide text-gray-500 text-left align-top">${label}</th>${selected.map((d) => `<td class="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 align-top">${fn(d)}</td>`).join('')}</tr>`;
    }
    ui.content.innerHTML = `<div class="overflow-auto rounded-xl border border-gray-200 dark:border-gray-700"><table class="w-full text-sm"><thead class="bg-gray-50 dark:bg-gray-800/60"><tr><th class="px-3 py-2 text-left text-xs uppercase tracking-wide text-gray-500">Field</th>${headers}</tr></thead><tbody>${row('Risk', (d) => d.riskLevel || 'medium')}${row('Channel', (d) => channelLabel(d.channel))}${row('Vendor', (d) => (d.vendor || '').toUpperCase())}${row('Release', (d) => d.releaseDate || 'Unknown')}${row('OS', (d) => (d.osSupport || []).join(', ') || 'Unknown')}${row('Architecture', (d) => (d.architectures || []).join(', ') || 'Unknown')}${row('Stable', (d) => d.stabilityGrade || 'N/A')}${row('Download', (d) => d.downloadUrl ? `<a href="${d.downloadUrl}" target="_blank" rel="noopener noreferrer" class="text-primary-600 dark:text-primary-400 hover:underline">Open</a>` : 'N/A')}</tbody></table></div>`;
}

function updateCompareUi() {
    const ui = ensureCompareUi();
    const selected = activeCompare.map((id) => driverStore.get(id)).filter(Boolean);
    ui.items.textContent = '';
    selected.forEach(function(driver) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300';
        chip.textContent = driver.version;
        chip.addEventListener('click', function() { activeCompare = activeCompare.filter((id) => id !== driver.id); writeStateToUrl(); updateCompareUi(); updateCompareButtons(); });
        ui.items.appendChild(chip);
    });
    ui.bar.classList.toggle('hidden', selected.length === 0);
}

function updateCompareButtons() {
    document.querySelectorAll('[data-driver-compare-id]').forEach(function(button) {
        const id = button.getAttribute('data-driver-compare-id');
        const selected = activeCompare.includes(id);
        button.className = selected ? 'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200' : 'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
        const label = button.querySelector('[data-compare-label]');
        if (label) label.textContent = selected ? 'Selected' : 'Compare';
    });
}

function toggleCompare(id) {
    if (!id) return;
    const index = activeCompare.indexOf(id);
    if (index >= 0) activeCompare.splice(index, 1);
    else if (activeCompare.length < COMPARE_MAX) activeCompare.push(id);
    writeStateToUrl();
    updateCompareUi();
    updateCompareButtons();
}

function matchesCard(card) {
    const queryMatch = !activeQuery || (card.dataset.search || '').includes(activeQuery);
    const filterMatch = activeFilter === 'all' || (activeFilter === 'stable' ? card.dataset.stable === 'true' : card.dataset.grade === activeFilter.replace('grade-', ''));
    const brandMatch = !activeBrand || card.dataset.brand === activeBrand;
    const channelMatch = !activeChannel || card.dataset.channel === activeChannel;
    const riskMatch = !activeRisk || card.dataset.risk === activeRisk;
    const osMatch = !activeOs || (card.dataset.osList || '').split(',').includes(activeOs);
    return queryMatch && filterMatch && brandMatch && channelMatch && riskMatch && osMatch;
}

function applyRowVisibility() {
    document.querySelectorAll('.driver-card').forEach(function(card) {
        const visible = matchesCard(card);
        card.classList.toggle('hidden', !visible);
        card.classList.toggle('ring-1', visible && Boolean(activeQuery));
        card.classList.toggle('ring-primary-400/50', visible && Boolean(activeQuery));
    });
    document.querySelectorAll('[data-brand-section]').forEach(function(section) {
        if (!activeBrand) section.classList.remove('hidden');
        else section.classList.toggle('hidden', section.dataset.brandSection !== activeBrand);
    });
    document.body.classList.toggle('driver-list-dense', activeView === 'dense');
}

function updateFilterControls() {
    const map = [
        ['filter-query-input', activeQuery],
        ['filter-brand-select', activeBrand],
        ['filter-channel-select', activeChannel],
        ['filter-risk-select', activeRisk],
        ['filter-os-select', activeOs],
        ['filter-view-select', activeView]
    ];
    map.forEach(function([id, value]) {
        const node = document.getElementById(id);
        if (node && node.value !== value) node.value = value;
    });
}

function syncState(options) {
    const settings = options || {};
    applyRowVisibility();
    updateFilterControls();
    if (!settings.skipUrlUpdate) writeStateToUrl();
    notifyContentUpdated();
}

function bindFilterRail() {
    const fields = [
        ['filter-query-input', 'input', (e) => { activeQuery = (e.target.value || '').trim().toLowerCase(); syncState(); }],
        ['filter-brand-select', 'change', (e) => { activeBrand = normalizeBrand(e.target.value); syncState(); }],
        ['filter-channel-select', 'change', (e) => { activeChannel = normalizeChannel(e.target.value); syncState(); }],
        ['filter-risk-select', 'change', (e) => { activeRisk = normalizeRisk(e.target.value); syncState(); }],
        ['filter-os-select', 'change', (e) => { activeOs = normalizeOs(e.target.value); syncState(); }],
        ['filter-view-select', 'change', (e) => { activeView = e.target.value === 'dense' ? 'dense' : 'comfortable'; syncState(); }]
    ];
    fields.forEach(function([id, eventName, handler]) {
        const node = document.getElementById(id);
        if (!node || node.dataset.bound === '1') return;
        node.dataset.bound = '1';
        node.addEventListener(eventName, handler);
    });
    document.querySelectorAll('.filter-chip').forEach(function(chip) {
        if (chip.dataset.bound === '1') return;
        chip.dataset.bound = '1';
        chip.addEventListener('click', function() { activeFilter = normalizeFilter(chip.dataset.filter); syncState(); });
    });
    const clear = document.getElementById('filter-clear-button');
    if (clear && clear.dataset.bound !== '1') {
        clear.dataset.bound = '1';
        clear.addEventListener('click', function() {
            activeFilter = 'all';
            activeQuery = '';
            activeBrand = '';
            activeChannel = '';
            activeRisk = '';
            activeOs = '';
            activeView = 'comfortable';
            syncState();
        });
    }
    updateFilterControls();
}
function normalizeDriverEntry(driver, category, brand, containerId, userRegion, options) {
    const settings = options || {};
    const parsedRelease = parseDateValue(driver.releaseDate);
    const releaseDateIso = driver.releaseDateIso || (parsedRelease ? parsedRelease.toISOString().slice(0, 10) : '');
    const versionSlug = String(driver.version || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const typeSlug = String(driver.type || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const id = String(driver.id || [brand, settings.family || '', settings.channel || '', versionSlug, typeSlug, String(releaseDateIso).replace(/-/g, '')].filter(Boolean).join('|')).replace(/\s+/g, '-');
    const channel = normalizeChannel(driver.channel || settings.channel || '');
    const riskLevel = normalizeRisk(driver.riskLevel || (driver.hasWarning ? 'high' : driver.isStable ? 'low' : 'medium')) || 'medium';
    const osSupport = Array.isArray(driver.osSupport) && driver.osSupport.length ? driver.osSupport.map((v) => String(v).toLowerCase()) : ['windows-10', 'windows-11'];
    const architectures = Array.isArray(driver.architectures) && driver.architectures.length ? driver.architectures.map((v) => String(v).toLowerCase()) : ['x64'];
    const downloadUrl = brand === 'nvidia' ? getRegionalUrl(driver.downloadUrl || '', userRegion) : (driver.downloadUrl || '');
    return {
        id,
        vendor: (driver.vendor || brand || 'generic').toLowerCase(),
        family: (driver.family || settings.family || '').toLowerCase(),
        channel,
        category,
        brand,
        version: driver.version || 'Unknown version',
        type: driver.type || '',
        releaseDate: driver.releaseDate || '',
        releaseDateIso: releaseDateIso || '',
        publishedAt: driver.publishedAt || releaseDateIso || driver.releaseDate || '',
        page: driver.page || settings.page || window.location.pathname,
        downloadUrl,
        releaseNotesUrl: driver.releaseNotesUrl || '',
        knownIssuesUrl: driver.knownIssuesUrl || '',
        previousVersion: driver.previousVersion || '',
        warningUrl: driver.warningUrl || '',
        redditUrl: driver.redditUrl || '',
        hasWarning: Boolean(driver.hasWarning),
        isStable: Boolean(driver.isStable),
        stabilityGrade: driver.stabilityGrade || '',
        riskLevel,
        checksum: driver.checksum || (driver.sha256sum ? { algorithm: 'sha256', value: String(driver.sha256sum).toUpperCase() } : null),
        sources: Array.isArray(driver.sources) ? driver.sources : [],
        highlights: Array.isArray(driver.highlights) ? driver.highlights : [],
        issueTags: Array.isArray(driver.issueTags) ? driver.issueTags : [],
        osSupport,
        architectures
    };
}

function createDriverRow(driver) {
    const card = document.createElement('article');
    card.className = 'driver-card card p-4 flex flex-col gap-3 transition-all duration-200 hover:shadow-md';
    card.tabIndex = 0;
    card.dataset.driverId = driver.id;
    card.dataset.brand = driver.brand;
    card.dataset.channel = driver.channel;
    card.dataset.risk = driver.riskLevel;
    card.dataset.stable = driver.isStable ? 'true' : 'false';
    card.dataset.grade = driver.stabilityGrade || '';
    card.dataset.osList = (driver.osSupport || []).join(',');
    card.dataset.search = [driver.version, driver.type, driver.category, driver.vendor, driver.channel, (driver.highlights || []).join(' ')].join(' ').toLowerCase();
    const typeLabel = driver.type || channelLabel(driver.channel);
    card.innerHTML = `<div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0 flex-1"><h3 class="text-base font-semibold text-gray-900 dark:text-white">${driver.version}</h3><p class="text-sm text-gray-500 dark:text-gray-400">${typeLabel}</p></div><span class="text-xs font-medium text-gray-500 dark:text-gray-400">${driver.releaseDate ? `Released ${driver.releaseDate}` : ''}</span></div><div class="flex flex-wrap gap-2"><span class="px-2 py-1 rounded-md text-xs font-semibold ${riskClass(driver.riskLevel)}">${driver.riskLevel || 'medium'} risk</span><span class="px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">${channelLabel(driver.channel)}</span>${driver.isStable && driver.stabilityGrade ? `<span class="px-2 py-1 rounded-md text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">Stable ${driver.stabilityGrade}</span>` : ''}</div><div class="text-sm text-gray-600 dark:text-gray-300">${(driver.highlights || []).slice(0, 3).join(' • ') || ''}</div><div class="flex flex-wrap items-center gap-2"><a href="${driver.downloadUrl || '#'}" ${driver.downloadUrl ? 'target="_blank" rel="noopener noreferrer"' : ''} class="${driver.downloadUrl ? 'btn-primary !px-3 !py-2 text-sm' : 'btn-secondary !px-3 !py-2 text-sm pointer-events-none opacity-70'}"><span class="material-icons text-base">${driver.downloadUrl ? 'download' : 'block'}</span>${driver.downloadUrl ? 'Download' : 'Unavailable'}</a>${driver.releaseNotesUrl ? `<a href="${driver.releaseNotesUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary !px-3 !py-2 text-sm"><span class="material-icons text-base">notes</span>Notes</a>` : ''}${driver.knownIssuesUrl ? `<a href="${driver.knownIssuesUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary !px-3 !py-2 text-sm"><span class="material-icons text-base">warning</span>Issues</a>` : ''}${driver.redditUrl ? `<a href="${driver.redditUrl}" target="_blank" rel="noopener noreferrer" class="btn-secondary !px-3 !py-2 text-sm"><span class="material-icons text-base">forum</span>Community</a>` : ''}<button type="button" data-driver-compare-id="${driver.id}" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"><span class="material-icons text-[14px]">compare_arrows</span><span data-compare-label>Compare</span></button><button type="button" data-driver-favorite-id="${driver.id}" data-version="${driver.version}" data-category="${driver.category}" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"><span class="material-icons text-[14px]">star_border</span>Watch</button><button type="button" data-driver-detail-id="${driver.id}" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"><span class="material-icons text-[14px]">info</span>Details</button>${driver.checksum && driver.checksum.value ? `<button type="button" data-driver-copy-hash="${driver.id}" class="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"><span class="material-icons text-[14px]">content_copy</span>SHA256</button>` : ''}</div>`;
    card.querySelector(`[data-driver-detail-id="${driver.id}"]`).addEventListener('click', function(event) { event.preventDefault(); event.stopPropagation(); openDetailPanel(driver); });
    card.querySelector(`[data-driver-compare-id="${driver.id}"]`).addEventListener('click', function(event) { event.preventDefault(); event.stopPropagation(); toggleCompare(driver.id); });
    const favoriteBtn = card.querySelector(`[data-driver-favorite-id="${driver.id}"]`);
    if (favoriteBtn && typeof FavoritesModule !== 'undefined' && typeof FavoritesModule.toggle === 'function') {
        function refreshFavoriteState() {
            const isFav = FavoritesModule.isFavorite(driver.version, driver.category);
            favoriteBtn.className = isFav
                ? 'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                : 'inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300';
            const icon = favoriteBtn.querySelector('.material-icons');
            if (icon) icon.textContent = isFav ? 'star' : 'star_border';
        }
        refreshFavoriteState();
        favoriteBtn.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            FavoritesModule.toggle({
                id: driver.id,
                version: driver.version,
                type: driver.type,
                category: driver.category,
                downloadUrl: driver.downloadUrl,
                brand: driver.brand,
                page: driver.page || '/display',
                channel: driver.channel,
                riskLevel: driver.riskLevel,
                publishedAt: driver.publishedAt
            });
            refreshFavoriteState();
        });
    }
    if (driver.checksum && driver.checksum.value) {
        card.querySelector(`[data-driver-copy-hash="${driver.id}"]`).addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            copyToClipboard(driver.checksum.value);
        });
    }
    card.addEventListener('click', function(event) {
        if (event.target.closest('a') || event.target.closest('button')) return;
        openDetailPanel(driver);
    });
    return card;
}

function fetchJsonWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(function() { controller.abort(); }, timeoutMs);
    return fetch(url, { signal: controller.signal }).then(function(response) {
        if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
        return response.json();
    }).finally(function() {
        clearTimeout(timeout);
    });
}

function createUpdateMetaRow(data, brand) {
    const row = document.createElement('div');
    row.className = 'mt-4 flex flex-wrap items-center gap-2';
    row.innerHTML = `<span class="trust-chip"><span class="material-icons text-[14px]">verified</span>Source: ${brand ? brand.toUpperCase() : 'Vendor'}</span>`;
    const freshness = formatDaysAgo(data.lastUpdated || data.generatedAt);
    if (freshness) row.innerHTML += `<span class="trust-chip"><span class="material-icons text-[14px]">schedule</span>${freshness}</span>`;
    return row;
}

function loadDrivers(jsonUrl, containerId, options) {
    const settings = options || {};
    const userRegion = getStoredRegion();
    const container = document.getElementById(containerId);
    if (!container) return;
    loadRegistry[containerId] = { jsonUrl, containerId, options: settings };
    container.innerHTML = '<div class="space-y-3"><div class="h-14 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div><div class="h-14 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse"></div></div>';
    fetchJsonWithTimeout(jsonUrl, LOAD_TIMEOUT_MS).then(function(data) {
        container.innerHTML = '';
        const category = settings.category || (containerId.includes('audio') ? 'Audio Drivers' : containerId.includes('network') ? 'Network Drivers' : containerId.includes('intel') ? (containerId.includes('pro') ? 'Intel Pro' : 'Intel Game On') : containerId.includes('nvidia') ? (containerId.includes('studio') ? 'NVIDIA Studio' : 'NVIDIA Game Ready') : 'Drivers');
        const brand = settings.brand || (containerId.includes('audio') ? 'audio' : containerId.includes('network') ? 'network' : containerId.includes('intel') ? 'intel' : containerId.includes('nvidia') ? 'nvidia' : containerId.includes('amd') ? 'amd' : 'intel');
        const channel = settings.channel || (containerId.includes('studio') ? 'studio' : containerId.includes('pro') ? 'pro' : containerId.includes('intel') ? 'game-on' : containerId.includes('nvidia') ? 'game-ready' : containerId.includes('audio') ? 'audio' : containerId.includes('network') ? 'network' : '');
        const family = settings.family || (window.location.pathname.includes('/laptop') ? 'graphics-laptop' : brand === 'audio' ? 'audio' : brand === 'network' ? 'network' : 'graphics');
        const sourceDrivers = Array.isArray(data.drivers) ? data.drivers : (Array.isArray(data.entries) ? data.entries : []);
        const drivers = sourceDrivers.map((driver) => normalizeDriverEntry(driver, category, brand, containerId, userRegion, { channel, family, page: settings.page || window.location.pathname })).sort((a, b) => (parseDateValue(b.publishedAt)?.getTime() || 0) - (parseDateValue(a.publishedAt)?.getTime() || 0));
        const list = document.createElement('div');
        list.className = 'space-y-3';
        drivers.forEach(function(driver) {
            driverStore.set(driver.id, driver);
            list.appendChild(createDriverRow(driver));
        });
        container.appendChild(list);
        container.appendChild(createUpdateMetaRow(data, brand));
        bindFilterRail();
        notifyDriversLoaded(category, brand, drivers);
        applyRowVisibility();
        updateCompareUi();
        updateCompareButtons();
        notifyContentUpdated();
    }).catch(function() {
        fetchJsonWithTimeout('/feeds/drivers.json', LOAD_TIMEOUT_MS).then(function(localFeed) {
            container.innerHTML = '';
            const category = settings.category || (containerId.includes('audio') ? 'Audio Drivers' : containerId.includes('network') ? 'Network Drivers' : containerId.includes('intel') ? (containerId.includes('pro') ? 'Intel Pro' : 'Intel Game On') : containerId.includes('nvidia') ? (containerId.includes('studio') ? 'NVIDIA Studio' : 'NVIDIA Game Ready') : 'Drivers');
            const brand = settings.brand || (containerId.includes('audio') ? 'audio' : containerId.includes('network') ? 'network' : containerId.includes('intel') ? 'intel' : containerId.includes('nvidia') ? 'nvidia' : containerId.includes('amd') ? 'amd' : 'intel');
            const channel = settings.channel || (containerId.includes('studio') ? 'studio' : containerId.includes('pro') ? 'pro' : containerId.includes('intel') ? 'game-on' : containerId.includes('nvidia') ? 'game-ready' : containerId.includes('audio') ? 'audio' : containerId.includes('network') ? 'network' : '');
            const family = settings.family || (window.location.pathname.includes('/laptop') ? 'graphics-laptop' : brand === 'audio' ? 'audio' : brand === 'network' ? 'network' : 'graphics');
            const entries = Array.isArray(localFeed.entries) ? localFeed.entries : [];
            const sourceDrivers = entries.filter(function(entry) {
                if (brand && entry.brand && entry.brand !== brand) return false;
                if (channel && entry.channel && entry.channel !== channel) return false;
                if (family && entry.family && entry.family !== family) return false;
                return true;
            });
            const drivers = sourceDrivers.map(function(driver) {
                return normalizeDriverEntry(driver, category, brand, containerId, userRegion, { channel, family, page: settings.page || window.location.pathname });
            }).sort(function(a, b) {
                return (parseDateValue(b.publishedAt)?.getTime() || 0) - (parseDateValue(a.publishedAt)?.getTime() || 0);
            });
            const list = document.createElement('div');
            list.className = 'space-y-3';
            drivers.forEach(function(driver) {
                driverStore.set(driver.id, driver);
                list.appendChild(createDriverRow(driver));
            });
            container.appendChild(list);
            container.appendChild(createUpdateMetaRow(localFeed, brand));
            bindFilterRail();
            notifyDriversLoaded(category, brand, drivers);
            applyRowVisibility();
            updateCompareUi();
            updateCompareButtons();
            notifyContentUpdated();
        }).catch(function() {
            container.innerHTML = '<div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200"><p class="font-medium mb-2">Error loading driver data.</p><button data-driver-retry type="button" class="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-200 transition-colors"><span class="material-icons text-base">refresh</span>Retry</button></div>';
            container.querySelector('[data-driver-retry]').addEventListener('click', function() { loadDrivers(jsonUrl, containerId, settings); });
        });
    });
}

function reloadAllDriverLists() {
    Object.keys(loadRegistry).forEach(function(containerId) {
        const item = loadRegistry[containerId];
        if (!item) return;
        loadDrivers(item.jsonUrl, item.containerId, item.options || {});
    });
}

readStateFromUrl();
bindFilterRail();
updateCompareUi();
updateCompareButtons();

document.addEventListener('driverhub:region-changed', function() { reloadAllDriverLists(); });
document.addEventListener('driverhub:overlay-opened', function(event) {
    if (!event.detail) return;
    if (event.detail.id !== 'driver-detail' && detailUi && !detailUi.overlay.classList.contains('hidden')) detailUi.close();
    if (event.detail.id !== 'driver-compare' && compareUi && !compareUi.overlay.classList.contains('hidden')) {
        compareUi.overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }
});

window.DriverHubDrivers = {
    applyFilters: function(filterType, options) { activeFilter = normalizeFilter(filterType); syncState(options); },
    setQuery: function(query, options) { activeQuery = (query || '').trim().toLowerCase(); syncState(options); },
    setBrand: function(brand, options) { activeBrand = normalizeBrand(brand); syncState(options); },
    setChannel: function(channel, options) { activeChannel = normalizeChannel(channel); syncState(options); },
    setRisk: function(risk, options) { activeRisk = normalizeRisk(risk); syncState(options); },
    setOs: function(osValue, options) { activeOs = normalizeOs(osValue); syncState(options); },
    setView: function(viewValue, options) { activeView = viewValue === 'dense' ? 'dense' : 'comfortable'; syncState(options); },
    toggleCompare: toggleCompare,
    addToCompare: function(id) { if (!activeCompare.includes(id) && activeCompare.length < COMPARE_MAX) { activeCompare.push(id); writeStateToUrl(); updateCompareUi(); updateCompareButtons(); } },
    removeFromCompare: function(id) { activeCompare = activeCompare.filter((item) => item !== id); writeStateToUrl(); updateCompareUi(); updateCompareButtons(); },
    openDetails: function(id) { const driver = driverStore.get(id); if (driver) openDetailPanel(driver); },
    getState: function() { return { filter: activeFilter, q: activeQuery, brand: activeBrand, channel: activeChannel, risk: activeRisk, os: activeOs, view: activeView, compare: activeCompare.slice() }; },
    syncFromUrl: function() { readStateFromUrl(); syncState({ skipUrlUpdate: true }); updateCompareUi(); updateCompareButtons(); }
};

function applyFilters(filterType) {
    window.DriverHubDrivers.applyFilters(filterType);
}


