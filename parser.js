// ================================================================
// SITE STRUCTURE ANALYZER — parser.js v3.0
// Полный анализ + вкладка «Архитектура»
// ================================================================

const DEFAULT_TARGET_URL = "";

let analysisResult = null;
let transportLog = [];

function logTransport(message, type = 'info') {
    transportLog.push({ time: new Date().toLocaleTimeString(), message, type });
}

// ================================================================
// УТИЛИТЫ
// ================================================================

function setStatus(msg, type = 'loading') {
    const el = document.getElementById('status');
    if (el) { el.textContent = msg; el.className = 'status ' + type; }
}

function setProgress(pct, text, subtype) {
    const c = document.getElementById('progress-container');
    const b = document.getElementById('progress-bar');
    const t = document.getElementById('progress-text');
    if (!c) return;
    c.style.display = 'block';
    b.style.width = pct + '%';
    t.textContent = text || (pct + '%');
    b.classList.remove('cors-error', 'warning', 'worker');
    if (subtype) b.classList.add(subtype);
}

function getBaseUrl(u) { try { return new URL(u).origin; } catch { return ''; } }
function resolveUrl(h, b) { if (!h) return ''; try { return new URL(h, b).href; } catch { return h; } }
function uniqueArray(a) { return [...new Set(a.filter(Boolean))]; }
function escapeHtml(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = String(t); return d.innerHTML; }

// ================================================================
// WORKER
// ================================================================

function getWorkerUrl() {
    const i = document.getElementById('workerUrl');
    return i ? i.value.trim().replace(/\/$/, '') : '';
}

function updateWorkerStatus(has) {
    const b = document.getElementById('workerStatusBadge');
    if (!b) return;
    b.textContent = has ? '✦ Worker активен' : '○ Worker не задан';
    b.className = 'worker-badge ' + (has ? 'active' : 'inactive');
}

// ================================================================
// CORS INDICATOR
// ================================================================

function updateCorsIndicator(state, detail) {
    const el = document.getElementById('corsIndicator');
    if (!el) return;
    const map = {
        'trying-direct': ['🔗 Прямое подключение...', 'cors-indicator trying'],
        'direct-ok': ['✅ Прямое подключение — CORS разрешён', 'cors-indicator direct-ok'],
        'trying-worker': ['⚡ Cloudflare Worker...', 'cors-indicator trying'],
        'worker-ok': ['✅ Worker: ' + (detail || ''), 'cors-indicator worker-ok'],
        'cors-detected': ['🛡️ CORS-блокировка → прокси...', 'cors-indicator cors-blocked'],
        'trying-proxy': ['🔄 Прокси: ' + (detail || '') + '...', 'cors-indicator cors-blocked'],
        'proxy-ok': ['✅ Прокси: ' + (detail || ''), 'cors-indicator proxy-ok'],
        'all-failed': ['❌ Все методы заблокированы', 'cors-indicator all-failed'],
        'hidden': ['', 'cors-indicator']
    };
    const s = map[state] || map['hidden'];
    el.textContent = s[0]; el.className = s[1];
    el.style.display = state === 'hidden' ? 'none' : 'block';
}

// ================================================================
// ПРОКСИ-СПИСОК
// ================================================================

function getProxyList() {
    return [
        { name: 'allorigins.win', url: 'https://api.allorigins.win/raw?url=' },
        { name: 'corsproxy.io', url: 'https://corsproxy.io/?' },
        { name: 'codetabs.com', url: 'https://api.codetabs.com/v1/proxy?quest=' },
        { name: 'thingproxy', url: 'https://thingproxy.freeboard.io/fetch/' },
        { name: 'cors-anywhere', url: 'https://cors-anywhere.herokuapp.com/' },
        { name: 'cors.bridged', url: 'https://cors.bridged.cc/' }
    ];
}

function isCorsError(e) {
    if (!e) return false;
    const m = (e.message || '').toLowerCase();
    return m.includes('failed to fetch') || m.includes('networkerror') || m.includes('network error') ||
           m.includes('cors') || m.includes('load failed') || e.name === 'TypeError';
}

// ================================================================
// FETCH МЕТОДЫ
// ================================================================

async function fetchDirect(url) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 10000);
    try { const r = await fetch(url, { headers: { Accept: 'text/html,*/*' }, signal: ac.signal }); clearTimeout(t); if (!r.ok) throw new Error(`HTTP ${r.status}`); const h = await r.text(); if (!h || h.length < 50) throw new Error('Пустой ответ'); return h; } catch (e) { clearTimeout(t); throw e; }
}

async function fetchViaWorker(url) {
    const w = getWorkerUrl(); if (!w) throw new Error('Worker не задан');
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 15000);
    try { const r = await fetch(w + '/?url=' + encodeURIComponent(url), { headers: { Accept: 'text/html,*/*' }, signal: ac.signal }); clearTimeout(t); if (!r.ok) throw new Error(`Worker HTTP ${r.status}`); const h = await r.text(); if (!h || h.length < 50) throw new Error('Пусто'); return h; } catch (e) { clearTimeout(t); throw e; }
}

async function fetchViaProxy(url, prefix) {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 15000);
    const raw = prefix.includes('thingproxy') || prefix.includes('cors-anywhere') || prefix.includes('cors.bridged');
    try { const r = await fetch(raw ? prefix + url : prefix + encodeURIComponent(url), { headers: { Accept: 'text/html,*/*' }, signal: ac.signal }); clearTimeout(t); if (!r.ok) throw new Error(`HTTP ${r.status}`); const h = await r.text(); if (!h || h.length < 50) throw new Error('Пусто'); return h; } catch (e) { clearTimeout(t); throw e; }
}

// ================================================================
// КАСКАДНАЯ ЗАГРУЗКА
// ================================================================

async function fetchPage(url) {
    const sel = document.getElementById('proxySelect');
    const mode = sel ? sel.value : 'auto';
    const wUrl = getWorkerUrl();

    if (mode === '') {
        logTransport('Режим: прямой', 'info'); updateCorsIndicator('trying-direct');
        try { const h = await fetchDirect(url); logTransport('✅ Прямой OK', 'success'); updateCorsIndicator('direct-ok'); return h; }
        catch (e) { logTransport('❌ ' + e.message, 'fail'); if (isCorsError(e)) { updateCorsIndicator('all-failed'); throw new Error('🛡️ CORS-блокировка! Переключите на "Авто".'); } throw e; }
    }

    if (mode === 'auto') {
        // 1. Прямой
        try { logTransport('1/3 Прямой...', 'info'); updateCorsIndicator('trying-direct'); setProgress(12, '🔗 Прямой...'); const h = await fetchDirect(url); logTransport('✅ Прямой OK', 'success'); updateCorsIndicator('direct-ok'); return h; }
        catch (e) { logTransport(isCorsError(e) ? '🛡️ CORS' : '⚠️ ' + e.message, isCorsError(e) ? 'warning' : 'fail'); }
        // 2. Worker
        if (wUrl) {
            try { logTransport('2/3 Worker...', 'info'); updateCorsIndicator('trying-worker'); setProgress(14, '⚡ Worker...', 'worker'); const h = await fetchViaWorker(url); logTransport('✅ Worker OK', 'success'); updateCorsIndicator('worker-ok', wUrl); return h; }
            catch (e) { logTransport('❌ Worker: ' + e.message, 'fail'); }
        } else logTransport('2/3 Worker не задан', 'info');
        // 3. Прокси
        updateCorsIndicator('cors-detected'); setStatus('⚠️ CORS → перебор прокси...', 'loading');
        const proxies = getProxyList();
        for (let i = 0; i < proxies.length; i++) {
            const p = proxies[i];
            try { logTransport('3/3 ' + p.name + '...', 'info'); updateCorsIndicator('trying-proxy', p.name); setProgress(15 + i * 2, '🔄 ' + p.name + '...', 'warning'); const h = await fetchViaProxy(url, p.url); logTransport('✅ ' + p.name, 'success'); updateCorsIndicator('proxy-ok', p.name); return h; }
            catch (e) { logTransport('❌ ' + p.name + ': ' + e.message, 'fail'); }
        }
        updateCorsIndicator('all-failed'); setProgress(15, '❌ Все заблокированы', 'cors-error');
        throw new Error('❌ Все методы заблокированы.\n💡 Задайте Worker или разверните cors-anywhere.');
    }

    // Конкретный прокси
    if (wUrl) { try { logTransport('Worker...', 'info'); updateCorsIndicator('trying-worker'); const h = await fetchViaWorker(url); logTransport('✅ Worker OK', 'success'); updateCorsIndicator('worker-ok', wUrl); return h; } catch (e) { logTransport('Worker: ' + e.message, 'warning'); } }
    const pn = mode.replace(/https?:\/\//, '').split('/')[0];
    try { updateCorsIndicator('trying-proxy', pn); const h = await fetchViaProxy(url, mode); logTransport('✅ ' + pn, 'success'); updateCorsIndicator('proxy-ok', pn); return h; }
    catch (e) { logTransport('❌ ' + e.message, 'fail'); updateCorsIndicator('all-failed'); throw new Error('Прокси не сработал: ' + e.message); }
}

async function extractVideoUrlViaWorker(pageUrl) {
    const w = getWorkerUrl(); if (!w) return null;
    try { const r = await fetch(w + '/?url=' + encodeURIComponent(pageUrl) + '&mode=extract'); if (!r.ok) return null; const d = await r.json(); if (d.success && d.videoUrl) { logTransport('✅ Worker extract', 'success'); return d.videoUrl; } } catch (e) { logTransport('Worker extract: ' + e.message, 'fail'); }
    return null;
}

function parseHTML(h) { return new DOMParser().parseFromString(h, 'text/html'); }

// ================================================================
// НОВЫЕ АНАЛИЗАТОРЫ — для вкладки «Архитектура»
// ================================================================

function analyzeDomComplexity(doc) {
    const all = doc.querySelectorAll('*');
    const totalElements = all.length;
    const scripts = doc.querySelectorAll('script');
    const inlineScriptSize = Array.from(scripts).reduce((s, el) => s + (el.textContent || '').length, 0);
    const externalScripts = Array.from(scripts).filter(s => s.src).map(s => s.src);
    const stylesheets = Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(l => l.href);
    const images = doc.querySelectorAll('img').length;
    const links = doc.querySelectorAll('a[href]').length;
    const forms = doc.querySelectorAll('form').length;
    const iframes = doc.querySelectorAll('iframe').length;

    return { totalElements, scripts: scripts.length, inlineScriptSize, externalScripts: externalScripts.slice(0, 10), stylesheets: stylesheets.slice(0, 10), images, links, forms, iframes };
}

function analyzeJsFrameworks(doc, html) {
    const found = [];
    const allScript = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const combined = html + allScript;

    const checks = [
        { name: 'React', patterns: ['data-reactroot', 'data-reactid', '__REACT', 'react-app', 'ReactDOM', '_reactRootContainer'] },
        { name: 'Next.js', patterns: ['__NEXT_DATA__', '_next/static', 'next/router'] },
        { name: 'Vue.js', patterns: ['__vue__', 'Vue.component', 'v-cloak', 'data-v-', 'vue-app', 'createApp'] },
        { name: 'Nuxt.js', patterns: ['__NUXT__', '_nuxt/', 'nuxt-link'] },
        { name: 'Angular', patterns: ['ng-app', 'ng-controller', 'ng-version', 'angular.min.js', 'zone.js'] },
        { name: 'Svelte', patterns: ['__svelte', 'svelte-'] },
        { name: 'jQuery', patterns: ['jquery.min.js', 'jQuery', '$.fn.', 'jquery/'] },
        { name: 'WordPress', patterns: ['wp-content', 'wp-includes', 'wp-json'] },
        { name: 'Cloudflare', patterns: ['cf-browser-verification', 'cf_clearance', 'challenges.cloudflare.com', 'cf-ray'] },
        { name: 'DDoS-Guard', patterns: ['ddos-guard', 'ddg_'] },
        { name: 'JW Player', patterns: ['jwplayer', 'jwplayer.js', 'JWPlayer'] },
        { name: 'Video.js', patterns: ['video.js', 'videojs', 'video-js'] },
        { name: 'Flowplayer', patterns: ['flowplayer'] },
        { name: 'HLS.js', patterns: ['hls.js', 'Hls.', 'hls.min.js'] },
    ];

    for (const c of checks) {
        for (const p of c.patterns) {
            if (combined.includes(p)) { found.push(c.name); break; }
        }
    }
    return uniqueArray(found);
}

function analyzeApiEndpoints(doc, html) {
    const allScript = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const endpoints = [];

    // fetch/axios calls
    const fetchPatterns = [
        /fetch\s*\(\s*['"`](\/[^'"`]+)['"`]/gi,
        /axios\s*\.\s*(?:get|post)\s*\(\s*['"`](\/[^'"`]+)['"`]/gi,
        /\.ajax\s*\(\s*\{[^}]*url\s*:\s*['"`](\/[^'"`]+)['"`]/gi,
        /XMLHttpRequest[^;]*open\s*\(\s*['"`]\w+['"`]\s*,\s*['"`](\/[^'"`]+)['"`]/gi,
    ];

    for (const pat of fetchPatterns) {
        let m; while ((m = pat.exec(allScript)) !== null) {
            if (m[1] && m[1].length > 1) endpoints.push(m[1]);
        }
        pat.lastIndex = 0;
    }

    // URL patterns that look like API
    const apiUrlPat = /['"`]((?:\/api\/|\/v[12]\/|\/graphql|\/wp-json\/|\/rest\/)[^'"`]*?)['"`]/gi;
    let m2; while ((m2 = apiUrlPat.exec(allScript)) !== null) { if (m2[1]) endpoints.push(m2[1]); }

    // __NEXT_DATA__, __NUXT__, __INITIAL_STATE__ etc
    const stateVars = [];
    const statePats = [/__NEXT_DATA__/, /__NUXT__/, /__INITIAL_STATE__/, /__APP_STATE__/, /window\.__data/i];
    for (const p of statePats) { if (p.test(allScript)) stateVars.push(p.source.replace(/\\/g, '')); }

    return { endpoints: uniqueArray(endpoints).slice(0, 15), stateVars };
}

function analyzeProtection(doc, html) {
    const result = { cors: false, cloudflare: false, ddosGuard: false, recaptcha: false, ageGate: null, other: [] };
    const combined = html.toLowerCase();

    if (combined.includes('challenges.cloudflare.com') || combined.includes('cf-browser-verification') || combined.includes('cf_clearance'))
        result.cloudflare = true;
    if (combined.includes('ddos-guard') || combined.includes('ddg_'))
        result.ddosGuard = true;
    if (combined.includes('recaptcha') || combined.includes('g-recaptcha') || combined.includes('hcaptcha'))
        result.recaptcha = true;

    // Age gate detection
    const agePatterns = {
        selectors: [
            '#age-verify', '#age-gate', '#age-confirm', '.age-verify', '.age-gate',
            '.age-verification', '.disclaimer-popup', '.age-popup', '#disclaimer',
            '[class*="age-verif"]', '[class*="age-gate"]', '[class*="age-check"]',
            '[id*="age-verif"]', '[id*="age-gate"]', '[id*="age-check"]'
        ],
        textPatterns: [
            /(?:мне\s*(?:уже\s*)?(?:есть\s*)?18|i\s*am\s*(?:over\s*)?18|(?:enter|войти|enter\s*site))/i,
            /(?:подтвердить?\s*возраст|confirm\s*(?:your\s*)?age|age\s*verif)/i,
            /(?:18\+|21\+|старше\s*18|over\s*18|adults?\s*only)/i,
        ]
    };

    let ageGateFound = false;
    let ageGateType = null;
    let ageGateSelector = null;

    for (const sel of agePatterns.selectors) {
        try {
            const el = doc.querySelector(sel);
            if (el) { ageGateFound = true; ageGateSelector = sel; break; }
        } catch (e) {}
    }

    if (!ageGateFound) {
        const allText = doc.body ? doc.body.textContent : '';
        for (const pat of agePatterns.textPatterns) {
            if (pat.test(allText)) { ageGateFound = true; break; }
        }
    }

    if (ageGateFound) {
        // Determine type
        if (combined.includes('cookie') && (combined.includes('age') || combined.includes('disclaimer')))
            ageGateType = 'cookie';
        else if (combined.includes('location.href') || combined.includes('redirect') && combined.includes('age'))
            ageGateType = 'redirect';
        else if (doc.querySelector('[style*="position: fixed"], [style*="position:fixed"], .modal, .overlay, .popup'))
            ageGateType = 'css-overlay';
        else
            ageGateType = 'css-overlay'; // default assumption

        result.ageGate = {
            detected: true,
            type: ageGateType,
            selector: ageGateSelector,
            impact: ageGateType === 'css-overlay' ? 'low' : ageGateType === 'cookie' ? 'medium' : 'high',
            note: ageGateType === 'css-overlay'
                ? 'Контент уже в HTML — оверлей только визуальный, парсинг не затронут'
                : ageGateType === 'cookie'
                    ? 'Может потребоваться передача cookie для доступа к контенту'
                    : 'Серверный редирект — может потребоваться headless-браузер'
        };
    }

    return result;
}

function analyzeSiteArchitecture(doc, html, videoCards, videoPage, encoding, pagination, search, sorting, categories, protection, frameworks, apiInfo, domInfo) {
    // ── Определение типа ──
    let siteType = 'A'; // default: static HTML
    let siteTypeLabel = 'Статический HTML каталог';
    let siteTypeDesc = 'Страницы легко парсятся — все данные в HTML';

    const isEmptyDom = domInfo.totalElements < 100;
    const hasReactVueAngular = frameworks.some(f => ['React', 'Vue.js', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js'].includes(f));
    const hasApiEndpoints = apiInfo.endpoints.length > 0 || apiInfo.stateVars.length > 0;
    const hasHlsStream = videoPage?.videoSources?.sources?.some(s => s.type === 'HLS' || s.type === 'HLS (m3u8)');
    const hasIframePlayer = videoPage?.videoSources?.playerIframes?.length > 0;
    const cardsFound = videoCards?.found;
    const videoFound = videoPage?.videoSources?.found;

    if (isEmptyDom && hasReactVueAngular) {
        siteType = 'C'; siteTypeLabel = 'Dynamic JS (SPA)'; siteTypeDesc = 'Контент генерируется JavaScript — нужен headless-браузер или реверс API';
    } else if (!isEmptyDom && hasApiEndpoints && !cardsFound) {
        siteType = 'B'; siteTypeLabel = 'JSON API сайт'; siteTypeDesc = 'Данные загружаются через API — нужен API sniffing';
    } else if (hasHlsStream && !cardsFound) {
        siteType = 'D'; siteTypeLabel = 'Стриминг / Webcam'; siteTypeDesc = 'Live video через HLS — нужен stream extractor';
    } else if (cardsFound && (hasIframePlayer || hasReactVueAngular || hasApiEndpoints)) {
        siteType = 'E'; siteTypeLabel = 'Гибрид'; siteTypeDesc = 'Каталог статический, плеер/данные через JS или iframe';
    }

    // ── Расчёт сложности ──
    let complexity = 1.0;
    const complexityFactors = [];

    if (cardsFound) { complexity -= 0.5; complexityFactors.push({ text: 'Карточки в HTML', effect: -0.5 }); }
    else { complexity += 1.5; complexityFactors.push({ text: 'Карточки не найдены в DOM', effect: +1.5 }); }

    if (videoFound) {
        const methods = videoPage?.videoSources?.methods || [];
        if (methods.includes('video_tag')) { complexityFactors.push({ text: 'Видео в <video> теге', effect: -0.3 }); complexity -= 0.3; }
        else if (methods.includes('javascript') || methods.includes('local_pattern')) { complexityFactors.push({ text: 'Видео в JS-переменной', effect: +0.3 }); complexity += 0.3; }
        else if (methods.includes('worker_extract')) { complexityFactors.push({ text: 'Видео через Worker extract', effect: +0.5 }); complexity += 0.5; }
    } else { complexity += 1.0; complexityFactors.push({ text: 'Видео-URL не найден', effect: +1.0 }); }

    if (hasIframePlayer) { complexity += 0.5; complexityFactors.push({ text: 'Плеер в iframe', effect: +0.5 }); }
    if (isEmptyDom) { complexity += 1.5; complexityFactors.push({ text: 'DOM почти пустой (SPA)', effect: +1.5 }); }
    if (hasReactVueAngular) { complexity += 0.5; complexityFactors.push({ text: 'JS-фреймворк: ' + frameworks.filter(f => ['React','Vue.js','Angular','Next.js','Nuxt.js'].includes(f)).join(', '), effect: +0.5 }); }
    if (protection.cloudflare) { complexity += 1.0; complexityFactors.push({ text: 'Cloudflare защита', effect: +1.0 }); }
    if (protection.ddosGuard) { complexity += 0.8; complexityFactors.push({ text: 'DDoS-Guard', effect: +0.8 }); }
    if (protection.recaptcha) { complexity += 1.0; complexityFactors.push({ text: 'reCAPTCHA/hCaptcha', effect: +1.0 }); }
    if (protection.ageGate?.detected && protection.ageGate.type !== 'css-overlay') { complexity += 0.5; complexityFactors.push({ text: 'Возрастной гейт (' + protection.ageGate.type + ')', effect: +0.5 }); }

    // Clamp 1-5
    const level = Math.max(1, Math.min(5, Math.round(complexity)));

    const levelLabels = {
        1: 'Элементарно', 2: 'Просто', 3: 'Средне', 4: 'Сложно', 5: 'Очень сложно'
    };

    // ── Рекомендации ──
    let recMethod = 'CSS-селекторы';
    let recTools = 'Cheerio / BeautifulSoup + requests';
    let recTransport = 'Прямой запрос';
    let recNotes = [];

    if (siteType === 'B') { recMethod = 'API sniffing + JSON parsing'; recTools = 'requests / fetch + JSON.parse'; recNotes.push('Перехватите API-запросы в DevTools → Network'); }
    else if (siteType === 'C') { recMethod = 'Headless browser'; recTools = 'Puppeteer / Playwright'; recTransport = 'Headless Chrome'; recNotes.push('Сайт рендерится на клиенте — нужен полноценный браузер'); }
    else if (siteType === 'D') { recMethod = 'Stream extractor'; recTools = 'youtube-dl / yt-dlp / ffmpeg'; recNotes.push('HLS-потоки извлекаются через m3u8 манифест'); }
    else if (siteType === 'E') {
        recMethod = 'CSS-селекторы + JS regex'; recTools = 'Cheerio + regex для видео-URL';
        if (hasIframePlayer) recNotes.push('Видео через iframe — нужен доп. запрос к URL iframe');
    }

    if (protection.cloudflare || protection.ddosGuard) { recTransport = 'Cloudflare Worker или Puppeteer + stealth'; recNotes.push('Сайт за анти-DDoS — обычные прокси могут не работать'); }
    else if (level >= 3) { recTransport = 'CORS-прокси или Worker'; }
    else { recTransport = 'Прокси достаточно (или прямой)'; }

    return {
        siteType, siteTypeLabel, siteTypeDesc,
        complexity: level,
        complexityLabel: levelLabels[level],
        complexityRaw: parseFloat(complexity.toFixed(1)),
        complexityFactors,
        recommendation: { method: recMethod, tools: recTools, transport: recTransport, notes: recNotes },
        frameworks, apiEndpoints: apiInfo.endpoints, stateVars: apiInfo.stateVars,
        protection, domInfo,
    };
}

// ================================================================
// СТАНДАРТНЫЕ АНАЛИЗАТОРЫ
// ================================================================

function analyzeEncoding(doc, html) {
    const mc = doc.querySelector('meta[charset]');
    const mct = doc.querySelector('meta[http-equiv="Content-Type"]');
    let cs = 'Не определено';
    if (mc) cs = mc.getAttribute('charset');
    else if (mct) { const m = (mct.getAttribute('content') || '').match(/charset=([^\s;]+)/i); if (m) cs = m[1]; }
    return { charset: cs.toUpperCase(), source: mc ? '<meta charset>' : mct ? '<meta http-equiv>' : 'не найдено', hasUtf8Bom: html.charCodeAt(0) === 0xFEFF };
}

function analyzePagination(doc, baseUrl, targetUrl) {
    const result = { mainPageUrl: targetUrl, pagination: { found: false, type: null, pattern: null, examples: [], selectors: [] } };
    const sels = ['.pagination a', '.pager a', '.pages a', '.page-numbers a', 'nav.pagination a', '.paginator a', '.page-nav a', 'ul.pagination a', '.wp-pagenavi a', 'a.page-link', '.paging a', '[class*="pagination"] a'];
    let pLinks = [], matched = '';
    for (const s of sels) { try { const l = doc.querySelectorAll(s); if (l.length > 0) { matched = s; l.forEach(a => { const h = a.getAttribute('href'); if (h) pLinks.push(h); }); break; } } catch (e) {} }
    if (!pLinks.length) { doc.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href') || '', t = a.textContent.trim(); if (/[?&]page=\d+/i.test(h) || /\/page\/\d+/i.test(h) || /[?&]p=\d+/i.test(h) || (/\/\d+\/?$/.test(h) && /^\d+$/.test(t))) pLinks.push(h); }); if (pLinks.length) matched = 'a (паттерн)'; }
    if (pLinks.length) {
        result.pagination.found = true; result.pagination.selectors.push(matched);
        result.pagination.examples = uniqueArray(pLinks.map(h => resolveUrl(h, baseUrl))).slice(0, 10);
        const s0 = pLinks[0];
        if (/[?&]page=\d+/i.test(s0)) { result.pagination.type = 'query_parameter'; result.pagination.pattern = '?page=N'; }
        else if (/\/page\/\d+/i.test(s0)) { result.pagination.type = 'path_segment'; result.pagination.pattern = '/page/N/'; }
        else { result.pagination.type = 'other'; result.pagination.pattern = s0; }
    }
    return result;
}

function analyzeSearch(doc, baseUrl) {
    const result = { found: false, forms: [], searchUrl: null, searchPattern: null };
    doc.querySelectorAll('form').forEach(form => {
        const action = form.getAttribute('action') || '';
        const inputs = form.querySelectorAll('input');
        let hasSI = false, details = [];
        inputs.forEach(i => { const ty = (i.getAttribute('type') || 'text').toLowerCase(), nm = i.getAttribute('name') || '', ph = i.getAttribute('placeholder') || '';
            if (ty === 'search' || nm.match(/^(q|query|search|s|keyword|k|find)$/i) || ph.match(/(поиск|search|найти)/i)) hasSI = true;
            details.push({ type: ty, name: nm, placeholder: ph }); });
        if (hasSI || action.match(/(search|find)/i)) { result.found = true; result.forms.push({ action: resolveUrl(action, baseUrl), method: (form.getAttribute('method') || 'GET').toUpperCase(), inputs: details }); }
    });
    if (result.forms.length) { const f = result.forms[0], si = f.inputs.find(i => i.name.match(/^(q|query|search|s|keyword|k)$/i)), p = si ? si.name : 'q'; result.searchPattern = f.method === 'GET' ? `${f.action}?${p}={запрос}` : `POST ${f.action} (${p}={запрос})`; result.searchUrl = f.action; }
    return result;
}

function analyzeSortingAndCategories(doc, baseUrl) {
    const result = { sorting: { found: false, options: [] }, categories: { found: false, list: [] } };
    for (const s of ['select[name*="sort"]', '[class*="sort"] a', '.sorting a', 'a[href*="sort="]', 'a[href*="order="]', '[class*="tabs"] a']) {
        try { const els = doc.querySelectorAll(s); els.forEach(el => { if (el.tagName === 'SELECT') { el.querySelectorAll('option').forEach(o => result.sorting.options.push({ label: o.textContent.trim(), value: o.value })); result.sorting.found = true; } else if (el.tagName === 'A') { const h = el.getAttribute('href'); if (h) { result.sorting.options.push({ label: el.textContent.trim(), url: resolveUrl(h, baseUrl) }); result.sorting.found = true; } } }); if (result.sorting.found) break; } catch (e) {}
    }
    if (!result.sorting.found) { const sp = /(sort|order|popular|rating|newest|latest|longest|viewed|top)/i; doc.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href') || '', t = a.textContent.trim(); if (sp.test(h) && t.length > 0 && t.length < 50) { result.sorting.options.push({ label: t, url: resolveUrl(h, baseUrl) }); result.sorting.found = true; } }); }
    const seen = new Set(); result.sorting.options = result.sorting.options.filter(o => { const k = o.label + (o.url || o.value || ''); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 20);
    const catLinks = [];
    for (const s of ['.categories a', '.category-list a', '.cats a', '.tags a', '[class*="categor"] a', 'a[href*="/categories/"]', 'a[href*="/category/"]', 'a[href*="/tags/"]']) { try { const l = doc.querySelectorAll(s); if (l.length >= 3) { l.forEach(a => { const h = a.getAttribute('href'), t = a.textContent.trim(); if (h && t && t.length < 100) catLinks.push({ name: t, url: resolveUrl(h, baseUrl) }); }); break; } } catch (e) {} }
    if (catLinks.length) { result.categories.found = true; const sc = new Set(); result.categories.list = catLinks.filter(c => { if (sc.has(c.url)) return false; sc.add(c.url); return true; }).slice(0, 50); result.categories.totalCount = result.categories.list.length; }
    return result;
}

function analyzeVideoCards(doc, baseUrl) {
    const result = { found: false, cardSelector: null, totalCardsFound: 0, structure: { title: { selector: null, example: null }, link: { selector: null, example: null, pattern: null }, thumbnail: { selector: null, example: null, attribute: null }, duration: { selector: null, example: null }, quality: { selector: null, example: null } }, sampleCards: [] };
    const cSels = ['.video-item', '.video-card', '.thumb-item', '.thumb', '.video-thumb', '.video_block', '.video-block', '.item', '.video', '.clip', '.gallery-item', 'article', '.post', '.list-item', '.grid-item', '[data-video-id]', '[data-id]', '.card'];
    let cards = [], uSel = '';
    for (const s of cSels) { try { const f = doc.querySelectorAll(s); if (f.length >= 2 && Array.from(f).some(e => e.querySelector('a[href]')) && Array.from(f).some(e => e.querySelector('img'))) { cards = Array.from(f); uSel = s; break; } } catch (e) {} }
    if (!cards.length) { const p = []; doc.querySelectorAll('div,li,article').forEach(d => { if (d.querySelectorAll(':scope>img,:scope>a>img,:scope>div>img').length >= 1 && d.querySelectorAll(':scope>a[href]').length >= 1 && d.querySelectorAll('a[href]').length < 10) p.push(d); }); if (p.length >= 3) { cards = p; uSel = 'auto'; } }
    if (!cards.length) return result;
    result.found = true; result.cardSelector = uSel; result.totalCardsFound = cards.length;
    for (let i = 0; i < Math.min(5, cards.length); i++) {
        const card = cards[i], cd = {};
        for (const ts of ['h1','h2','h3','h4','h5','.title','.name','.video-title','a[title]','[class*="title"]','strong']) { try { const el = card.querySelector(ts); if (el) { const t = el.textContent.trim(); if (t.length > 2 && t.length < 300) { cd.title = t; if (i === 0) { result.structure.title.selector = `${uSel} ${ts}`; result.structure.title.example = t; } break; } } } catch (e) {} }
        if (!cd.title) { const a = card.querySelector('a[title]'); if (a) cd.title = a.getAttribute('title'); }
        const lk = card.querySelector('a[href]');
        if (lk) { cd.link = resolveUrl(lk.getAttribute('href'), baseUrl); if (i === 0) { result.structure.link.selector = `${uSel} a[href]`; result.structure.link.example = cd.link; try { result.structure.link.pattern = new URL(cd.link).pathname.replace(/\/\d+\//g, '/{id}/').replace(/\/\d+$/, '/{id}').replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/'); } catch (e) {} } }
        const img = card.querySelector('img');
        if (img) { for (const at of ['data-src','data-original','data-lazy-src','data-thumb','src']) { const sv = img.getAttribute(at); if (sv && !sv.startsWith('data:') && sv) { cd.thumbnail = resolveUrl(sv, baseUrl); if (i === 0) { result.structure.thumbnail.selector = `${uSel} img`; result.structure.thumbnail.attribute = at; result.structure.thumbnail.example = cd.thumbnail; } break; } } }
        for (const ds of ['.duration','.time','.video-time','[class*="duration"]','[class*="time"]']) { try { const el = card.querySelector(ds); if (el) { const t = el.textContent.trim(); if (/\d{1,2}:\d{2}/.test(t)) { cd.duration = t; if (i === 0) { result.structure.duration.selector = `${uSel} ${ds}`; result.structure.duration.example = t; } break; } } } catch (e) {} }
        if (!cd.duration) { for (const el of card.querySelectorAll('span,div,small')) { const t = el.textContent.trim(); if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) { cd.duration = t; break; } } }
        for (const qs of ['.quality','.hd','[class*="quality"]','[class*="hd"]']) { try { const el = card.querySelector(qs); if (el) { const t = el.textContent.trim(); if (/\b(HD|FHD|4K|1080|720|SD)\b/i.test(t)) { cd.quality = t; if (i === 0) { result.structure.quality.selector = `${uSel} ${qs}`; result.structure.quality.example = t; } break; } } } catch (e) {} }
        result.sampleCards.push(cd);
    }
    return result;
}

async function analyzeVideoPage(videoUrl, baseUrl) {
    const result = { analyzed: false, videoUrl, urlStructure: { pattern: null, example: videoUrl }, videoSources: { found: false, sources: [], methods: [] }, relatedVideos: { found: false, selector: null, count: 0 } };
    if (!videoUrl) return result;
    try {
        setStatus('📥 Видео-страница...', 'loading'); setProgress(82, 'Видео-страница...');
        const html = await fetchPage(videoUrl);
        const doc = parseHTML(html); result.analyzed = true;
        try { result.urlStructure.pattern = new URL(videoUrl).pathname.replace(/\/\d+\//g, '/{id}/').replace(/\/\d+$/, '/{id}').replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/'); } catch (e) {}
        result.pageTitle = doc.title || null; const h1 = doc.querySelector('h1'); if (h1) result.videoTitle = h1.textContent.trim();
        doc.querySelectorAll('video, video source').forEach(v => { const s = v.getAttribute('src') || v.getAttribute('data-src'); if (s) { result.videoSources.sources.push({ type: s.includes('.m3u8') ? 'HLS (m3u8)' : s.includes('.mp4') ? 'MP4' : 'unknown', url: resolveUrl(s, baseUrl), foundIn: '<video> tag' }); result.videoSources.found = true; result.videoSources.methods.push('video_tag'); } });
        const allScript = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
        for (const pat of [/["'](?:file|src|source|video_url|mp4|hls)["']\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8|webm)[^"']*?)["']/gi, /(?:https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8|webm)(?:\?[^\s"'<>]*)?)/gi]) { let m; while ((m = pat.exec(allScript)) !== null) { const u = (m[1] || m[0]).replace(/\\/g, ''); if (u.match(/\.(mp4|m3u8|webm)/)) { result.videoSources.sources.push({ type: u.includes('.m3u8') ? 'HLS (m3u8)' : u.includes('.mp4') ? 'MP4' : 'WebM', url: u, foundIn: 'JavaScript' }); result.videoSources.found = true; result.videoSources.methods.push('javascript'); } } pat.lastIndex = 0; }
        doc.querySelectorAll('meta[property="og:video"],meta[property="og:video:url"]').forEach(m => { const u = m.getAttribute('content'); if (u) { result.videoSources.sources.push({ type: u.includes('.m3u8') ? 'HLS (m3u8)' : 'MP4', url: resolveUrl(u, baseUrl), foundIn: 'og:meta' }); result.videoSources.found = true; result.videoSources.methods.push('meta_tag'); } });
        const pIframes = []; doc.querySelectorAll('iframe[src],iframe[data-src]').forEach(f => { const s = f.getAttribute('src') || f.getAttribute('data-src'); if (s && (s.includes('player') || s.includes('embed') || s.includes('video'))) pIframes.push({ src: resolveUrl(s, baseUrl) }); }); if (pIframes.length) { result.videoSources.playerIframes = pIframes; result.videoSources.methods.push('iframe'); }
        const we = await extractVideoUrlViaWorker(videoUrl); if (we) { result.videoSources.sources.push({ type: we.includes('.m3u8') ? 'HLS (m3u8)' : 'MP4', url: we, foundIn: 'Worker extract ✦' }); result.videoSources.found = true; result.videoSources.methods.push('worker_extract'); }
        if (!result.videoSources.found) { for (const p of [/["'](https?:\/\/[^"']+\.mp4[^"']*)['"]/i, /["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/i]) { const m = html.match(p); if (m && m[1]) { result.videoSources.sources.push({ type: m[1].includes('.m3u8') ? 'HLS (m3u8)' : 'MP4', url: m[1], foundIn: 'pattern' }); result.videoSources.found = true; result.videoSources.methods.push('local_pattern'); break; } } }
        const ss = new Set(); result.videoSources.sources = result.videoSources.sources.filter(s => { if (ss.has(s.url)) return false; ss.add(s.url); return true; }); result.videoSources.methods = uniqueArray(result.videoSources.methods);
        for (const sel of ['.related','.related-videos','.similar','.recommended','#related','[class*="related"]']) { try { const el = doc.querySelector(sel); if (el) { const rl = el.querySelectorAll('a[href]'); if (rl.length) { result.relatedVideos = { found: true, selector: sel, count: rl.length, sampleLinks: Array.from(rl).slice(0, 5).map(a => ({ text: a.textContent.trim().substring(0, 100), href: resolveUrl(a.getAttribute('href'), baseUrl) })) }; break; } } } catch (e) {} }
    } catch (err) { result.error = isCorsError(err) ? '🛡️ CORS на видео-странице' : err.message; if (isCorsError(err)) setProgress(85, '🛡️ CORS: видео заблокировано', 'cors-error'); }
    return result;
}

function analyzeMeta(doc) {
    const m = { title: doc.title, description: null, keywords: null, ogTitle: null, ogImage: null, language: null, generator: null };
    const d = doc.querySelector('meta[name="description"]'); if (d) m.description = d.getAttribute('content');
    const k = doc.querySelector('meta[name="keywords"]'); if (k) m.keywords = k.getAttribute('content');
    const ot = doc.querySelector('meta[property="og:title"]'); if (ot) m.ogTitle = ot.getAttribute('content');
    const oi = doc.querySelector('meta[property="og:image"]'); if (oi) m.ogImage = oi.getAttribute('content');
    const l = doc.documentElement.getAttribute('lang'); if (l) m.language = l;
    const g = doc.querySelector('meta[name="generator"]'); if (g) m.generator = g.getAttribute('content');
    return m;
}

// ================================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ================================================================

async function runFullAnalysis() {
    const ui = document.getElementById('targetUrl');
    const targetUrl = (ui ? ui.value.trim() : '') || DEFAULT_TARGET_URL;
    if (!targetUrl) { setStatus('❌ Введите URL!', 'error'); return; }
    try { new URL(targetUrl); } catch { setStatus('❌ Некорректный URL!', 'error'); return; }
    if (ui) ui.value = targetUrl;
    const baseUrl = getBaseUrl(targetUrl), wUrl = getWorkerUrl();
    const btn = document.getElementById('btnAnalyze');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Анализирую...'; }
    document.getElementById('results').style.display = 'none';
    updateCorsIndicator('hidden'); updateWorkerStatus(!!wUrl); transportLog = [];
    const pb = document.getElementById('progress-bar'); if (pb) pb.classList.remove('cors-error', 'warning', 'worker');

    analysisResult = { _meta: { analyzedUrl: targetUrl, baseUrl, analyzedAt: new Date().toISOString(), workerUsed: wUrl || 'нет', proxyMode: document.getElementById('proxySelect')?.value || 'auto', tool: 'Site Structure Analyzer v3.0' } };

    try {
        setStatus('📥 Загрузка...', 'loading'); setProgress(10, '📡 Подключение...');
        let html;
        try { html = await fetchPage(targetUrl); } catch (e) {
            const cors = isCorsError(e);
            setProgress(10, cors ? '❌ CORS!' : '❌ ' + e.message.substring(0, 50), 'cors-error');
            setStatus('❌ ' + e.message, 'error');
            analysisResult._error = { type: cors ? 'CORS' : 'FETCH', message: e.message, suggestion: cors ? 'Задайте Worker или Авто-режим' : 'Проверьте URL' };
            analysisResult._transportLog = transportLog;
            displayResults(analysisResult); return;
        }
        const doc = parseHTML(html);
        setProgress(20, '✅ Загружено'); setStatus(`✅ ${(html.length / 1024).toFixed(1)} KB`, 'success');

        setProgress(22, 'DOM...'); const domInfo = analyzeDomComplexity(doc);
        setProgress(25, 'Кодировка...'); analysisResult.encoding = analyzeEncoding(doc, html);
        setProgress(28, 'Мета...'); analysisResult.siteMetaInfo = analyzeMeta(doc);
        setProgress(32, 'Фреймворки...'); const frameworks = analyzeJsFrameworks(doc, html);
        setProgress(36, 'API эндпоинты...'); const apiInfo = analyzeApiEndpoints(doc, html);
        setProgress(40, 'Защита...'); const protection = analyzeProtection(doc, html);
        setProgress(45, 'Пагинация...'); analysisResult.mainPageAndPagination = analyzePagination(doc, baseUrl, targetUrl);
        setProgress(50, 'Поиск...'); analysisResult.search = analyzeSearch(doc, baseUrl);
        setProgress(60, 'Сортировка/категории...'); analysisResult.sortingAndCategories = analyzeSortingAndCategories(doc, baseUrl);
        setProgress(70, 'Карточки...'); analysisResult.videoCards = analyzeVideoCards(doc, baseUrl);

        setProgress(80, 'Видео-страница...');
        let svUrl = null;
        if (analysisResult.videoCards.sampleCards?.length) svUrl = analysisResult.videoCards.sampleCards[0].link;
        analysisResult.videoPage = svUrl ? await analyzeVideoPage(svUrl, baseUrl) : { analyzed: false, note: 'Нет ссылок' };

        setProgress(90, 'Архитектура...');
        analysisResult.architecture = analyzeSiteArchitecture(
            doc, html,
            analysisResult.videoCards, analysisResult.videoPage,
            analysisResult.encoding,
            analysisResult.mainPageAndPagination, analysisResult.search,
            analysisResult.sortingAndCategories?.sorting,
            analysisResult.sortingAndCategories?.categories,
            protection, frameworks, apiInfo, domInfo
        );

        setProgress(95, 'Отчёт...');
        analysisResult._summary = {
            siteType: analysisResult.architecture.siteType,
            siteTypeLabel: analysisResult.architecture.siteTypeLabel,
            complexity: analysisResult.architecture.complexity,
            complexityLabel: analysisResult.architecture.complexityLabel,
            encoding: analysisResult.encoding.charset,
            hasPagination: analysisResult.mainPageAndPagination.pagination.found,
            paginationPattern: analysisResult.mainPageAndPagination.pagination.pattern,
            hasSearch: analysisResult.search.found,
            searchPattern: analysisResult.search.searchPattern,
            hasSorting: analysisResult.sortingAndCategories.sorting.found,
            hasCategories: analysisResult.sortingAndCategories.categories.found,
            categoriesCount: analysisResult.sortingAndCategories.categories.totalCount || 0,
            videoCardsFound: analysisResult.videoCards.totalCardsFound,
            videoSourceFound: analysisResult.videoPage.videoSources?.found || false,
            videoSourceMethods: analysisResult.videoPage.videoSources?.methods || [],
            frameworks, protection: { cloudflare: protection.cloudflare, ddosGuard: protection.ddosGuard, recaptcha: protection.recaptcha, ageGate: !!protection.ageGate?.detected },
        };
        analysisResult._transportLog = transportLog;
        displayResults(analysisResult);
        setProgress(100, '✅ Готово!'); setStatus('✅ Анализ завершён!', 'success');
    } catch (err) {
        setStatus('❌ ' + err.message, 'error'); analysisResult._transportLog = transportLog; displayResults(analysisResult);
    } finally { if (btn) { btn.disabled = false; btn.textContent = '🚀 Полный анализ'; } }
}

// ================================================================
// ОТОБРАЖЕНИЕ
// ================================================================

function displayResults(data) {
    document.getElementById('results').style.display = 'block';
    const json = JSON.stringify(data, null, 2);
    document.getElementById('jsonFormatted').innerHTML = syntaxHighlight(json);
    document.getElementById('jsonRaw').value = json;
    document.getElementById('visualReport').innerHTML = generateVisualReport(data);
    document.getElementById('archReport').innerHTML = generateArchReport(data);
    document.getElementById('btnCopy').disabled = false;
    document.getElementById('btnDownload').disabled = false;
}

// ================================================================
// АРХИТЕКТУРА — РЕНДЕР ВКЛАДКИ
// ================================================================

function generateArchReport(data) {
    if (!data.architecture) {
        if (data._error) return generateCorsErrorBlock(data);
        return '<p style="color:#555;">Данные архитектуры недоступны</p>';
    }

    const a = data.architecture;
    const lvl = a.complexity;
    const lvlColor = ['', 'level-1-color', 'level-2-color', 'level-3-color', 'level-4-color', 'level-5-color'][lvl];
    const lvlClass = 'level-' + lvl;

    let html = '';

    // ── Диагноз ──
    html += `<div class="arch-diagnosis">
        <div class="arch-diagnosis-main ${lvlClass}">
            <span class="arch-type-badge arch-type-${a.siteType}">Тип ${a.siteType}</span>
            <div class="arch-site-type">${escapeHtml(a.siteTypeLabel)}</div>
            <div class="arch-site-desc">${escapeHtml(a.siteTypeDesc)}</div>
            <div style="margin-top:10px;">
                <table style="font-size:13px;color:#aaa;border-collapse:collapse;width:100%;">
                    <thead><tr><th style="text-align:left;color:#666;padding:4px 8px;border-bottom:1px solid #222;">Фактор</th><th style="text-align:right;color:#666;padding:4px 8px;border-bottom:1px solid #222;">Влияние</th></tr></thead>
                    <tbody>${a.complexityFactors.map(f => `<tr><td style="padding:3px 8px;">${escapeHtml(f.text)}</td><td style="text-align:right;padding:3px 8px;color:${f.effect > 0 ? '#ff6666' : '#66ff66'};">${f.effect > 0 ? '+' : ''}${f.effect}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>
        <div class="arch-complexity">
            <div class="complexity-gauge">
                <div class="complexity-gauge-bg"></div>
                <span class="complexity-number ${lvlColor}">${lvl}/5</span>
            </div>
            <div class="complexity-label ${lvlColor}">${escapeHtml(a.complexityLabel)}</div>
            <div class="complexity-sublabel">Сложность парсинга</div>
        </div>
    </div>`;

    // ── Рекомендации ──
    const rec = a.recommendation;
    html += `<div class="arch-recommendations">
        <h3>🔧 Рекомендуемый стек</h3>
        <div class="arch-rec-grid">
            <span class="arch-rec-label">📦 Метод:</span><span class="arch-rec-value"><code>${escapeHtml(rec.method)}</code></span>
            <span class="arch-rec-label">🛠 Инструменты:</span><span class="arch-rec-value"><code>${escapeHtml(rec.tools)}</code></span>
            <span class="arch-rec-label">🔗 Транспорт:</span><span class="arch-rec-value">${escapeHtml(rec.transport)}</span>
            ${rec.notes.map(n => `<span class="arch-rec-label">⚠️ Замечание:</span><span class="arch-rec-value warn">${escapeHtml(n)}</span>`).join('')}
        </div>
    </div>`;

    // ── Чеклист ──
    const s = data._summary || {};
    const checks = [
        { icon: '📄', label: 'Каталог (HTML)', value: data.videoCards?.found ? `✅ ${data.videoCards.totalCardsFound} карточек` : '❌ Не найден', cls: data.videoCards?.found ? 'ok' : 'fail' },
        { icon: '📑', label: 'Пагинация', value: s.hasPagination ? `✅ ${s.paginationPattern}` : '❌', cls: s.hasPagination ? 'ok' : 'fail' },
        { icon: '🔍', label: 'Поиск', value: s.hasSearch ? '✅ Найден' : '❌', cls: s.hasSearch ? 'ok' : 'fail' },
        { icon: '📁', label: 'Категории', value: s.hasCategories ? `✅ ${s.categoriesCount} шт.` : '❌', cls: s.hasCategories ? 'ok' : 'fail' },
        { icon: '🔄', label: 'Сортировка', value: s.hasSorting ? '✅' : '❌', cls: s.hasSorting ? 'ok' : 'fail' },
        { icon: '▶️', label: 'Видео-URL', value: s.videoSourceFound ? `✅ (${(s.videoSourceMethods || []).join(', ')})` : '❌ Не найден', cls: s.videoSourceFound ? 'ok' : 'fail' },
        { icon: '🌐', label: 'API эндпоинты', value: a.apiEndpoints?.length ? `⚠️ ${a.apiEndpoints.length} шт.` : '— нет', cls: a.apiEndpoints?.length ? 'warn' : 'neutral' },
        { icon: '📊', label: 'DOM элементов', value: a.domInfo?.totalElements || '?', cls: (a.domInfo?.totalElements || 0) < 100 ? 'warn' : 'ok' },
        { icon: '📜', label: 'JS в HTML', value: `${((a.domInfo?.inlineScriptSize || 0) / 1024).toFixed(0)} KB (${a.domInfo?.scripts || 0} скриптов)`, cls: 'neutral' },
        { icon: '🛡️', label: 'Cloudflare', value: a.protection?.cloudflare ? '⚠️ Обнаружен' : '— нет', cls: a.protection?.cloudflare ? 'warn' : 'neutral' },
        { icon: '🛡️', label: 'DDoS-Guard', value: a.protection?.ddosGuard ? '⚠️ Обнаружен' : '— нет', cls: a.protection?.ddosGuard ? 'warn' : 'neutral' },
        { icon: '🤖', label: 'CAPTCHA', value: a.protection?.recaptcha ? '❌ Есть' : '— нет', cls: a.protection?.recaptcha ? 'fail' : 'neutral' },
    ];

    html += `<div class="arch-checklist"><h3>✅ Что найдено / не найдено</h3><div class="arch-checklist-grid">`;
    checks.forEach(c => {
        html += `<div class="arch-check-item"><span class="arch-check-icon">${c.icon}</span><span class="arch-check-label">${escapeHtml(c.label)}</span><span class="arch-check-value ${c.cls}">${c.value}</span></div>`;
    });
    html += `</div></div>`;

    // ── Age Gate ──
    if (a.protection?.ageGate?.detected) {
        const ag = a.protection.ageGate;
        html += `<div class="arch-age-gate">
            <h4>🔞 Возрастной гейт обнаружен <span class="gate-type ${ag.type}">${escapeHtml(ag.type)}</span></h4>
            <p><strong>Влияние:</strong> ${ag.impact === 'low' ? '🟢 Низкое' : ag.impact === 'medium' ? '🟡 Среднее' : '🔴 Высокое'}</p>
            <p>${escapeHtml(ag.note)}</p>
            ${ag.selector ? `<p style="margin-top:6px;"><code>${escapeHtml(ag.selector)}</code></p>` : ''}
        </div>`;
    }

    // ── Детали ──
    html += '<div class="arch-details">';

    // Фреймворки
    html += `<div class="arch-detail-card"><h4>⚙️ JS-фреймворки и библиотеки</h4>`;
    if (a.frameworks?.length) { html += '<ul>' + a.frameworks.map(f => `<li><code>${escapeHtml(f)}</code></li>`).join('') + '</ul>'; }
    else html += '<p class="arch-detail-empty">Не обнаружены</p>';
    html += '</div>';

    // API
    html += `<div class="arch-detail-card"><h4>🔌 API и State-переменные</h4>`;
    if (a.apiEndpoints?.length || a.stateVars?.length) {
        html += '<ul>';
        if (a.stateVars?.length) a.stateVars.forEach(v => { html += `<li>🗂 State: <code>${escapeHtml(v)}</code></li>`; });
        if (a.apiEndpoints?.length) a.apiEndpoints.forEach(e => { html += `<li>🔗 <code>${escapeHtml(e)}</code></li>`; });
        html += '</ul>';
    } else html += '<p class="arch-detail-empty">Не обнаружены — данные вероятно в HTML</p>';
    html += '</div>';

    // DOM
    html += `<div class="arch-detail-card"><h4>📊 DOM-статистика</h4><ul>
        <li>Элементов: <code>${a.domInfo?.totalElements || 0}</code></li>
        <li>Скриптов: <code>${a.domInfo?.scripts || 0}</code> (inline: ${((a.domInfo?.inlineScriptSize || 0) / 1024).toFixed(1)} KB)</li>
        <li>Картинок: <code>${a.domInfo?.images || 0}</code></li>
        <li>Ссылок: <code>${a.domInfo?.links || 0}</code></li>
        <li>Форм: <code>${a.domInfo?.forms || 0}</code></li>
        <li>iframe: <code>${a.domInfo?.iframes || 0}</code></li>
    </ul></div>`;

    // External scripts
    if (a.domInfo?.externalScripts?.length) {
        html += `<div class="arch-detail-card"><h4>📜 Внешние скрипты (${a.domInfo.externalScripts.length})</h4><ul>`;
        a.domInfo.externalScripts.forEach(s => { html += `<li style="word-break:break-all;font-size:11px;"><code>${escapeHtml(s)}</code></li>`; });
        html += '</ul></div>';
    }

    html += '</div>';

    // ── Транспорт-лог ──
    if (data._transportLog?.length) {
        html += `<div class="arch-checklist" style="margin-top:20px;"><h3>🔌 Лог транспорта (${data._transportLog.length} шагов)</h3>
            <div class="transport-log">`;
        data._transportLog.forEach(e => { html += `<div class="transport-log-entry ${e.type}">[${e.time}] ${escapeHtml(e.message)}</div>`; });
        html += '</div></div>';
    }

    return html;
}

function generateCorsErrorBlock(data) {
    return `<div class="report-section cors-error-section">
        <div class="report-section-header">🛡️ Ошибка доступа</div>
        <div class="report-section-body">
            <div class="report-item"><span class="report-label">Тип:</span><span class="report-value error">${escapeHtml(data._error.type)}</span></div>
            <div class="report-item"><span class="report-label">Описание:</span><span class="report-value error">${escapeHtml(data._error.message)}</span></div>
            ${data._error.suggestion ? `<div class="report-item"><span class="report-label">Решение:</span><span class="report-value warning">${escapeHtml(data._error.suggestion)}</span></div>` : ''}
            <div class="cors-help-box"><h4>💡 Как обойти CORS?</h4><ol>
                <li><strong>Cloudflare Worker</strong> — задайте URL в блоке сверху</li>
                <li>Режим <strong>"Авто"</strong> — перебор 6 прокси</li>
                <li>Собственный <a href="https://github.com/Rob--W/cors-anywhere" target="_blank">cors-anywhere</a></li>
            </ol></div>
        </div>
    </div>`;
}

// ================================================================
// ВИЗУАЛЬНЫЙ ОТЧЁТ (стандартный)
// ================================================================

function generateVisualReport(data) {
    let html = '';
    if (data._error) html += generateCorsErrorBlock(data);

    if (data._summary) {
        html += `<div class="report-section"><div class="report-section-header">📋 Сводка</div><div class="report-section-body">
            <div class="report-item"><span class="report-label">URL:</span><span class="report-value">${escapeHtml(data._meta.analyzedUrl)}</span></div>
            <div class="report-item"><span class="report-label">Тип сайта:</span><span class="report-value">${escapeHtml(data._summary.siteTypeLabel)} (${data._summary.siteType})</span></div>
            <div class="report-item"><span class="report-label">Сложность:</span><span class="report-value">${data._summary.complexity}/5 — ${escapeHtml(data._summary.complexityLabel)}</span></div>
            <div class="report-item"><span class="report-label">Worker:</span><span class="report-value">${data._meta.workerUsed !== 'нет' ? '✅ ' + escapeHtml(data._meta.workerUsed) : '❌'}</span></div>
            <div class="report-item"><span class="report-label">Кодировка:</span><span class="report-value">${data.encoding?.charset || 'N/A'}</span></div>
            <div class="report-item"><span class="report-label">Пагинация:</span><span class="report-value ${data._summary.hasPagination ? '' : 'warning'}">${data._summary.hasPagination ? '✅ ' + data._summary.paginationPattern : '❌'}</span></div>
            <div class="report-item"><span class="report-label">Поиск:</span><span class="report-value ${data._summary.hasSearch ? '' : 'warning'}">${data._summary.hasSearch ? '✅' : '❌'}</span></div>
            <div class="report-item"><span class="report-label">Категории:</span><span class="report-value ${data._summary.hasCategories ? '' : 'warning'}">${data._summary.hasCategories ? '✅ ' + data._summary.categoriesCount : '❌'}</span></div>
            <div class="report-item"><span class="report-label">Карточек:</span><span class="report-value">${data._summary.videoCardsFound || 0}</span></div>
            <div class="report-item"><span class="report-label">Видео:</span><span class="report-value ${data._summary.videoSourceFound ? '' : 'warning'}">${data._summary.videoSourceFound ? '✅ (' + data._summary.videoSourceMethods.join(', ') + ')' : '❌'}</span></div>
        </div></div>`;
    }

    if (data.videoCards?.found) {
        const st = data.videoCards.structure;
        html += `<div class="report-section"><div class="report-section-header">🎬 Карточки</div><div class="report-section-body">
            <div class="report-item"><span class="report-label">Селектор:</span><span class="report-value"><span class="tag">${escapeHtml(data.videoCards.cardSelector)}</span></span></div>
            ${st.title.selector ? `<div class="report-item"><span class="report-label">Название:</span><span class="report-value"><span class="tag">${escapeHtml(st.title.selector)}</span></span></div>` : ''}
            ${st.link.selector ? `<div class="report-item"><span class="report-label">Ссылка:</span><span class="report-value"><span class="tag">${escapeHtml(st.link.selector)}</span> Паттерн: ${escapeHtml(st.link.pattern || '')}</span></div>` : ''}
            ${st.thumbnail.selector ? `<div class="report-item"><span class="report-label">Превью:</span><span class="report-value"><span class="tag">${escapeHtml(st.thumbnail.selector)}</span> (${escapeHtml(st.thumbnail.attribute)})</span></div>` : ''}
            ${st.duration.selector ? `<div class="report-item"><span class="report-label">Длительность:</span><span class="report-value"><span class="tag">${escapeHtml(st.duration.selector)}</span></span></div>` : ''}
        </div></div>`;
        if (data.videoCards.sampleCards.length) {
            html += `<div class="report-section"><div class="report-section-header">📑 Примеры (${data.videoCards.sampleCards.length})</div><div class="report-section-body">`;
            data.videoCards.sampleCards.forEach((c, i) => {
                html += `<div style="margin-bottom:12px;padding:10px;background:#0f0f23;border-radius:8px;"><strong style="color:#00d4ff;">#${i + 1}</strong><br>`;
                if (c.title) html += `📌 ${escapeHtml(c.title)}<br>`;
                if (c.link) html += `🔗 <a style="color:#00ff88;" href="${escapeHtml(c.link)}" target="_blank">${escapeHtml(c.link.substring(0, 80))}…</a><br>`;
                if (c.duration) html += `⏱ ${escapeHtml(c.duration)} `;
                if (c.quality) html += `📺 ${escapeHtml(c.quality)}`;
                html += '</div>';
            });
            html += '</div></div>';
        }
    }

    if (data.videoPage?.analyzed) {
        html += `<div class="report-section"><div class="report-section-header">▶️ Видео</div><div class="report-section-body">
            <div class="report-item"><span class="report-label">Паттерн URL:</span><span class="report-value">${escapeHtml(data.videoPage.urlStructure?.pattern || 'N/A')}</span></div>`;
        if (data.videoPage.videoSources?.sources?.length) { data.videoPage.videoSources.sources.forEach(s => { html += `<div class="report-item"><span class="report-label"><span class="tag">${escapeHtml(s.type)}</span></span><span class="report-value" style="font-size:12px;">${escapeHtml(s.foundIn)} — ${escapeHtml(s.url.substring(0, 100))}…</span></div>`; }); }
        if (data.videoPage.relatedVideos?.found) html += `<div class="report-item"><span class="report-label">Похожие:</span><span class="report-value">✅ ${data.videoPage.relatedVideos.count} — <span class="tag">${escapeHtml(data.videoPage.relatedVideos.selector)}</span></span></div>`;
        if (data.videoPage.error) html += `<div class="report-item"><span class="report-label">Ошибка:</span><span class="report-value error">${escapeHtml(data.videoPage.error)}</span></div>`;
        html += '</div></div>';
    }

    if (data.sortingAndCategories?.categories?.found) {
        html += `<div class="report-section"><div class="report-section-header">📁 Категории (${data.sortingAndCategories.categories.totalCount})</div><div class="report-section-body" style="max-height:250px;overflow-y:auto;">`;
        data.sortingAndCategories.categories.list.forEach(c => { html += `<span class="tag" style="margin:3px;">${escapeHtml(c.name)}</span>`; });
        html += '</div></div>';
    }
    return html;
}

// ================================================================
// UI
// ================================================================

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, m => {
        let c = 'color:#ae81ff;';
        if (/^"/.test(m)) c = /:$/.test(m) ? 'color:#a6e22e;' : 'color:#e6db74;';
        else if (/true|false/.test(m)) c = 'color:#66d9ef;';
        else if (/null/.test(m)) c = 'color:#f92672;';
        return `<span style="${c}">${m}</span>`;
    });
}

function showTab(name) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    const tab = document.getElementById('tab-' + name);
    if (tab) tab.classList.add('active');
    if (event?.target) event.target.classList.add('active');
}

function copyResults() {
    if (!analysisResult) return;
    const j = JSON.stringify(analysisResult, null, 2);
    navigator.clipboard.writeText(j).then(() => setStatus('📋 Скопировано!', 'success')).catch(() => { document.getElementById('jsonRaw').select(); document.execCommand('copy'); setStatus('📋 Скопировано!', 'success'); });
}

function downloadResults() {
    if (!analysisResult) return;
    const j = JSON.stringify(analysisResult, null, 2), blob = new Blob([j], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    try { a.download = `analysis-${new URL(analysisResult._meta.analyzedUrl).hostname}-${Date.now()}.json`; } catch { a.download = `analysis-${Date.now()}.json`; }
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    setStatus('💾 Скачан!', 'success');
}

function onProxyChange() {
    const sel = document.getElementById('proxySelect'), hint = document.getElementById('proxyHint');
    if (!hint || !sel) return;
    const h = { 'auto': '🔄 Прямой → Worker → перебор 6 прокси', '': '🔗 Только прямой запрос',
        'https://api.allorigins.win/raw?url=': '🌐 allorigins.win', 'https://corsproxy.io/?': '🌐 corsproxy.io',
        'https://api.codetabs.com/v1/proxy?quest=': '🌐 codetabs.com', 'https://thingproxy.freeboard.io/fetch/': '🌐 thingproxy — URL после /fetch/',
        'https://cors-anywhere.herokuapp.com/': '🌐 cors-anywhere — может требовать активации', 'https://cors.bridged.cc/': '🌐 cors.bridged.cc' };
    hint.textContent = h[sel.value] || '';
}

// ================================================================
// ИНИЦИАЛИЗАЦИЯ
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    const ui = document.getElementById('targetUrl');
    if (DEFAULT_TARGET_URL && ui && !ui.value) ui.value = DEFAULT_TARGET_URL;
    if (ui) ui.addEventListener('keypress', e => { if (e.key === 'Enter') runFullAnalysis(); });
    const ps = document.getElementById('proxySelect');
    if (ps) { ps.addEventListener('change', onProxyChange); onProxyChange(); }
    const wi = document.getElementById('workerUrl');
    if (wi) {
        const saved = localStorage.getItem('analyzerWorkerUrl');
        if (saved) { wi.value = saved; updateWorkerStatus(true); }
        wi.addEventListener('input', () => updateWorkerStatus(!!wi.value.trim()));
        wi.addEventListener('change', () => { const v = wi.value.trim(); if (v) localStorage.setItem('analyzerWorkerUrl', v); else localStorage.removeItem('analyzerWorkerUrl'); });
    }
});
