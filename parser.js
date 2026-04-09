// ================================================================
// SITE STRUCTURE ANALYZER v3.1
// + XPath, Fallback selectors, JS dependency test
// + Base64/obfuscation detection, Headers UI, Cookie analysis
// ================================================================

const DEFAULT_TARGET_URL = "";
let analysisResult = null;
let transportLog = [];

function logT(msg, type = 'info') {
    transportLog.push({ time: new Date().toLocaleTimeString(), message: msg, type });
}

// ================================================================
// UTILS
// ================================================================

function setStatus(m, t = 'loading') { const e = document.getElementById('status'); if (e) { e.textContent = m; e.className = 'status ' + t; } }
function setProgress(p, t, s) {
    const c = document.getElementById('progress-container'), b = document.getElementById('progress-bar'), x = document.getElementById('progress-text');
    if (!c) return; c.style.display = 'block'; b.style.width = p + '%'; x.textContent = t || (p + '%');
    b.classList.remove('cors-error', 'warning', 'worker'); if (s) b.classList.add(s);
}
function getBaseUrl(u) { try { return new URL(u).origin; } catch { return ''; } }
function resolveUrl(h, b) { if (!h) return ''; try { return new URL(h, b).href; } catch { return h; } }
function uniqueArr(a) { return [...new Set(a.filter(Boolean))]; }
function escHtml(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = String(t); return d.innerHTML; }

// ================================================================
// XPATH GENERATOR
// ================================================================

function generateXPath(el) {
    if (!el || el.nodeType !== 1) return '';
    // Приоритет: id > уникальный класс > позиционный
    if (el.id) return `//*[@id="${el.id}"]`;

    const parts = [];
    let current = el;
    while (current && current.nodeType === 1) {
        let selector = current.tagName.toLowerCase();

        // Уникальный класс
        if (current.className && typeof current.className === 'string') {
            const classes = current.className.trim().split(/\s+/).filter(c => c.length > 0 && !/^[\d]/.test(c));
            if (classes.length > 0) {
                // Берём первый осмысленный класс
                const cls = classes[0];
                selector += `[@class and contains(@class,"${cls}")]`;
                parts.unshift('//' + selector);
                // Если класс достаточно уникальный — не поднимаемся выше
                if (cls.length > 3 && !['col', 'row', 'item', 'div', 'block', 'wrap'].includes(cls)) break;
                current = current.parentElement;
                continue;
            }
        }

        // Позиционный
        let idx = 1;
        let sib = current.previousElementSibling;
        while (sib) {
            if (sib.tagName === current.tagName) idx++;
            sib = sib.previousElementSibling;
        }
        selector += `[${idx}]`;
        parts.unshift('/' + selector);
        current = current.parentElement;
    }
    return parts.join('');
}

// Сокращённый XPath для отображения
function shortXPath(el) {
    if (!el || el.nodeType !== 1) return '';
    const tag = el.tagName.toLowerCase();
    if (el.id) return `//*[@id="${el.id}"]`;
    if (el.className && typeof el.className === 'string') {
        const cls = el.className.trim().split(/\s+/)[0];
        if (cls) return `//${tag}[contains(@class,"${cls}")]`;
    }
    return `//${tag}`;
}

// ================================================================
// USER-AGENT
// ================================================================

const UA_MAP = {
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    mobile: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    bot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
};

function getUA() {
    const sel = document.getElementById('uaSelect');
    if (!sel) return UA_MAP.desktop;
    if (sel.value === 'custom') {
        const c = document.getElementById('uaCustom');
        return c && c.value.trim() ? c.value.trim() : UA_MAP.desktop;
    }
    return UA_MAP[sel.value] || UA_MAP.desktop;
}

function getHeaders() {
    return {
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'User-Agent': getUA(),
    };
}

// ================================================================
// WORKER / CORS INDICATOR
// ================================================================

function getWorkerUrl() { const i = document.getElementById('workerUrl'); return i ? i.value.trim().replace(/\/$/, '') : ''; }
function updateWorkerStatus(h) { const b = document.getElementById('workerStatusBadge'); if (!b) return; b.textContent = h ? '✦ активен' : '○ не задан'; b.className = 'worker-badge ' + (h ? 'active' : 'inactive'); }

function updateCorsInd(state, detail) {
    const el = document.getElementById('corsIndicator'); if (!el) return;
    const m = {
        'trying-direct': ['🔗 Прямое...', 'cors-indicator trying'],
        'direct-ok': ['✅ Прямой — CORS OK', 'cors-indicator direct-ok'],
        'trying-worker': ['⚡ Worker...', 'cors-indicator trying'],
        'worker-ok': ['✅ Worker: ' + (detail || ''), 'cors-indicator worker-ok'],
        'cors-detected': ['🛡️ CORS → прокси...', 'cors-indicator cors-blocked'],
        'trying-proxy': ['🔄 ' + (detail || '') + '...', 'cors-indicator cors-blocked'],
        'proxy-ok': ['✅ Прокси: ' + (detail || ''), 'cors-indicator proxy-ok'],
        'all-failed': ['❌ Всё заблокировано', 'cors-indicator all-failed'],
        'hidden': ['', 'cors-indicator']
    };
    const s = m[state] || m['hidden'];
    el.textContent = s[0]; el.className = s[1]; el.style.display = state === 'hidden' ? 'none' : 'block';
}

function getProxyList() {
    return [
        { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=' },
        { name: 'corsproxy', url: 'https://corsproxy.io/?' },
        { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy?quest=' },
        { name: 'thingproxy', url: 'https://thingproxy.freeboard.io/fetch/' },
        { name: 'cors-anywhere', url: 'https://cors-anywhere.herokuapp.com/' },
        { name: 'cors.bridged', url: 'https://cors.bridged.cc/' }
    ];
}

function isCorsErr(e) {
    if (!e) return false; const m = (e.message || '').toLowerCase();
    return m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network error') || m.includes('cors') || m.includes('load failed') || e.name === 'TypeError';
}

// ================================================================
// FETCH
// ================================================================

async function fetchDirect(url) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 10000);
    try {
        // Браузер не позволит установить User-Agent через fetch (forbidden header)
        // Но мы пытаемся — некоторые среды это допускают
        const r = await fetch(url, { headers: { Accept: 'text/html,*/*' }, signal: ac.signal });
        clearTimeout(t); if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const h = await r.text(); if (!h || h.length < 50) throw new Error('Пусто'); return h;
    } catch (e) { clearTimeout(t); throw e; }
}

async function fetchViaWorker(url) {
    const w = getWorkerUrl(); if (!w) throw new Error('Worker не задан');
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 15000);
    try {
        const hdrs = getHeaders();
        const r = await fetch(w + '/?url=' + encodeURIComponent(url) + '&ua=' + encodeURIComponent(hdrs['User-Agent']), {
            headers: { Accept: 'text/html,*/*' }, signal: ac.signal
        });
        clearTimeout(t); if (!r.ok) throw new Error(`Worker HTTP ${r.status}`);
        const h = await r.text(); if (!h || h.length < 50) throw new Error('Пусто'); return h;
    } catch (e) { clearTimeout(t); throw e; }
}

async function fetchViaProxy(url, prefix) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), 15000);
    const raw = prefix.includes('thingproxy') || prefix.includes('cors-anywhere') || prefix.includes('cors.bridged');
    try {
        const r = await fetch(raw ? prefix + url : prefix + encodeURIComponent(url), { headers: { Accept: 'text/html,*/*' }, signal: ac.signal });
        clearTimeout(t); if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const h = await r.text(); if (!h || h.length < 50) throw new Error('Пусто'); return h;
    } catch (e) { clearTimeout(t); throw e; }
}

async function fetchPage(url) {
    const sel = document.getElementById('proxySelect'), mode = sel ? sel.value : 'auto', wUrl = getWorkerUrl();
    if (mode === '') {
        logT('Прямой', 'info'); updateCorsInd('trying-direct');
        try { const h = await fetchDirect(url); logT('✅ Прямой OK', 'success'); updateCorsInd('direct-ok'); return h; }
        catch (e) { logT('❌ ' + e.message, 'fail'); if (isCorsErr(e)) { updateCorsInd('all-failed'); throw new Error('🛡️ CORS! Переключите на Авто.'); } throw e; }
    }
    if (mode === 'auto') {
        try { logT('1/3 Прямой', 'info'); updateCorsInd('trying-direct'); setProgress(12, '🔗 Прямой...'); const h = await fetchDirect(url); logT('✅ OK', 'success'); updateCorsInd('direct-ok'); return h; }
        catch (e) { logT(isCorsErr(e) ? '🛡️ CORS' : '⚠️ ' + e.message, isCorsErr(e) ? 'warning' : 'fail'); }
        if (wUrl) { try { logT('2/3 Worker', 'info'); updateCorsInd('trying-worker'); setProgress(14, '⚡ Worker...', 'worker'); const h = await fetchViaWorker(url); logT('✅ Worker', 'success'); updateCorsInd('worker-ok', wUrl); return h; } catch (e) { logT('❌ Worker: ' + e.message, 'fail'); } }
        else logT('2/3 Worker — нет', 'info');
        updateCorsInd('cors-detected'); const proxies = getProxyList();
        for (let i = 0; i < proxies.length; i++) { const p = proxies[i]; try { logT('3/3 ' + p.name, 'info'); updateCorsInd('trying-proxy', p.name); setProgress(15 + i * 2, '🔄 ' + p.name, 'warning'); const h = await fetchViaProxy(url, p.url); logT('✅ ' + p.name, 'success'); updateCorsInd('proxy-ok', p.name); return h; } catch (e) { logT('❌ ' + p.name + ': ' + e.message, 'fail'); } }
        updateCorsInd('all-failed'); throw new Error('❌ Всё заблокировано. Задайте Worker.');
    }
    if (wUrl) { try { const h = await fetchViaWorker(url); logT('✅ Worker', 'success'); updateCorsInd('worker-ok', wUrl); return h; } catch (e) { logT('Worker: ' + e.message, 'warning'); } }
    const pn = mode.replace(/https?:\/\//, '').split('/')[0];
    try { const h = await fetchViaProxy(url, mode); logT('✅ ' + pn, 'success'); updateCorsInd('proxy-ok', pn); return h; }
    catch (e) { logT('❌ ' + e.message, 'fail'); updateCorsInd('all-failed'); throw e; }
}

async function extractViaWorker(pageUrl) {
    const w = getWorkerUrl(); if (!w) return null;
    try { const r = await fetch(w + '/?url=' + encodeURIComponent(pageUrl) + '&mode=extract'); if (!r.ok) return null; const d = await r.json(); if (d.success && d.videoUrl) return d.videoUrl; } catch (e) {}
    return null;
}

function parseHTML(h) { return new DOMParser().parseFromString(h, 'text/html'); }

// ================================================================
// ANALYZERS — EXTENDED
// ================================================================

function analyzeDom(doc) {
    const all = doc.querySelectorAll('*').length;
    const scripts = doc.querySelectorAll('script');
    const inlineSize = Array.from(scripts).reduce((s, e) => s + (e.textContent || '').length, 0);
    const ext = Array.from(scripts).filter(s => s.src).map(s => s.src);
    const css = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
    return { totalElements: all, scripts: scripts.length, inlineScriptSize: inlineSize, externalScripts: ext.slice(0, 15), stylesheets: css.slice(0, 10), images: doc.querySelectorAll('img').length, links: doc.querySelectorAll('a[href]').length, forms: doc.querySelectorAll('form').length, iframes: doc.querySelectorAll('iframe').length };
}

function analyzeFrameworks(doc, html) {
    const found = [];
    const src = html + Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const checks = [
        ['React', ['data-reactroot', 'data-reactid', '__REACT', 'ReactDOM', '_reactRootContainer']],
        ['Next.js', ['__NEXT_DATA__', '_next/static']],
        ['Vue.js', ['__vue__', 'Vue.component', 'v-cloak', 'data-v-', 'createApp']],
        ['Nuxt.js', ['__NUXT__', '_nuxt/']],
        ['Angular', ['ng-app', 'ng-version', 'zone.js']],
        ['Svelte', ['__svelte']],
        ['jQuery', ['jquery.min.js', 'jQuery', '$.fn.']],
        ['WordPress', ['wp-content', 'wp-includes', 'wp-json']],
        ['Cloudflare', ['cf-browser-verification', 'cf_clearance', 'challenges.cloudflare.com']],
        ['DDoS-Guard', ['ddos-guard', 'ddg_']],
        ['JW Player', ['jwplayer', 'JWPlayer']],
        ['Video.js', ['video.js', 'videojs', 'video-js']],
        ['HLS.js', ['hls.js', 'Hls.', 'hls.min.js']],
    ];
    for (const [name, pats] of checks) { for (const p of pats) { if (src.includes(p)) { found.push(name); break; } } }
    return uniqueArr(found);
}

function analyzeApiEndpoints(doc, html) {
    const src = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const eps = [];
    for (const pat of [/fetch\s*\(\s*['"`](\/[^'"`]+)['"`]/gi, /axios\s*\.\s*(?:get|post)\s*\(\s*['"`](\/[^'"`]+)['"`]/gi, /\.ajax\s*\([^}]*url\s*:\s*['"`](\/[^'"`]+)['"`]/gi]) {
        let m; while ((m = pat.exec(src)) !== null) if (m[1]) eps.push(m[1]); pat.lastIndex = 0;
    }
    let m2; const ap = /['"`]((?:\/api\/|\/v[12]\/|\/graphql|\/wp-json\/)[^'"`]*?)['"`]/gi;
    while ((m2 = ap.exec(src)) !== null) if (m2[1]) eps.push(m2[1]);
    const stateVars = [];
    for (const p of [/__NEXT_DATA__/, /__NUXT__/, /__INITIAL_STATE__/, /window\.__data/i]) if (p.test(src)) stateVars.push(p.source.replace(/\\/g, ''));
    return { endpoints: uniqueArr(eps).slice(0, 15), stateVars };
}

function analyzeProtection(doc, html) {
    const r = { cors: false, cloudflare: false, ddosGuard: false, recaptcha: false, ageGate: null, cookies: [] };
    const lc = html.toLowerCase();
    if (lc.includes('challenges.cloudflare.com') || lc.includes('cf-browser-verification')) r.cloudflare = true;
    if (lc.includes('ddos-guard')) r.ddosGuard = true;
    if (lc.includes('recaptcha') || lc.includes('g-recaptcha') || lc.includes('hcaptcha')) r.recaptcha = true;

    // Cookies в JS
    const cookieRefs = [];
    const ckPat = /document\.cookie\s*[=.]/gi;
    const src = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    let cm; while ((cm = ckPat.exec(src)) !== null) cookieRefs.push(cm[0]);
    const setCookiePat = /(?:setCookie|document\.cookie\s*=\s*['"`])([^'"`=;]+)/gi;
    while ((cm = setCookiePat.exec(src)) !== null) r.cookies.push(cm[1]);
    r.cookies = uniqueArr(r.cookies).slice(0, 10);

    // Age gate
    const ageSels = ['#age-verify', '#age-gate', '.age-verify', '.age-gate', '.age-verification', '[class*="age-verif"]', '[class*="age-gate"]', '[id*="age-verif"]', '#disclaimer'];
    let agFound = false, agSel = null;
    for (const s of ageSels) { try { if (doc.querySelector(s)) { agFound = true; agSel = s; break; } } catch (e) {} }
    if (!agFound) {
        const body = doc.body ? doc.body.textContent : '';
        if (/(?:мне\s*(?:уже\s*)?18|i\s*am\s*(?:over\s*)?18|confirm\s*(?:your\s*)?age|18\+|старше\s*18)/i.test(body)) agFound = true;
    }
    if (agFound) {
        let type = 'css-overlay';
        if (lc.includes('cookie') && (lc.includes('age') || lc.includes('discl'))) type = 'cookie';
        else if (lc.includes('location.href') && lc.includes('age')) type = 'redirect';
        r.ageGate = { detected: true, type, selector: agSel, impact: type === 'css-overlay' ? 'low' : type === 'cookie' ? 'medium' : 'high', note: type === 'css-overlay' ? 'Контент уже в HTML — парсинг не затронут' : type === 'cookie' ? 'Нужен cookie для доступа' : 'Серверный редирект — headless' };
    }
    return r;
}

// ============ JS DEPENDENCY EXACT TEST ============

function analyzeJsDependency(doc, html, videoCardsFound, frameworks) {
    const result = { jsRequired: 'no', catalog: 'no', player: 'no', evidence: [] };

    // Test 1: Empty DOM root
    const root = doc.querySelector('#app, #root, #__next, #__nuxt, [data-reactroot]');
    if (root) {
        const children = root.children.length;
        if (children <= 3) {
            result.evidence.push(`Найден SPA-root (<${root.tagName.toLowerCase()} id="${root.id || root.className}">) с ${children} дочерними`);
            result.catalog = 'yes';
        }
    }

    // Test 2: noscript warning
    const noscript = doc.querySelector('noscript');
    if (noscript) {
        const text = noscript.textContent.trim();
        if (text.length > 10) {
            result.evidence.push(`<noscript>: "${text.substring(0, 100)}"`);
            if (/enable|javascript|включите/i.test(text)) result.catalog = 'yes';
        }
    }

    // Test 3: DOM element count
    const domTotal = doc.querySelectorAll('*').length;
    if (domTotal < 80) { result.evidence.push(`DOM очень маленький: ${domTotal} элементов`); result.catalog = 'yes'; }
    else if (domTotal < 200 && !videoCardsFound) { result.evidence.push(`DOM малый (${domTotal}) + карточки не найдены`); result.catalog = 'yes'; }

    // Test 4: State vars with data
    const src = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const stateMatch = src.match(/__NEXT_DATA__\s*=\s*({[\s\S]*?})\s*<\/script/);
    if (stateMatch) { result.evidence.push('__NEXT_DATA__ содержит встроенные данные'); result.catalog = 'partial'; }
    const nuxtMatch = src.match(/__NUXT__\s*=/);
    if (nuxtMatch) { result.evidence.push('__NUXT__ state обнаружен'); result.catalog = 'partial'; }

    // Test 5: Cards found = catalog doesn't need JS
    if (videoCardsFound) { result.evidence.push('Карточки найдены в HTML — каталог не требует JS'); result.catalog = 'no'; }

    // Player always may need JS
    if (frameworks.includes('JW Player') || frameworks.includes('Video.js') || frameworks.includes('HLS.js')) {
        result.player = 'yes';
        result.evidence.push('Плеер через JS: ' + frameworks.filter(f => ['JW Player', 'Video.js', 'HLS.js'].includes(f)).join(', '));
    }

    // Final verdict
    if (result.catalog === 'yes') result.jsRequired = 'yes';
    else if (result.catalog === 'partial') result.jsRequired = 'partial';
    else if (result.player === 'yes' && result.catalog === 'no') result.jsRequired = 'partial';
    else result.jsRequired = 'no';

    return result;
}

// ============ BASE64 / OBFUSCATION DETECTION ============

function analyzeObfuscation(html) {
    const result = { base64Urls: [], obfuscatedPatterns: [], tokenizedUrls: [] };
    const src = html;

    // atob() calls
    const atobPat = /atob\s*\(\s*['"`]([A-Za-z0-9+/=]{20,})['"`]\s*\)/gi;
    let m; while ((m = atobPat.exec(src)) !== null) {
        try {
            const decoded = atob(m[1]);
            if (/https?:\/\//.test(decoded) && /\.(mp4|m3u8|webm)/.test(decoded)) {
                result.base64Urls.push({ encoded: m[1].substring(0, 60), decoded: decoded.substring(0, 200), type: decoded.includes('.m3u8') ? 'HLS' : 'MP4' });
            }
        } catch (e) {}
    }

    // Standalone Base64 that decodes to URLs
    const b64Pat = /['"`]([A-Za-z0-9+/=]{40,})['"`]/g;
    while ((m = b64Pat.exec(src)) !== null) {
        try {
            const decoded = atob(m[1]);
            if (/https?:\/\/.*\.(mp4|m3u8)/.test(decoded)) {
                result.base64Urls.push({ encoded: m[1].substring(0, 60), decoded: decoded.substring(0, 200), type: decoded.includes('.m3u8') ? 'HLS' : 'MP4' });
            }
        } catch (e) {}
    }

    // decodeURIComponent of encoded URLs
    const duriPat = /decodeURIComponent\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/gi;
    while ((m = duriPat.exec(src)) !== null) {
        try {
            const decoded = decodeURIComponent(m[1]);
            if (/https?:\/\/.*\.(mp4|m3u8)/.test(decoded)) {
                result.obfuscatedPatterns.push({ method: 'decodeURIComponent', decoded: decoded.substring(0, 200) });
            }
        } catch (e) {}
    }

    // String.fromCharCode obfuscation
    if (/String\.fromCharCode/.test(src)) {
        result.obfuscatedPatterns.push({ method: 'String.fromCharCode', note: 'Обнаружено — возможна обфускация URL' });
    }

    // Tokenized URLs (already found)
    const tokenPat = /https?:\/\/[^\s"'<>]+\.(mp4|m3u8)[^\s"'<>]*(?:token|expires|hash|sign|key)=[^\s"'<>]+/gi;
    while ((m = tokenPat.exec(src)) !== null) {
        result.tokenizedUrls.push({ url: m[0].substring(0, 200), hasToken: /token=/i.test(m[0]), hasExpires: /expires=/i.test(m[0]) });
    }

    result.base64Urls = result.base64Urls.slice(0, 5);
    result.tokenizedUrls = result.tokenizedUrls.slice(0, 5);
    return result;
}

// ================================================================
// STANDARD ANALYZERS
// ================================================================

function analyzeEncoding(doc, html) {
    const mc = doc.querySelector('meta[charset]'), mct = doc.querySelector('meta[http-equiv="Content-Type"]');
    let cs = 'Не определено';
    if (mc) cs = mc.getAttribute('charset');
    else if (mct) { const m = (mct.getAttribute('content') || '').match(/charset=([^\s;]+)/i); if (m) cs = m[1]; }
    return { charset: cs.toUpperCase(), source: mc ? '<meta charset>' : mct ? '<meta http-equiv>' : 'n/a' };
}

function analyzePagination(doc, baseUrl, targetUrl) {
    const result = { mainPageUrl: targetUrl, pagination: { found: false, type: null, pattern: null, examples: [] } };
    let pLinks = [], matched = '';
    for (const s of ['.pagination a', '.pager a', '.pages a', 'nav.pagination a', '.paginator a', 'ul.pagination a', 'a.page-link', '.paging a', '[class*="pagination"] a']) {
        try { const l = doc.querySelectorAll(s); if (l.length) { matched = s; l.forEach(a => { const h = a.getAttribute('href'); if (h) pLinks.push(h); }); break; } } catch (e) {}
    }
    if (!pLinks.length) { doc.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href') || '', t = a.textContent.trim(); if (/[?&]page=\d+/i.test(h) || /\/page\/\d+/i.test(h) || /[?&]p=\d+/i.test(h) || (/\/\d+\/?$/.test(h) && /^\d+$/.test(t))) pLinks.push(h); }); if (pLinks.length) matched = 'a (pattern)'; }
    if (pLinks.length) {
        result.pagination.found = true; result.pagination.selector = matched;
        result.pagination.examples = uniqueArr(pLinks.map(h => resolveUrl(h, baseUrl))).slice(0, 10);
        const s0 = pLinks[0];
        if (/[?&]page=\d+/i.test(s0)) { result.pagination.type = 'query'; result.pagination.pattern = '?page=N'; }
        else if (/\/page\/\d+/i.test(s0)) { result.pagination.type = 'path'; result.pagination.pattern = '/page/N/'; }
        else { result.pagination.type = 'other'; result.pagination.pattern = s0; }
    }
    return result;
}

function analyzeSearch(doc, baseUrl) {
    const result = { found: false, forms: [], searchPattern: null };
    doc.querySelectorAll('form').forEach(form => {
        const action = form.getAttribute('action') || '', inputs = form.querySelectorAll('input');
        let hasSI = false, details = [];
        inputs.forEach(i => { const ty = (i.getAttribute('type') || 'text').toLowerCase(), nm = i.getAttribute('name') || '', ph = i.getAttribute('placeholder') || '';
            if (ty === 'search' || nm.match(/^(q|query|search|s|keyword|k|find)$/i) || ph.match(/(поиск|search|найти)/i)) hasSI = true;
            details.push({ type: ty, name: nm, placeholder: ph }); });
        if (hasSI || action.match(/(search|find)/i)) { result.found = true; result.forms.push({ action: resolveUrl(action, baseUrl), method: (form.getAttribute('method') || 'GET').toUpperCase(), inputs: details }); }
    });
    if (result.forms.length) { const f = result.forms[0], si = f.inputs.find(i => i.name.match(/^(q|query|search|s|keyword|k)$/i)), p = si ? si.name : 'q'; result.searchPattern = f.method === 'GET' ? `${f.action}?${p}={q}` : `POST ${f.action} (${p}={q})`; }
    return result;
}

function analyzeSortCat(doc, baseUrl) {
    const result = { sorting: { found: false, options: [] }, categories: { found: false, list: [] } };
    for (const s of ['select[name*="sort"]', '[class*="sort"] a', '.sorting a', 'a[href*="sort="]', 'a[href*="order="]']) {
        try { const els = doc.querySelectorAll(s); els.forEach(el => { if (el.tagName === 'SELECT') { el.querySelectorAll('option').forEach(o => result.sorting.options.push({ label: o.textContent.trim(), value: o.value })); result.sorting.found = true; } else if (el.tagName === 'A') { const h = el.getAttribute('href'); if (h) { result.sorting.options.push({ label: el.textContent.trim(), url: resolveUrl(h, baseUrl) }); result.sorting.found = true; } } }); if (result.sorting.found) break; } catch (e) {}
    }
    if (!result.sorting.found) { const sp = /(sort|order|popular|rating|newest|latest|longest|viewed|top)/i; doc.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href') || '', t = a.textContent.trim(); if (sp.test(h) && t.length > 0 && t.length < 50) { result.sorting.options.push({ label: t, url: resolveUrl(h, baseUrl) }); result.sorting.found = true; } }); }
    const seen = new Set(); result.sorting.options = result.sorting.options.filter(o => { const k = o.label + (o.url || o.value || ''); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 20);
    for (const s of ['.categories a', '.category-list a', '.cats a', '.tags a', '[class*="categor"] a', 'a[href*="/categories/"]', 'a[href*="/category/"]', 'a[href*="/tags/"]']) { try { const l = doc.querySelectorAll(s); if (l.length >= 3) { l.forEach(a => { const h = a.getAttribute('href'), t = a.textContent.trim(); if (h && t && t.length < 100) result.categories.list.push({ name: t, url: resolveUrl(h, baseUrl) }); }); break; } } catch (e) {} }
    if (result.categories.list.length) { result.categories.found = true; const sc = new Set(); result.categories.list = result.categories.list.filter(c => { if (sc.has(c.url)) return false; sc.add(c.url); return true; }).slice(0, 50); result.categories.totalCount = result.categories.list.length; }
    return result;
}

// ============ VIDEO CARDS — WITH XPATH & FALLBACKS ============

function analyzeVideoCards(doc, baseUrl) {
    const result = { found: false, cardSelector: null, totalCardsFound: 0, structure: {
        title: { css: null, xpath: null, fallbacks: [], example: null },
        link: { css: null, xpath: null, fallbacks: [], example: null, pattern: null },
        thumbnail: { css: null, xpath: null, fallbacks: [], attribute: null, example: null },
        duration: { css: null, xpath: null, fallbacks: [], example: null },
        quality: { css: null, xpath: null, fallbacks: [], example: null },
    }, sampleCards: [] };

    const cSels = ['.video-item', '.video-card', '.thumb-item', '.thumb', '.video-thumb', '.video_block', '.video-block', '.item', '.video', '.clip', '.gallery-item', 'article', '.post', '.list-item', '.grid-item', '[data-video-id]', '[data-id]', '.card'];
    let cards = [], uSel = '';
    for (const s of cSels) { try { const f = doc.querySelectorAll(s); if (f.length >= 2 && Array.from(f).some(e => e.querySelector('a[href]')) && Array.from(f).some(e => e.querySelector('img'))) { cards = Array.from(f); uSel = s; break; } } catch (e) {} }
    if (!cards.length) { const p = []; doc.querySelectorAll('div,li,article').forEach(d => { if (d.querySelectorAll(':scope>img,:scope>a>img,:scope>div>img').length >= 1 && d.querySelectorAll(':scope>a[href]').length >= 1 && d.querySelectorAll('a[href]').length < 10) p.push(d); }); if (p.length >= 3) { cards = p; uSel = 'auto'; } }
    if (!cards.length) return result;
    result.found = true; result.cardSelector = uSel; result.totalCardsFound = cards.length;

    // Вычисляем XPath контейнера
    result.cardXPath = cards[0] ? generateXPath(cards[0]) : null;

    const titleSels = ['h1','h2','h3','h4','h5','.title','.name','.video-title','a[title]','[class*="title"]','strong','b'];
    const durSels = ['.duration','.time','.video-time','[class*="duration"]','[class*="time"]','[class*="length"]'];
    const qualSels = ['.quality','.hd','[class*="quality"]','[class*="hd"]','[class*="resolution"]'];

    for (let i = 0; i < Math.min(5, cards.length); i++) {
        const card = cards[i], cd = {};

        // Title — with fallbacks
        const titleFallbacks = [];
        for (const ts of titleSels) {
            try { const el = card.querySelector(ts); if (el) { const t = el.textContent.trim();
                if (t.length > 2 && t.length < 300) {
                    titleFallbacks.push({ css: `${uSel} ${ts}`, xpath: shortXPath(el), example: t.substring(0, 80) });
                    if (!cd.title) cd.title = t;
                }
            } } catch (e) {}
        }
        if (!cd.title) { const a = card.querySelector('a[title]'); if (a) { cd.title = a.getAttribute('title'); titleFallbacks.push({ css: `${uSel} a[title]`, xpath: shortXPath(a), attr: 'title', example: cd.title?.substring(0, 80) }); } }
        if (i === 0 && titleFallbacks.length) {
            result.structure.title.css = titleFallbacks[0].css;
            result.structure.title.xpath = titleFallbacks[0].xpath;
            result.structure.title.example = titleFallbacks[0].example;
            result.structure.title.fallbacks = titleFallbacks.slice(1).map(f => ({ css: f.css, xpath: f.xpath }));
        }

        // Link
        const lk = card.querySelector('a[href]');
        if (lk) {
            cd.link = resolveUrl(lk.getAttribute('href'), baseUrl);
            if (i === 0) {
                result.structure.link.css = `${uSel} a[href]`;
                result.structure.link.xpath = shortXPath(lk);
                result.structure.link.example = cd.link;
                try { result.structure.link.pattern = new URL(cd.link).pathname.replace(/\/\d+\//g, '/{id}/').replace(/\/\d+$/, '/{id}').replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/'); } catch (e) {}
            }
            // Fallback: other <a> links
            const otherLinks = card.querySelectorAll('a[href]');
            if (i === 0 && otherLinks.length > 1) { Array.from(otherLinks).slice(1, 4).forEach(a => { result.structure.link.fallbacks.push({ css: `${uSel} ${a.tagName.toLowerCase()}[href]`, xpath: shortXPath(a) }); }); }
        }

        // Thumbnail — with fallbacks
        const allImgs = card.querySelectorAll('img');
        const thumbFallbacks = [];
        const imgAttrs = ['data-src', 'data-original', 'data-lazy-src', 'data-thumb', 'src'];
        allImgs.forEach(img => {
            for (const at of imgAttrs) { const sv = img.getAttribute(at);
                if (sv && !sv.startsWith('data:') && sv) { thumbFallbacks.push({ css: `${uSel} img`, xpath: shortXPath(img), attr: at, example: resolveUrl(sv, baseUrl) }); if (!cd.thumbnail) cd.thumbnail = resolveUrl(sv, baseUrl); break; }
            }
        });
        if (i === 0 && thumbFallbacks.length) {
            result.structure.thumbnail.css = thumbFallbacks[0].css;
            result.structure.thumbnail.xpath = thumbFallbacks[0].xpath;
            result.structure.thumbnail.attribute = thumbFallbacks[0].attr;
            result.structure.thumbnail.example = thumbFallbacks[0].example;
            result.structure.thumbnail.fallbacks = thumbFallbacks.slice(1).map(f => ({ css: f.css, xpath: f.xpath, attr: f.attr }));
        }

        // Duration — with fallbacks
        const durFallbacks = [];
        for (const ds of durSels) { try { const el = card.querySelector(ds); if (el) { const t = el.textContent.trim(); if (/\d{1,2}:\d{2}/.test(t)) { durFallbacks.push({ css: `${uSel} ${ds}`, xpath: shortXPath(el), example: t }); if (!cd.duration) cd.duration = t; } } } catch (e) {} }
        if (!cd.duration) { for (const el of card.querySelectorAll('span,div,small')) { const t = el.textContent.trim(); if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) { cd.duration = t; durFallbacks.push({ css: `${uSel} ${el.tagName.toLowerCase()}`, xpath: shortXPath(el), example: t }); break; } } }
        if (i === 0 && durFallbacks.length) {
            result.structure.duration.css = durFallbacks[0].css; result.structure.duration.xpath = durFallbacks[0].xpath; result.structure.duration.example = durFallbacks[0].example;
            result.structure.duration.fallbacks = durFallbacks.slice(1).map(f => ({ css: f.css, xpath: f.xpath }));
        }

        // Quality — with fallbacks
        const qualFallbacks = [];
        for (const qs of qualSels) { try { const el = card.querySelector(qs); if (el) { const t = el.textContent.trim(); if (/\b(HD|FHD|4K|1080|720|SD)\b/i.test(t)) { qualFallbacks.push({ css: `${uSel} ${qs}`, xpath: shortXPath(el), example: t }); if (!cd.quality) cd.quality = t; } } } catch (e) {} }
        if (i === 0 && qualFallbacks.length) {
            result.structure.quality.css = qualFallbacks[0].css; result.structure.quality.xpath = qualFallbacks[0].xpath; result.structure.quality.example = qualFallbacks[0].example;
            result.structure.quality.fallbacks = qualFallbacks.slice(1).map(f => ({ css: f.css, xpath: f.xpath }));
        }

        result.sampleCards.push(cd);
    }
    return result;
}

// ============ VIDEO PAGE ============

async function analyzeVideoPage(videoUrl, baseUrl) {
    const result = { analyzed: false, videoUrl, urlStructure: { pattern: null }, videoSources: { found: false, sources: [], methods: [] }, relatedVideos: { found: false, selector: null, count: 0 } };
    if (!videoUrl) return result;
    try {
        setStatus('📥 Видео-страница...', 'loading'); setProgress(82, 'Видео-страница...');
        const html = await fetchPage(videoUrl); const doc = parseHTML(html); result.analyzed = true;
        try { result.urlStructure.pattern = new URL(videoUrl).pathname.replace(/\/\d+\//g, '/{id}/').replace(/\/\d+$/, '/{id}').replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/'); } catch (e) {}
        result.pageTitle = doc.title; const h1 = doc.querySelector('h1'); if (h1) result.videoTitle = h1.textContent.trim();

        // <video>/<source>
        doc.querySelectorAll('video, video source').forEach(v => { const s = v.getAttribute('src') || v.getAttribute('data-src'); if (s) { result.videoSources.sources.push({ type: s.includes('.m3u8') ? 'HLS' : s.includes('.mp4') ? 'MP4' : 'unknown', url: resolveUrl(s, baseUrl), foundIn: '<video> tag', attr: v.hasAttribute('data-src') ? 'data-src' : 'src', quality: v.getAttribute('label') || v.getAttribute('res') || null }); result.videoSources.found = true; result.videoSources.methods.push('video_tag'); } });

        // JS
        const allScript = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
        for (const pat of [/["'](?:file|src|source|video_url|mp4|hls)["']\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8|webm)[^"']*?)["']/gi, /(?:https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8|webm)(?:\?[^\s"'<>]*)?)/gi]) {
            let m; while ((m = pat.exec(allScript)) !== null) { const u = (m[1] || m[0]).replace(/\\/g, '');
                if (u.match(/\.(mp4|m3u8|webm)/)) { const isTokenized = /(?:token|expires|hash|sign)=/i.test(u);
                    result.videoSources.sources.push({ type: u.includes('.m3u8') ? 'HLS' : u.includes('.mp4') ? 'MP4' : 'WebM', url: u, foundIn: 'JavaScript', tokenized: isTokenized }); result.videoSources.found = true; result.videoSources.methods.push('javascript'); }
            } pat.lastIndex = 0;
        }

        // og:meta
        doc.querySelectorAll('meta[property="og:video"],meta[property="og:video:url"]').forEach(m => { const u = m.getAttribute('content'); if (u) { result.videoSources.sources.push({ type: u.includes('.m3u8') ? 'HLS' : 'MP4', url: resolveUrl(u, baseUrl), foundIn: 'og:meta' }); result.videoSources.found = true; result.videoSources.methods.push('meta_tag'); } });

        // iframes
        const pIframes = []; doc.querySelectorAll('iframe[src],iframe[data-src]').forEach(f => { const s = f.getAttribute('src') || f.getAttribute('data-src'); if (s && (s.includes('player') || s.includes('embed') || s.includes('video'))) pIframes.push({ src: resolveUrl(s, baseUrl), attr: f.hasAttribute('data-src') ? 'data-src' : 'src' }); });
        if (pIframes.length) { result.videoSources.playerIframes = pIframes; result.videoSources.methods.push('iframe'); }

        // Worker extract
        const we = await extractViaWorker(videoUrl); if (we) { result.videoSources.sources.push({ type: we.includes('.m3u8') ? 'HLS' : 'MP4', url: we, foundIn: 'Worker extract ✦' }); result.videoSources.found = true; result.videoSources.methods.push('worker_extract'); }

        // Base64 / obfuscation
        const obf = analyzeObfuscation(html);
        if (obf.base64Urls.length) { obf.base64Urls.forEach(b => { result.videoSources.sources.push({ type: b.type, url: b.decoded, foundIn: 'Base64 (atob)', base64: true }); result.videoSources.found = true; result.videoSources.methods.push('base64'); }); }

        // Fallback pattern
        if (!result.videoSources.found) { for (const p of [/["'](https?:\/\/[^"']+\.mp4[^"']*)['"]/i, /["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/i]) { const m = html.match(p); if (m && m[1]) { result.videoSources.sources.push({ type: m[1].includes('.m3u8') ? 'HLS' : 'MP4', url: m[1], foundIn: 'pattern' }); result.videoSources.found = true; result.videoSources.methods.push('local_pattern'); break; } } }

        // Dedup
        const ss = new Set(); result.videoSources.sources = result.videoSources.sources.filter(s => { if (ss.has(s.url)) return false; ss.add(s.url); return true; }); result.videoSources.methods = uniqueArr(result.videoSources.methods);
        result.obfuscation = obf;

        // Related
        for (const sel of ['.related','.related-videos','.similar','.recommended','#related','[class*="related"]']) { try { const el = doc.querySelector(sel); if (el) { const rl = el.querySelectorAll('a[href]'); if (rl.length) { result.relatedVideos = { found: true, selector: sel, count: rl.length, sampleLinks: Array.from(rl).slice(0, 5).map(a => ({ text: a.textContent.trim().substring(0, 100), href: resolveUrl(a.getAttribute('href'), baseUrl) })) }; break; } } } catch (e) {} }
    } catch (err) { result.error = isCorsErr(err) ? '🛡️ CORS на видео-странице' : err.message; }
    return result;
}

function analyzeMeta(doc) {
    const m = { title: doc.title, description: null, ogTitle: null, ogImage: null, language: null, generator: null };
    const d = doc.querySelector('meta[name="description"]'); if (d) m.description = d.getAttribute('content');
    const ot = doc.querySelector('meta[property="og:title"]'); if (ot) m.ogTitle = ot.getAttribute('content');
    const oi = doc.querySelector('meta[property="og:image"]'); if (oi) m.ogImage = oi.getAttribute('content');
    const l = doc.documentElement.getAttribute('lang'); if (l) m.language = l;
    const g = doc.querySelector('meta[name="generator"]'); if (g) m.generator = g.getAttribute('content');
    return m;
}

// ================================================================
// ARCHITECTURE SYNTHESIS
// ================================================================

function synthesizeArchitecture(doc, html, vc, vp, enc, pag, search, sortCat, prot, fw, api, dom, jsDep, obf) {
    let siteType = 'A', label = 'Статический HTML', desc = 'Все данные в HTML — легко парсится';
    const isEmpty = dom.totalElements < 100, hasSPA = fw.some(f => ['React','Vue.js','Angular','Svelte','Next.js','Nuxt.js'].includes(f));
    const hasAPI = api.endpoints.length > 0 || api.stateVars.length > 0;
    const hasHLS = vp?.videoSources?.sources?.some(s => s.type === 'HLS');
    const hasIframe = vp?.videoSources?.playerIframes?.length > 0;

    if (isEmpty && hasSPA) { siteType = 'C'; label = 'Dynamic JS (SPA)'; desc = 'Контент генерируется JS — headless или реверс API'; }
    else if (!isEmpty && hasAPI && !vc?.found) { siteType = 'B'; label = 'JSON API'; desc = 'Данные через API — API sniffing'; }
    else if (hasHLS && !vc?.found) { siteType = 'D'; label = 'Стриминг'; desc = 'Live HLS — stream extractor'; }
    else if (vc?.found && (hasIframe || hasSPA || hasAPI)) { siteType = 'E'; label = 'Гибрид'; desc = 'Каталог HTML + плеер JS/iframe'; }

    let cx = 1.0; const factors = [];
    if (vc?.found) { cx -= 0.5; factors.push({ t: 'Карточки в HTML', e: -0.5 }); } else { cx += 1.5; factors.push({ t: 'Карточки не найдены', e: +1.5 }); }
    if (vp?.videoSources?.found) {
        const mt = vp.videoSources.methods || [];
        if (mt.includes('video_tag')) { factors.push({ t: '<video> tag', e: -0.3 }); cx -= 0.3; }
        else if (mt.includes('javascript')) { factors.push({ t: 'Видео в JS', e: +0.3 }); cx += 0.3; }
        else if (mt.includes('base64')) { factors.push({ t: 'Видео в Base64', e: +0.8 }); cx += 0.8; }
        else if (mt.includes('worker_extract')) { factors.push({ t: 'Worker extract', e: +0.5 }); cx += 0.5; }
    } else { cx += 1; factors.push({ t: 'Видео не найдено', e: +1 }); }
    if (hasIframe) { cx += 0.5; factors.push({ t: 'iframe плеер', e: +0.5 }); }
    if (isEmpty) { cx += 1.5; factors.push({ t: 'Пустой DOM (SPA)', e: +1.5 }); }
    if (hasSPA) { cx += 0.5; factors.push({ t: 'JS-фреймворк', e: +0.5 }); }
    if (prot.cloudflare) { cx += 1; factors.push({ t: 'Cloudflare', e: +1 }); }
    if (prot.ddosGuard) { cx += 0.8; factors.push({ t: 'DDoS-Guard', e: +0.8 }); }
    if (prot.recaptcha) { cx += 1; factors.push({ t: 'CAPTCHA', e: +1 }); }
    if (obf?.base64Urls?.length) { cx += 0.5; factors.push({ t: 'Base64 обфускация', e: +0.5 }); }
    if (prot.ageGate?.type && prot.ageGate.type !== 'css-overlay') { cx += 0.5; factors.push({ t: 'Age gate (' + prot.ageGate.type + ')', e: +0.5 }); }

    const lvl = Math.max(1, Math.min(5, Math.round(cx)));
    const lvlLabels = { 1: 'Элементарно', 2: 'Просто', 3: 'Средне', 4: 'Сложно', 5: 'Очень сложно' };

    let recMethod = 'CSS-селекторы / XPath', recTools = 'Cheerio / BeautifulSoup', recTransport = 'Прокси достаточно', recNotes = [];
    if (siteType === 'B') { recMethod = 'API sniffing + JSON'; recTools = 'requests + JSON.parse'; recNotes.push('DevTools → Network для перехвата API'); }
    else if (siteType === 'C') { recMethod = 'Headless browser'; recTools = 'Puppeteer / Playwright'; recTransport = 'Headless Chrome'; }
    else if (siteType === 'D') { recMethod = 'Stream extractor'; recTools = 'yt-dlp / ffmpeg'; }
    else if (siteType === 'E') { recMethod = 'CSS + JS regex'; recTools = 'Cheerio + regex'; if (hasIframe) recNotes.push('iframe → доп. запрос'); }
    if (prot.cloudflare || prot.ddosGuard) { recTransport = 'Worker / Puppeteer+stealth'; recNotes.push('Анти-DDoS защита'); }
    if (jsDep.jsRequired === 'yes') recNotes.push('Каталог требует JS — Cheerio недостаточно');
    if (jsDep.jsRequired === 'partial') recNotes.push('Каталог частично в HTML, плеер через JS');

    return { siteType, siteTypeLabel: label, siteTypeDesc: desc, complexity: lvl, complexityLabel: lvlLabels[lvl], complexityFactors: factors,
        recommendation: { method: recMethod, tools: recTools, transport: recTransport, notes: recNotes },
        frameworks: fw, apiEndpoints: api.endpoints, stateVars: api.stateVars, protection: prot, domInfo: dom, jsDependency: jsDep,
        obfuscation: obf, headersUsed: { 'User-Agent': getUA() },
    };
}

// ================================================================
// MAIN
// ================================================================

async function runFullAnalysis() {
    const ui = document.getElementById('targetUrl');
    const targetUrl = (ui ? ui.value.trim() : '') || DEFAULT_TARGET_URL;
    if (!targetUrl) { setStatus('❌ Введите URL!', 'error'); return; }
    try { new URL(targetUrl); } catch { setStatus('❌ Некорректный URL!', 'error'); return; }
    if (ui) ui.value = targetUrl;
    const baseUrl = getBaseUrl(targetUrl), wUrl = getWorkerUrl();
    const btn = document.getElementById('btnAnalyze'); if (btn) { btn.disabled = true; btn.textContent = '⏳ ...'; }
    document.getElementById('results').style.display = 'none';
    updateCorsInd('hidden'); updateWorkerStatus(!!wUrl); transportLog = [];
    const pb = document.getElementById('progress-bar'); if (pb) pb.classList.remove('cors-error', 'warning', 'worker');

    analysisResult = { _meta: { analyzedUrl: targetUrl, baseUrl, analyzedAt: new Date().toISOString(), workerUsed: wUrl || 'нет', userAgent: getUA(), tool: 'v3.1' } };

    try {
        setStatus('📥 Загрузка...', 'loading'); setProgress(10, '📡 Подключение...');
        let html;
        try { html = await fetchPage(targetUrl); } catch (e) {
            setProgress(10, '❌ ' + (isCorsErr(e) ? 'CORS!' : e.message.substring(0, 50)), 'cors-error');
            setStatus('❌ ' + e.message, 'error');
            analysisResult._error = { type: isCorsErr(e) ? 'CORS' : 'FETCH', message: e.message };
            analysisResult._transportLog = transportLog; displayResults(analysisResult); return;
        }
        const doc = parseHTML(html);
        setProgress(20, '✅ ' + (html.length / 1024).toFixed(0) + ' KB');

        setProgress(22, 'DOM...'); const domInfo = analyzeDom(doc);
        setProgress(25, 'Кодировка...'); analysisResult.encoding = analyzeEncoding(doc, html);
        setProgress(27, 'Мета...'); analysisResult.siteMetaInfo = analyzeMeta(doc);
        setProgress(30, 'Фреймворки...'); const fw = analyzeFrameworks(doc, html);
        setProgress(34, 'API...'); const api = analyzeApiEndpoints(doc, html);
        setProgress(38, 'Защита...'); const prot = analyzeProtection(doc, html);
        setProgress(42, 'Обфускация...'); const obf = analyzeObfuscation(html);
        setProgress(46, 'Пагинация...'); analysisResult.pagination = analyzePagination(doc, baseUrl, targetUrl);
        setProgress(50, 'Поиск...'); analysisResult.search = analyzeSearch(doc, baseUrl);
        setProgress(56, 'Сортировка/категории...'); analysisResult.sortCat = analyzeSortCat(doc, baseUrl);
        setProgress(65, 'Карточки (XPath+fallbacks)...'); analysisResult.videoCards = analyzeVideoCards(doc, baseUrl);
        setProgress(72, 'JS-зависимость...'); const jsDep = analyzeJsDependency(doc, html, analysisResult.videoCards.found, fw);

        setProgress(78, 'Видео-страница...');
        let svUrl = analysisResult.videoCards.sampleCards?.[0]?.link;
        analysisResult.videoPage = svUrl ? await analyzeVideoPage(svUrl, baseUrl) : { analyzed: false, note: 'Нет ссылок' };

        setProgress(90, 'Синтез архитектуры...');
        analysisResult.architecture = synthesizeArchitecture(doc, html, analysisResult.videoCards, analysisResult.videoPage, analysisResult.encoding, analysisResult.pagination, analysisResult.search, analysisResult.sortCat, prot, fw, api, domInfo, jsDep, obf);

        analysisResult._summary = {
            siteType: analysisResult.architecture.siteType, siteTypeLabel: analysisResult.architecture.siteTypeLabel,
            complexity: analysisResult.architecture.complexity, complexityLabel: analysisResult.architecture.complexityLabel,
            jsRequired: jsDep.jsRequired,
            encoding: analysisResult.encoding.charset,
            hasPagination: analysisResult.pagination.pagination.found, paginationPattern: analysisResult.pagination.pagination.pattern,
            hasSearch: analysisResult.search.found,
            hasSorting: analysisResult.sortCat.sorting.found,
            hasCategories: analysisResult.sortCat.categories.found, categoriesCount: analysisResult.sortCat.categories.totalCount || 0,
            videoCardsFound: analysisResult.videoCards.totalCardsFound,
            videoSourceFound: analysisResult.videoPage.videoSources?.found || false, videoSourceMethods: analysisResult.videoPage.videoSources?.methods || [],
            frameworks: fw, protection: { cloudflare: prot.cloudflare, ddosGuard: prot.ddosGuard, recaptcha: prot.recaptcha, ageGate: !!prot.ageGate?.detected },
            obfuscationDetected: (obf.base64Urls.length + obf.obfuscatedPatterns.length) > 0,
        };
        analysisResult._transportLog = transportLog;
        displayResults(analysisResult);
        setProgress(100, '✅ Готово!'); setStatus('✅ Анализ завершён!', 'success');
    } catch (err) { setStatus('❌ ' + err.message, 'error'); analysisResult._transportLog = transportLog; displayResults(analysisResult); }
    finally { if (btn) { btn.disabled = false; btn.textContent = '🚀 Полный анализ'; } }
}

// ================================================================
// DISPLAY
// ================================================================

function displayResults(data) {
    document.getElementById('results').style.display = 'block';
    const json = JSON.stringify(data, null, 2);
    document.getElementById('jsonFormatted').innerHTML = syntaxHL(json);
    document.getElementById('jsonRaw').value = json;
    document.getElementById('visualReport').innerHTML = genVisual(data);
    document.getElementById('archReport').innerHTML = genArch(data);
    document.getElementById('btnCopyJson').disabled = false;
    document.getElementById('btnCopyArch').disabled = false;
}

// ================================================================
// ARCHITECTURE TAB RENDER
// ================================================================

function genArch(data) {
    if (!data.architecture) {
        if (data._error) return genCorsBlock(data);
        return '<p style="color:#555">Нет данных</p>';
    }
    const a = data.architecture, lvl = a.complexity;
    const lc = ['','level-1-color','level-2-color','level-3-color','level-4-color','level-5-color'][lvl];
    let h = '';

    // Diagnosis
    h += `<div class="arch-diagnosis">
        <div class="arch-diagnosis-main level-${lvl}">
            <span class="arch-type-badge arch-type-${a.siteType}">Тип ${a.siteType}</span>
            <div class="arch-site-type">${escHtml(a.siteTypeLabel)}</div>
            <div class="arch-site-desc">${escHtml(a.siteTypeDesc)}</div>
            <table style="font-size:12px;color:#aaa;width:100%;margin-top:10px;border-collapse:collapse;">
                <tr><th style="text-align:left;padding:3px 6px;color:#666;border-bottom:1px solid #222">Фактор</th><th style="text-align:right;padding:3px 6px;color:#666;border-bottom:1px solid #222">Вес</th></tr>
                ${a.complexityFactors.map(f => `<tr><td style="padding:2px 6px">${escHtml(f.t)}</td><td style="text-align:right;padding:2px 6px;color:${f.e > 0 ? '#ff6666' : '#66ff66'}">${f.e > 0 ? '+' : ''}${f.e}</td></tr>`).join('')}
            </table>
        </div>
        <div class="arch-complexity">
            <div class="complexity-gauge"><span class="complexity-number ${lc}">${lvl}/5</span></div>
            <div class="complexity-label ${lc}">${escHtml(a.complexityLabel)}</div>
            <div class="complexity-sublabel">Сложность парсинга</div>
        </div>
    </div>`;

    // JS Dependency verdict
    const js = a.jsDependency;
    if (js) {
        const vc = js.jsRequired === 'yes' ? 'js-verdict-yes' : js.jsRequired === 'partial' ? 'js-verdict-partial' : 'js-verdict-no';
        const vt = js.jsRequired === 'yes' ? '❌ Да — требуется' : js.jsRequired === 'partial' ? '⚠️ Частично' : '✅ Нет — не требуется';
        h += `<div class="arch-js-verdict"><h4 class="${vc}">🔧 JavaScript необходим? ${vt}</h4>
            <p><strong>Каталог:</strong> ${js.catalog === 'yes' ? '❌ Требует JS' : js.catalog === 'partial' ? '⚠️ Данные есть в __STATE__, но DOM пуст' : '✅ HTML достаточно'}</p>
            <p><strong>Плеер:</strong> ${js.player === 'yes' ? '⚠️ JS-плеер' : '✅ Прямые ссылки'}</p>
            ${js.evidence.length ? '<ul style="margin-top:8px;padding-left:20px;">' + js.evidence.map(e => `<li style="font-size:12px;color:#888;">${escHtml(e)}</li>`).join('') + '</ul>' : ''}
        </div>`;
    }

    // Recommendations
    const rec = a.recommendation;
    h += `<div class="arch-recommendations"><h3>🔧 Рекомендуемый стек</h3><div class="arch-rec-grid">
        <span class="arch-rec-label">📦 Метод:</span><span class="arch-rec-value"><code>${escHtml(rec.method)}</code></span>
        <span class="arch-rec-label">🛠 Инструменты:</span><span class="arch-rec-value"><code>${escHtml(rec.tools)}</code></span>
        <span class="arch-rec-label">🔗 Транспорт:</span><span class="arch-rec-value">${escHtml(rec.transport)}</span>
        <span class="arch-rec-label">📡 User-Agent:</span><span class="arch-rec-value"><code style="font-size:11px">${escHtml(a.headersUsed?.['User-Agent']?.substring(0, 80) || 'N/A')}</code></span>
        ${rec.notes.map(n => `<span class="arch-rec-label">⚠️</span><span class="arch-rec-value warn">${escHtml(n)}</span>`).join('')}
    </div></div>`;

    // Selectors table (CSS + XPath + Fallbacks)
    const vc2 = data.videoCards;
    if (vc2?.found) {
        h += `<div class="arch-checklist"><h3>🎯 Селекторы (CSS + XPath + Fallbacks)</h3>
            <table class="arch-selectors-table">
                <tr><th>Поле</th><th>CSS (primary)</th><th>XPath</th><th>Fallbacks</th><th>Пример</th></tr>`;
        const st = vc2.structure;
        const fields = [
            { name: '📦 Карточка', css: vc2.cardSelector, xpath: vc2.cardXPath || '', fb: [], ex: vc2.totalCardsFound + ' шт.' },
            { name: '📌 Название', ...st.title },
            { name: '🔗 Ссылка', ...st.link, ex: st.link.pattern || st.link.example },
            { name: '🖼 Превью', ...st.thumbnail, ex: st.thumbnail.attribute ? 'attr: ' + st.thumbnail.attribute : '' },
            { name: '⏱ Длительность', ...st.duration },
            { name: '📺 Качество', ...st.quality },
        ];
        for (const f of fields) {
            const fbs = (f.fallbacks || []).map(fb => `<code class="fallback">${escHtml(fb.css || '')}</code>`).join(' ');
            h += `<tr>
                <td><strong>${f.name}</strong></td>
                <td><code>${escHtml(f.css || '—')}</code></td>
                <td><code class="xpath">${escHtml(f.xpath || '—')}</code></td>
                <td>${fbs || '<span style="color:#555">—</span>'}</td>
                <td style="font-size:11px;color:#888;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${escHtml((f.ex || f.example || '').substring(0, 60))}</td>
            </tr>`;
        }
        h += '</table></div>';
    }

    // Video URLs with metadata
    if (data.videoPage?.videoSources?.sources?.length) {
        h += '<div class="arch-video-urls"><h4>🎬 Видео-источники (детальный анализ)</h4>';
        data.videoPage.videoSources.sources.forEach(s => {
            h += `<div class="video-url-item"><code>${escHtml(s.url)}</code>
                <div class="video-url-meta">
                    <span class="video-url-tag ${(s.type || '').includes('HLS') ? 'hls' : 'mp4'}">${escHtml(s.type)}</span>
                    <span class="video-url-tag method">${escHtml(s.foundIn)}</span>
                    ${s.tokenized ? '<span class="video-url-tag tokenized">⏰ Tokenized</span>' : ''}
                    ${s.base64 ? '<span class="video-url-tag base64">🔐 Base64</span>' : ''}
                    ${s.attr ? `<span class="video-url-tag method">attr: ${escHtml(s.attr)}</span>` : ''}
                    ${s.quality ? `<span class="video-url-tag method">${escHtml(s.quality)}</span>` : ''}
                </div>
            </div>`;
        });
        h += '</div>';
    }

    // Checklist
    const sm = data._summary || {};
    const checks = [
        { i: '📄', l: 'Каталог HTML', v: vc2?.found ? `✅ ${vc2.totalCardsFound} карточек` : '❌', c: vc2?.found ? 'ok' : 'fail' },
        { i: '📑', l: 'Пагинация', v: sm.hasPagination ? `✅ ${sm.paginationPattern}` : '❌', c: sm.hasPagination ? 'ok' : 'fail' },
        { i: '🔍', l: 'Поиск', v: sm.hasSearch ? '✅' : '❌', c: sm.hasSearch ? 'ok' : 'fail' },
        { i: '📁', l: 'Категории', v: sm.hasCategories ? `✅ ${sm.categoriesCount}` : '❌', c: sm.hasCategories ? 'ok' : 'fail' },
        { i: '🔄', l: 'Сортировка', v: sm.hasSorting ? '✅' : '❌', c: sm.hasSorting ? 'ok' : 'fail' },
        { i: '▶️', l: 'Видео-URL', v: sm.videoSourceFound ? `✅ ${sm.videoSourceMethods.join(',')}` : '❌', c: sm.videoSourceFound ? 'ok' : 'fail' },
        { i: '🔐', l: 'Обфускация', v: sm.obfuscationDetected ? '⚠️ Обнаружена' : '— нет', c: sm.obfuscationDetected ? 'warn' : 'neutral' },
        { i: '🌐', l: 'API', v: a.apiEndpoints?.length ? `⚠️ ${a.apiEndpoints.length}` : '— нет', c: a.apiEndpoints?.length ? 'warn' : 'neutral' },
        { i: '📊', l: 'DOM', v: a.domInfo?.totalElements || '?', c: (a.domInfo?.totalElements || 0) < 100 ? 'warn' : 'ok' },
        { i: '🛡️', l: 'Cloudflare', v: a.protection?.cloudflare ? '⚠️' : '—', c: a.protection?.cloudflare ? 'warn' : 'neutral' },
        { i: '🤖', l: 'CAPTCHA', v: a.protection?.recaptcha ? '❌' : '—', c: a.protection?.recaptcha ? 'fail' : 'neutral' },
        { i: '🍪', l: 'Cookies в JS', v: (a.protection?.cookies?.length || 0) > 0 ? `⚠️ ${a.protection.cookies.length}` : '—', c: (a.protection?.cookies?.length || 0) > 0 ? 'warn' : 'neutral' },
    ];
    h += '<div class="arch-checklist"><h3>✅ Чеклист</h3><div class="arch-checklist-grid">';
    checks.forEach(c => { h += `<div class="arch-check-item"><span class="arch-check-icon">${c.i}</span><span class="arch-check-label">${escHtml(c.l)}</span><span class="arch-check-value ${c.c}">${c.v}</span></div>`; });
    h += '</div></div>';

    // Age gate
    if (a.protection?.ageGate?.detected) {
        const ag = a.protection.ageGate;
        h += `<div class="arch-age-gate"><h4>🔞 Возрастной гейт <span class="gate-type ${ag.type}">${escHtml(ag.type)}</span></h4>
            <p>Влияние: ${ag.impact === 'low' ? '🟢 Низкое' : ag.impact === 'medium' ? '🟡 Среднее' : '🔴 Высокое'}</p>
            <p>${escHtml(ag.note)}</p></div>`;
    }

    // Details
    h += '<div class="arch-details">';
    h += `<div class="arch-detail-card"><h4>⚙️ Фреймворки</h4>${a.frameworks?.length ? '<ul>' + a.frameworks.map(f => `<li><code>${escHtml(f)}</code></li>`).join('') + '</ul>' : '<p class="arch-detail-empty">Не обнаружены</p>'}</div>`;
    h += `<div class="arch-detail-card"><h4>🔌 API / State</h4>${(a.apiEndpoints?.length || a.stateVars?.length) ? '<ul>' + (a.stateVars || []).map(v => `<li>🗂 <code>${escHtml(v)}</code></li>`).join('') + (a.apiEndpoints || []).map(e => `<li>🔗 <code>${escHtml(e)}</code></li>`).join('') + '</ul>' : '<p class="arch-detail-empty">Нет — данные в HTML</p>'}</div>`;
    h += `<div class="arch-detail-card"><h4>📊 DOM</h4><ul>
        <li>Элементов: <code>${a.domInfo?.totalElements || 0}</code></li>
        <li>Скриптов: <code>${a.domInfo?.scripts || 0}</code> (${((a.domInfo?.inlineScriptSize || 0) / 1024).toFixed(1)} KB)</li>
        <li>Картинок: <code>${a.domInfo?.images || 0}</code> Ссылок: <code>${a.domInfo?.links || 0}</code></li>
        <li>iframe: <code>${a.domInfo?.iframes || 0}</code> Форм: <code>${a.domInfo?.forms || 0}</code></li>
    </ul></div>`;
    if (a.protection?.cookies?.length) {
        h += `<div class="arch-detail-card"><h4>🍪 Cookies в JS</h4><ul>${a.protection.cookies.map(c => `<li><code>${escHtml(c)}</code></li>`).join('')}</ul></div>`;
    }
    h += '</div>';

    // Transport log
    if (data._transportLog?.length) {
        h += `<div class="arch-checklist" style="margin-top:20px"><h3>🔌 Транспорт (${data._transportLog.length})</h3><div class="transport-log">`;
        data._transportLog.forEach(e => { h += `<div class="transport-log-entry ${e.type}">[${e.time}] ${escHtml(e.message)}</div>`; });
        h += '</div></div>';
    }
    return h;
}

function genCorsBlock(data) {
    return `<div class="report-section cors-error-section"><div class="report-section-header">🛡️ Ошибка</div><div class="report-section-body">
        <div class="report-item"><span class="report-label">Тип:</span><span class="report-value error">${escHtml(data._error.type)}</span></div>
        <div class="report-item"><span class="report-label">Описание:</span><span class="report-value error">${escHtml(data._error.message)}</span></div>
        <div class="cors-help-box"><h4>💡 Решения</h4><ol><li>Worker в блоке сверху</li><li>Режим "Авто"</li><li><a href="https://github.com/Rob--W/cors-anywhere" target="_blank">cors-anywhere</a></li></ol></div>
    </div></div>`;
}

// ================================================================
// VISUAL REPORT
// ================================================================

function genVisual(data) {
    let h = '';
    if (data._error) h += genCorsBlock(data);
    if (data._summary) {
        const s = data._summary;
        h += `<div class="report-section"><div class="report-section-header">📋 Сводка</div><div class="report-section-body">
            <div class="report-item"><span class="report-label">URL:</span><span class="report-value">${escHtml(data._meta.analyzedUrl)}</span></div>
            <div class="report-item"><span class="report-label">Тип:</span><span class="report-value">${escHtml(s.siteTypeLabel)} (${s.siteType})</span></div>
            <div class="report-item"><span class="report-label">Сложность:</span><span class="report-value">${s.complexity}/5 — ${escHtml(s.complexityLabel)}</span></div>
            <div class="report-item"><span class="report-label">JS:</span><span class="report-value">${s.jsRequired === 'yes' ? '❌ Требуется' : s.jsRequired === 'partial' ? '⚠️ Частично' : '✅ Не нужен'}</span></div>
            <div class="report-item"><span class="report-label">Кодировка:</span><span class="report-value">${escHtml(s.encoding || 'N/A')}</span></div>
            <div class="report-item"><span class="report-label">Карточек:</span><span class="report-value">${s.videoCardsFound || 0}</span></div>
            <div class="report-item"><span class="report-label">Видео:</span><span class="report-value ${s.videoSourceFound ? '' : 'warning'}">${s.videoSourceFound ? '✅ ' + s.videoSourceMethods.join(',') : '❌'}</span></div>
        </div></div>`;
    }
    if (data.videoCards?.found) {
        const st = data.videoCards.structure;
        h += `<div class="report-section"><div class="report-section-header">🎬 Карточки</div><div class="report-section-body">
            ${st.title.css ? `<div class="report-item"><span class="report-label">Название:</span><span class="report-value"><span class="tag">${escHtml(st.title.css)}</span></span></div>` : ''}
            ${st.link.css ? `<div class="report-item"><span class="report-label">Ссылка:</span><span class="report-value"><span class="tag">${escHtml(st.link.css)}</span> → ${escHtml(st.link.pattern || '')}</span></div>` : ''}
            ${st.thumbnail.css ? `<div class="report-item"><span class="report-label">Превью:</span><span class="report-value"><span class="tag">${escHtml(st.thumbnail.css)}</span> (${escHtml(st.thumbnail.attribute)})</span></div>` : ''}
        </div></div>`;
        if (data.videoCards.sampleCards.length) {
            h += `<div class="report-section"><div class="report-section-header">📑 Примеры</div><div class="report-section-body">`;
            data.videoCards.sampleCards.forEach((c, i) => { h += `<div style="margin-bottom:10px;padding:8px;background:#0f0f23;border-radius:6px;font-size:13px;"><strong style="color:#00d4ff">#${i + 1}</strong> ${escHtml(c.title || '—')} ${c.duration ? '⏱' + escHtml(c.duration) : ''} ${c.quality ? '📺' + escHtml(c.quality) : ''}</div>`; });
            h += '</div></div>';
        }
    }
    if (data.sortCat?.categories?.found) {
        h += `<div class="report-section"><div class="report-section-header">📁 Категории (${data.sortCat.categories.totalCount})</div><div class="report-section-body" style="max-height:200px;overflow-y:auto">`;
        data.sortCat.categories.list.forEach(c => { h += `<span class="tag" style="margin:2px">${escHtml(c.name)}</span>`; });
        h += '</div></div>';
    }
    return h;
}

// ================================================================
// UI
// ================================================================

function syntaxHL(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, m => {
        let c = 'color:#ae81ff;'; if (/^"/.test(m)) c = /:$/.test(m) ? 'color:#a6e22e;' : 'color:#e6db74;';
        else if (/true|false/.test(m)) c = 'color:#66d9ef;'; else if (/null/.test(m)) c = 'color:#f92672;';
        return `<span style="${c}">${m}</span>`;
    });
}

function showTab(name) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
    const tab = document.getElementById('tab-' + name); if (tab) tab.classList.add('active');
    if (event?.target) event.target.classList.add('active');
}

function copyToClip(text) {
    navigator.clipboard.writeText(text).then(() => setStatus('📋 Скопировано!', 'success')).catch(() => {
        const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        setStatus('📋 Скопировано!', 'success');
    });
}

function copyResults() { if (analysisResult) copyToClip(JSON.stringify(analysisResult, null, 2)); }

function copyArchitecture() {
    if (!analysisResult) return;
    // Собираем только архитектурную аналитику
    const arch = {
        url: analysisResult._meta?.analyzedUrl,
        analyzedAt: analysisResult._meta?.analyzedAt,
        architecture: analysisResult.architecture,
        summary: analysisResult._summary,
        selectors: analysisResult.videoCards?.found ? analysisResult.videoCards.structure : null,
        cardSelector: analysisResult.videoCards?.cardSelector,
        cardXPath: analysisResult.videoCards?.cardXPath,
        sampleCards: analysisResult.videoCards?.sampleCards,
        pagination: analysisResult.pagination,
        search: analysisResult.search,
        sortingAndCategories: analysisResult.sortCat,
        videoPage: analysisResult.videoPage ? {
            urlPattern: analysisResult.videoPage.urlStructure,
            sources: analysisResult.videoPage.videoSources,
            relatedVideos: analysisResult.videoPage.relatedVideos,
            obfuscation: analysisResult.videoPage.obfuscation,
        } : null,
        encoding: analysisResult.encoding,
        transportLog: analysisResult._transportLog,
    };
    copyToClip(JSON.stringify(arch, null, 2));
    setStatus('🏗️ Архитектура скопирована в буфер!', 'success');
}

function onProxyChange() {
    const s = document.getElementById('proxySelect'), h = document.getElementById('proxyHint');
    if (!h || !s) return;
    const m = { 'auto': '🔄 Прямой → Worker → 6 прокси', '': '🔗 Только прямой', 'https://api.allorigins.win/raw?url=': '🌐 allorigins', 'https://corsproxy.io/?': '🌐 corsproxy', 'https://api.codetabs.com/v1/proxy?quest=': '🌐 codetabs', 'https://thingproxy.freeboard.io/fetch/': '🌐 thingproxy (raw URL)', 'https://cors-anywhere.herokuapp.com/': '🌐 cors-anywhere', 'https://cors.bridged.cc/': '🌐 cors.bridged' };
    h.textContent = m[s.value] || '';
}

document.addEventListener('DOMContentLoaded', () => {
    const ui = document.getElementById('targetUrl');
    if (DEFAULT_TARGET_URL && ui && !ui.value) ui.value = DEFAULT_TARGET_URL;
    if (ui) ui.addEventListener('keypress', e => { if (e.key === 'Enter') runFullAnalysis(); });
    const ps = document.getElementById('proxySelect'); if (ps) { ps.addEventListener('change', onProxyChange); onProxyChange(); }
    const wi = document.getElementById('workerUrl');
    if (wi) { const sv = localStorage.getItem('analyzerWorkerUrl'); if (sv) { wi.value = sv; updateWorkerStatus(true); }
        wi.addEventListener('input', () => updateWorkerStatus(!!wi.value.trim()));
        wi.addEventListener('change', () => { const v = wi.value.trim(); if (v) localStorage.setItem('analyzerWorkerUrl', v); else localStorage.removeItem('analyzerWorkerUrl'); });
    }
    const uaSel = document.getElementById('uaSelect'), uaCust = document.getElementById('uaCustom');
    if (uaSel && uaCust) { uaSel.addEventListener('change', () => { uaCust.style.display = uaSel.value === 'custom' ? 'block' : 'none'; }); }
});
