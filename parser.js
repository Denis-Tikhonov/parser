// ================================================================
// SITE STRUCTURE ANALYZER — parser.js v2.1
// ================================================================
// Каскад транспортов:
//   1) Прямой запрос (без прокси)
//   2) Cloudflare Worker (если задан)
//   3) Публичные CORS-прокси (перебор)
// ================================================================

const DEFAULT_TARGET_URL = "";
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// ВСТАВЬТЕ ССЫЛКУ СЮДА, например:
// const DEFAULT_TARGET_URL = "https://trahkino.me/video/";
// ================================================================

let analysisResult = null;

// Лог транспортов — для отображения в отчёте
let transportLog = [];

function logTransport(message, type = 'info') {
    const time = new Date().toLocaleTimeString();
    transportLog.push({ time, message, type });
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// ================================================================
// УТИЛИТЫ
// ================================================================

function setStatus(msg, type = 'loading') {
    const el = document.getElementById('status');
    if (!el) return;
    el.textContent = msg;
    el.className = 'status ' + type;
}

function setProgress(percent, text, subtype) {
    const container = document.getElementById('progress-container');
    const bar = document.getElementById('progress-bar');
    const txt = document.getElementById('progress-text');
    if (!container) return;
    container.style.display = 'block';
    bar.style.width = percent + '%';
    txt.textContent = text || (percent + '%');

    bar.classList.remove('cors-error', 'warning', 'worker');
    if (subtype === 'cors-error') bar.classList.add('cors-error');
    else if (subtype === 'warning') bar.classList.add('warning');
    else if (subtype === 'worker') bar.classList.add('worker');
}

function getBaseUrl(url) {
    try { return new URL(url).origin; } catch { return ''; }
}

function resolveUrl(href, baseUrl) {
    if (!href) return '';
    try { return new URL(href, baseUrl).href; } catch { return href; }
}

function uniqueArray(arr) {
    return [...new Set(arr.filter(Boolean))];
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// ================================================================
// WORKER
// ================================================================

function getWorkerUrl() {
    const input = document.getElementById('workerUrl');
    if (!input) return '';
    return input.value.trim().replace(/\/$/, '');
}

function updateWorkerStatus(hasWorker) {
    const badge = document.getElementById('workerStatusBadge');
    if (!badge) return;
    if (hasWorker) {
        badge.textContent = '✦ Worker активен';
        badge.className = 'worker-badge active';
    } else {
        badge.textContent = '○ Worker не задан';
        badge.className = 'worker-badge inactive';
    }
}

// ================================================================
// CORS ИНДИКАТОР
// ================================================================

function updateCorsIndicator(state, detail) {
    const indicator = document.getElementById('corsIndicator');
    if (!indicator) return;
    indicator.style.display = 'block';

    const states = {
        'trying-direct': {
            text: '🔗 Прямое подключение...',
            cls: 'cors-indicator trying'
        },
        'direct-ok': {
            text: '✅ Прямое подключение — CORS разрешён сервером',
            cls: 'cors-indicator direct-ok'
        },
        'trying-worker': {
            text: '⚡ Пробую Cloudflare Worker...',
            cls: 'cors-indicator trying'
        },
        'worker-ok': {
            text: `✅ Загружено через Worker${detail ? ': ' + detail : ''}`,
            cls: 'cors-indicator worker-ok'
        },
        'cors-detected': {
            text: '🛡️ CORS-блокировка обнаружена — подключаю прокси...',
            cls: 'cors-indicator cors-blocked'
        },
        'trying-proxy': {
            text: `🔄 Пробую прокси: ${detail || ''}...`,
            cls: 'cors-indicator cors-blocked'
        },
        'proxy-ok': {
            text: `✅ Загружено через прокси: ${detail || ''}`,
            cls: 'cors-indicator proxy-ok'
        },
        'all-failed': {
            text: '❌ Все методы заблокированы (CORS / Cloudflare / DDoS-защита)',
            cls: 'cors-indicator all-failed'
        },
        'hidden': {
            text: '',
            cls: 'cors-indicator'
        }
    };

    const s = states[state] || states['hidden'];
    indicator.textContent = s.text;
    indicator.className = s.cls;
    if (state === 'hidden') indicator.style.display = 'none';
}

// ================================================================
// СПИСОК ПУБЛИЧНЫХ ПРОКСИ
// ================================================================

function getProxyList() {
    return [
        { name: 'allorigins.win',       url: 'https://api.allorigins.win/raw?url=' },
        { name: 'corsproxy.io',          url: 'https://corsproxy.io/?' },
        { name: 'codetabs.com',          url: 'https://api.codetabs.com/v1/proxy?quest=' },
        { name: 'thingproxy.freeboard',  url: 'https://thingproxy.freeboard.io/fetch/' },
        { name: 'cors-anywhere.heroku',  url: 'https://cors-anywhere.herokuapp.com/' },
        { name: 'cors.bridged.cc',       url: 'https://cors.bridged.cc/' },
    ];
}

// ================================================================
// ОПРЕДЕЛЕНИЕ CORS-ОШИБКИ
// ================================================================

function isCorsError(error) {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    return (
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network error') ||
        msg.includes('cors') ||
        msg.includes('cross-origin') ||
        msg.includes('access-control-allow-origin') ||
        msg.includes('load failed') ||
        error.name === 'TypeError'
    );
}

// ================================================================
// FETCH — отдельные методы
// ================================================================

async function fetchDirect(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const resp = await fetch(url, {
            headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' },
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        const html = await resp.text();
        if (!html || html.length < 50) throw new Error('Пустой ответ');
        return html;
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

async function fetchViaWorker(url) {
    const workerUrl = getWorkerUrl();
    if (!workerUrl) throw new Error('Worker не задан');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const fetchUrl = workerUrl + '/?url=' + encodeURIComponent(url);
        const resp = await fetch(fetchUrl, {
            headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' },
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!resp.ok) throw new Error(`Worker HTTP ${resp.status}`);
        const html = await resp.text();
        if (!html || html.length < 50) throw new Error('Worker вернул пустой ответ');
        return html;
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

async function fetchViaProxy(url, proxyPrefix) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        // thingproxy и cors-anywhere используют прямую конкатенацию (не encodeURIComponent)
        const needsRawUrl = (
            proxyPrefix.includes('thingproxy.freeboard.io') ||
            proxyPrefix.includes('cors-anywhere.herokuapp.com') ||
            proxyPrefix.includes('cors.bridged.cc')
        );
        const fetchUrl = needsRawUrl
            ? proxyPrefix + url
            : proxyPrefix + encodeURIComponent(url);

        const resp = await fetch(fetchUrl, {
            headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' },
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
        const html = await resp.text();
        if (!html || html.length < 50) throw new Error('Прокси вернул пустой ответ');
        return html;
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

// ================================================================
// ЗАГРУЗКА СТРАНИЦЫ — КАСКАД
// ================================================================
// Порядок (в режиме auto):
//   1. Прямой запрос
//   2. Cloudflare Worker (если задан)
//   3. Публичные прокси (перебор)
// ================================================================

async function fetchPage(url) {
    const proxySelect = document.getElementById('proxySelect');
    const selectedProxy = proxySelect ? proxySelect.value : 'auto';
    const workerUrl = getWorkerUrl();

    // ── Режим "Без прокси" ──
    if (selectedProxy === '') {
        logTransport('Режим: только прямой запрос', 'info');
        updateCorsIndicator('trying-direct');
        try {
            const html = await fetchDirect(url);
            logTransport('✅ Прямой запрос успешен', 'success');
            updateCorsIndicator('direct-ok');
            return html;
        } catch (err) {
            logTransport(`❌ Прямой запрос: ${err.message}`, 'fail');
            if (isCorsError(err)) {
                updateCorsIndicator('all-failed');
                throw new Error(
                    '🛡️ CORS-блокировка! Сайт не разрешает прямые кросс-доменные запросы.\n' +
                    '💡 Переключите режим на "Авто" или выберите прокси.'
                );
            }
            throw err;
        }
    }

    // ── Режим "Авто" ──
    if (selectedProxy === 'auto') {

        // Шаг 1: Прямой запрос
        try {
            logTransport('Шаг 1/3: Прямой запрос...', 'info');
            updateCorsIndicator('trying-direct');
            setProgress(12, '🔗 Прямое подключение...');
            const html = await fetchDirect(url);
            logTransport('✅ Прямой запрос — CORS разрешён', 'success');
            updateCorsIndicator('direct-ok');
            return html;
        } catch (directErr) {
            const cors = isCorsError(directErr);
            logTransport(
                cors
                    ? '🛡️ CORS-блокировка обнаружена'
                    : `⚠️ Прямой запрос не удался: ${directErr.message}`,
                cors ? 'warning' : 'fail'
            );
        }

        // Шаг 2: Worker
        if (workerUrl) {
            try {
                logTransport('Шаг 2/3: Cloudflare Worker...', 'info');
                updateCorsIndicator('trying-worker');
                setProgress(14, '⚡ Worker...', 'worker');
                const html = await fetchViaWorker(url);
                logTransport(`✅ Worker успешен: ${workerUrl}`, 'success');
                updateCorsIndicator('worker-ok', workerUrl);
                return html;
            } catch (workerErr) {
                logTransport(`❌ Worker не удался: ${workerErr.message}`, 'fail');
            }
        } else {
            logTransport('Шаг 2/3: Worker не задан — пропуск', 'info');
        }

        // Шаг 3: Перебор публичных прокси
        updateCorsIndicator('cors-detected');
        setStatus('⚠️ CORS обнаружен. Перебираю прокси...', 'loading');

        const proxies = getProxyList();
        for (let i = 0; i < proxies.length; i++) {
            const proxy = proxies[i];
            try {
                logTransport(`Шаг 3/3: Прокси ${proxy.name}...`, 'info');
                updateCorsIndicator('trying-proxy', proxy.name);
                setProgress(15 + i * 2, `🔄 Прокси: ${proxy.name}...`, 'warning');
                const html = await fetchViaProxy(url, proxy.url);
                logTransport(`✅ Прокси ${proxy.name} — успешно`, 'success');
                updateCorsIndicator('proxy-ok', proxy.name);
                setStatus(`✅ Загружено через прокси: ${proxy.name}`, 'success');
                return html;
            } catch (proxyErr) {
                logTransport(`❌ ${proxy.name}: ${proxyErr.message}`, 'fail');
            }
        }

        // Ничего не сработало
        updateCorsIndicator('all-failed');
        setProgress(15, '❌ Все методы заблокированы!', 'cors-error');
        throw new Error(
            '❌ Не удалось загрузить страницу. Все методы заблокированы.\n\n' +
            '🛡️ Возможные причины:\n' +
            '• CORS-политика сервера запрещает кросс-доменные запросы\n' +
            '• Сайт защищён Cloudflare / DDoS Guard\n' +
            '• Публичные прокси заблокированы или перегружены\n\n' +
            '💡 Решения:\n' +
            '• Задайте Cloudflare Worker в блоке сверху\n' +
            '• Разверните собственный cors-anywhere прокси'
        );
    }

    // ── Конкретный прокси выбран ──
    logTransport(`Режим: конкретный прокси — ${selectedProxy}`, 'info');

    // Но всё равно пробуем Worker сначала (если задан)
    if (workerUrl) {
        try {
            logTransport('Пробую Worker перед прокси...', 'info');
            updateCorsIndicator('trying-worker');
            const html = await fetchViaWorker(url);
            logTransport(`✅ Worker успешен`, 'success');
            updateCorsIndicator('worker-ok', workerUrl);
            return html;
        } catch (workerErr) {
            logTransport(`Worker не удался: ${workerErr.message}, переключаюсь на прокси`, 'warning');
        }
    }

    try {
        const proxyName = selectedProxy.replace(/https?:\/\//, '').split('/')[0];
        updateCorsIndicator('trying-proxy', proxyName);
        const html = await fetchViaProxy(url, selectedProxy);
        logTransport(`✅ Прокси ${proxyName} — успешно`, 'success');
        updateCorsIndicator('proxy-ok', proxyName);
        return html;
    } catch (err) {
        logTransport(`❌ Прокси: ${err.message}`, 'fail');
        if (isCorsError(err)) {
            updateCorsIndicator('all-failed');
            setProgress(15, '❌ Прокси заблокирован (CORS)', 'cors-error');
            throw new Error(
                `🛡️ Прокси не смог загрузить страницу.\n` +
                `Попробуйте режим "Авто" или задайте Cloudflare Worker.\n` +
                `Ошибка: ${err.message}`
            );
        }
        throw err;
    }
}

// ================================================================
// EXTRACT MODE — Worker → прямая video-ссылка
// ================================================================

async function extractVideoUrlViaWorker(pageUrl) {
    const workerUrl = getWorkerUrl();
    if (!workerUrl) return null;
    try {
        const fetchUrl = workerUrl + '/?url=' + encodeURIComponent(pageUrl) + '&mode=extract';
        const resp = await fetch(fetchUrl);
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.success && data.videoUrl) {
            logTransport(`✅ Worker extract: ${data.videoUrl.substring(0, 80)}...`, 'success');
            return data.videoUrl;
        }
    } catch (e) {
        logTransport(`Worker extract failed: ${e.message}`, 'fail');
    }
    return null;
}

function parseHTML(html) {
    return new DOMParser().parseFromString(html, 'text/html');
}

// ================================================================
// АНАЛИЗАТОРЫ
// ================================================================

function analyzeEncoding(doc, html) {
    const metaCharset = doc.querySelector('meta[charset]');
    const metaContentType = doc.querySelector('meta[http-equiv="Content-Type"]');
    let charset = 'Не определено';
    if (metaCharset) {
        charset = metaCharset.getAttribute('charset');
    } else if (metaContentType) {
        const content = metaContentType.getAttribute('content') || '';
        const m = content.match(/charset=([^\s;]+)/i);
        if (m) charset = m[1];
    }
    return {
        charset: charset.toUpperCase(),
        source: metaCharset ? '<meta charset>' : metaContentType ? '<meta http-equiv>' : 'не найдено',
        hasUtf8Bom: html.charCodeAt(0) === 0xFEFF
    };
}

function analyzePagination(doc, baseUrl, targetUrl) {
    const result = {
        mainPageUrl: targetUrl,
        pagination: { found: false, type: null, pattern: null, examples: [], selectors: [] }
    };

    const paginationSelectors = [
        '.pagination a', '.pager a', '.pages a', '.page-numbers a',
        'nav.pagination a', '.paginator a', '.page-nav a',
        'ul.pagination a', '.wp-pagenavi a', '.nav-links a',
        'a.page-link', '.paging a', '.page_nav a',
        '[class*="pagination"] a', '[class*="pager"] a'
    ];
    let paginationLinks = [];
    let matchedSelector = '';

    for (const sel of paginationSelectors) {
        try {
            const links = doc.querySelectorAll(sel);
            if (links.length > 0) {
                matchedSelector = sel;
                links.forEach(a => { const h = a.getAttribute('href'); if (h) paginationLinks.push(h); });
                break;
            }
        } catch (e) {}
    }
    if (paginationLinks.length === 0) {
        doc.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') || '';
            const text = a.textContent.trim();
            if (/[?&]page=\d+/i.test(href) || /\/page\/\d+/i.test(href) ||
                /[?&]p=\d+/i.test(href) || /[?&]from=\d+/i.test(href) ||
                (/\/\d+\/?$/.test(href) && /^\d+$/.test(text)))
                paginationLinks.push(href);
        });
        if (paginationLinks.length > 0) matchedSelector = 'a[href] (по паттерну URL)';
    }
    if (paginationLinks.length > 0) {
        result.pagination.found = true;
        result.pagination.selectors.push(matchedSelector);
        result.pagination.examples = uniqueArray(paginationLinks.map(h => resolveUrl(h, baseUrl))).slice(0, 10);
        const s = paginationLinks[0];
        if (/[?&]page=\d+/i.test(s)) { result.pagination.type = 'query_parameter'; result.pagination.pattern = '?page=N'; }
        else if (/\/page\/\d+/i.test(s)) { result.pagination.type = 'path_segment'; result.pagination.pattern = '/page/N/'; }
        else if (/[?&]from=\d+/i.test(s)) { result.pagination.type = 'offset'; result.pagination.pattern = '?from=N'; }
        else { result.pagination.type = 'other'; result.pagination.pattern = s; }
    }
    const paginationContainers = ['.pagination', '.pager', '.pages', '.paginator', 'nav.pagination', '.page-nav'];
    for (const sel of paginationContainers) {
        try {
            const el = doc.querySelector(sel);
            if (el) { result.pagination.containerSelector = sel; result.pagination.containerHTML = el.outerHTML.substring(0, 500); break; }
        } catch (e) {}
    }
    return result;
}

function analyzeSearch(doc, baseUrl, html) {
    const result = { found: false, forms: [], searchUrl: null, searchPattern: null };
    doc.querySelectorAll('form').forEach(form => {
        const action = form.getAttribute('action') || '';
        const inputs = form.querySelectorAll('input');
        let hasSearch = false;
        let inputDetails = [];
        inputs.forEach(input => {
            const type = (input.getAttribute('type') || 'text').toLowerCase();
            const name = input.getAttribute('name') || '';
            const placeholder = input.getAttribute('placeholder') || '';
            if (type === 'search' || name.match(/^(q|query|search|s|keyword|k|find)$/i) || placeholder.match(/(поиск|search|найти|искать)/i))
                hasSearch = true;
            inputDetails.push({ type, name, placeholder, classes: input.className });
        });
        if (hasSearch || action.match(/(search|find|poisk)/i)) {
            result.found = true;
            result.forms.push({
                action: resolveUrl(action, baseUrl),
                method: (form.getAttribute('method') || 'GET').toUpperCase(),
                inputs: inputDetails
            });
        }
    });
    if (result.forms.length > 0) {
        const form = result.forms[0];
        const si = form.inputs.find(i => i.name.match(/^(q|query|search|s|keyword|k)$/i));
        const p = si ? si.name : 'q';
        result.searchPattern = form.method === 'GET'
            ? `${form.action}?${p}={запрос}`
            : `POST ${form.action} (${p}={запрос})`;
        result.searchUrl = form.action;
    }
    return result;
}

function analyzeSortingAndCategories(doc, baseUrl) {
    const result = {
        sorting: { found: false, options: [], urlPattern: null },
        categories: { found: false, list: [], urlPattern: null }
    };
    const sortSelectors = ['select[name*="sort"]', 'select[name*="order"]', '[class*="sort"] a', '.sorting a', '.sort-options a', 'a[href*="sort="]', 'a[href*="order="]', '[class*="tabs"] a', '.list-tabs a'];
    for (const sel of sortSelectors) {
        try {
            const elements = doc.querySelectorAll(sel);
            elements.forEach(el => {
                if (el.tagName === 'SELECT') { el.querySelectorAll('option').forEach(opt => result.sorting.options.push({ label: opt.textContent.trim(), value: opt.value, url: null })); result.sorting.found = true; }
                else if (el.tagName === 'A') { const href = el.getAttribute('href'); if (href) { result.sorting.options.push({ label: el.textContent.trim(), value: null, url: resolveUrl(href, baseUrl) }); result.sorting.found = true; } }
            });
            if (result.sorting.found) break;
        } catch (e) {}
    }
    if (!result.sorting.found) {
        const sortPatterns = /(sort|order|popular|rating|newest|latest|longest|viewed|top)/i;
        doc.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') || ''; const text = a.textContent.trim();
            if (sortPatterns.test(href) && text.length < 50 && text.length > 0) { result.sorting.options.push({ label: text, value: null, url: resolveUrl(href, baseUrl) }); result.sorting.found = true; }
        });
    }
    const seen = new Set();
    result.sorting.options = result.sorting.options.filter(o => { const k = o.label + '|' + (o.url || o.value); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 20);
    if (result.sorting.options.length > 0) { const su = result.sorting.options.find(o => o.url)?.url; if (su) { if (/[?&]sort=/i.test(su)) result.sorting.urlPattern = '?sort={value}'; else if (/[?&]order=/i.test(su)) result.sorting.urlPattern = '?order={value}'; else result.sorting.urlPattern = su; } }

    const categorySelectors = ['.categories a', '.category-list a', '.cats a', 'nav.categories a', '.tags a', '[class*="categor"] a', 'a[href*="/categories/"]', 'a[href*="/category/"]', 'a[href*="/tags/"]', 'a[href*="/cat/"]'];
    const categoryLinks = [];
    for (const sel of categorySelectors) {
        try { const links = doc.querySelectorAll(sel); if (links.length >= 3) { links.forEach(a => { const h = a.getAttribute('href'); const t = a.textContent.trim(); if (h && t && t.length < 100) categoryLinks.push({ name: t, url: resolveUrl(h, baseUrl) }); }); break; } } catch (e) {}
    }
    if (categoryLinks.length === 0) {
        const catPat = /\/(categories|category|cat|tags|tag|genre|genres)\//i;
        doc.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href') || ''; const t = a.textContent.trim(); if (catPat.test(h) && t.length > 0 && t.length < 100) categoryLinks.push({ name: t, url: resolveUrl(h, baseUrl) }); });
    }
    if (categoryLinks.length > 0) {
        result.categories.found = true;
        const sc = new Set();
        result.categories.list = categoryLinks.filter(c => { if (sc.has(c.url)) return false; sc.add(c.url); return true; }).slice(0, 50);
        result.categories.totalCount = result.categories.list.length;
        if (result.categories.list.length > 0) { try { result.categories.urlPattern = new URL(result.categories.list[0].url).pathname.replace(/[^/]+\/?$/, '{category}/'); } catch (e) {} }
    }
    return result;
}

function analyzeVideoCards(doc, baseUrl) {
    const result = { found: false, cardSelector: null, totalCardsFound: 0, structure: { title: { selector: null, example: null }, link: { selector: null, example: null, pattern: null }, thumbnail: { selector: null, example: null, attribute: null }, duration: { selector: null, example: null }, quality: { selector: null, example: null } }, sampleCards: [] };
    const cardSelectors = ['.video-item', '.video-card', '.thumb-item', '.thumb', '.video-thumb', '.video_block', '.video-block', '.item', '.video', '.clip', '.gallery-item', 'article', '.post', '.list-item', '.grid-item', '[data-video-id]', '[data-id]', '.col', '.card'];
    let cards = [], usedSelector = '';
    for (const sel of cardSelectors) { try { const f = doc.querySelectorAll(sel); if (f.length >= 2 && Array.from(f).some(e => e.querySelector('a[href]')) && Array.from(f).some(e => e.querySelector('img'))) { cards = Array.from(f); usedSelector = sel; break; } } catch (e) {} }
    if (cards.length === 0) { const p = []; doc.querySelectorAll('div, li, article').forEach(d => { const imgs = d.querySelectorAll(':scope > img, :scope > a > img, :scope > div > img'); const lnk = d.querySelectorAll(':scope > a[href]'); if (imgs.length >= 1 && lnk.length >= 1 && d.querySelectorAll('a[href]').length < 10) p.push(d); }); if (p.length >= 3) { cards = p; usedSelector = 'auto-detected'; } }
    if (cards.length === 0) return result;
    result.found = true; result.cardSelector = usedSelector; result.totalCardsFound = cards.length;

    for (let i = 0; i < Math.min(5, cards.length); i++) {
        const card = cards[i], cd = {};
        for (const ts of ['h1','h2','h3','h4','h5','.title','.name','.video-title','a[title]','[class*="title"]','strong','b']) { try { const el = card.querySelector(ts); if (el) { const t = el.textContent.trim(); if (t.length > 2 && t.length < 300) { cd.title = t; if (i === 0) { result.structure.title.selector = `${usedSelector} ${ts}`; result.structure.title.example = t; } break; } } } catch (e) {} }
        if (!cd.title) { const a = card.querySelector('a[title]'); if (a) { cd.title = a.getAttribute('title'); if (i === 0) result.structure.title.selector = `${usedSelector} a[title]`; } }
        const linkEl = card.querySelector('a[href]');
        if (linkEl) { const h = linkEl.getAttribute('href'); cd.link = resolveUrl(h, baseUrl); if (i === 0) { result.structure.link.selector = `${usedSelector} a[href]`; result.structure.link.example = cd.link; try { result.structure.link.pattern = new URL(cd.link).pathname.replace(/\/\d+\//g, '/{id}/').replace(/\/\d+$/, '/{id}').replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/'); } catch (e) {} } }
        const imgEl = card.querySelector('img');
        if (imgEl) { for (const attr of ['data-src','data-original','data-lazy-src','data-thumb','src']) { const s = imgEl.getAttribute(attr); if (s && !s.startsWith('data:') && s !== '') { cd.thumbnail = resolveUrl(s, baseUrl); if (i === 0) { result.structure.thumbnail.selector = `${usedSelector} img`; result.structure.thumbnail.attribute = attr; result.structure.thumbnail.example = cd.thumbnail; } break; } } }
        for (const ds of ['.duration','.time','.video-time','[class*="duration"]','[class*="time"]']) { try { const el = card.querySelector(ds); if (el) { const t = el.textContent.trim(); if (/\d{1,2}:\d{2}/.test(t)) { cd.duration = t; if (i === 0) { result.structure.duration.selector = `${usedSelector} ${ds}`; result.structure.duration.example = t; } break; } } } catch (e) {} }
        if (!cd.duration) { for (const el of card.querySelectorAll('span,div,small,em')) { const t = el.textContent.trim(); if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) { cd.duration = t; break; } } }
        for (const qs of ['.quality','.hd','[class*="quality"]','[class*="hd"]']) { try { const el = card.querySelector(qs); if (el) { const t = el.textContent.trim(); if (/\b(HD|FHD|4K|1080|720|2160|UHD|SD)\b/i.test(t)) { cd.quality = t; if (i === 0) { result.structure.quality.selector = `${usedSelector} ${qs}`; result.structure.quality.example = t; } break; } } } catch (e) {} }
        if (!cd.quality) { for (const el of card.querySelectorAll('span,div,i,em,strong,b,small')) { const t = el.textContent.trim(); if (/^(HD|FHD|4K|1080p?|720p?|SD)$/i.test(t)) { cd.quality = t; break; } } }
        result.sampleCards.push(cd);
    }
    return result;
}

async function analyzeVideoPage(videoUrl, baseUrl) {
    const result = { analyzed: false, videoUrl, urlStructure: { pattern: null, example: videoUrl }, videoSources: { found: false, sources: [], methods: [] }, relatedVideos: { found: false, selector: null, count: 0 } };
    if (!videoUrl) return result;

    try {
        setStatus(`📥 Загрузка видео-страницы: ${videoUrl.substring(0, 80)}...`, 'loading');
        setProgress(82, 'Загрузка видео-страницы...');
        const html = await fetchPage(videoUrl);
        const doc = parseHTML(html);
        result.analyzed = true;
        setProgress(85, 'Анализ видео-источников...');

        try { result.urlStructure.pattern = new URL(videoUrl).pathname.replace(/\/\d+\//g, '/{id}/').replace(/\/\d+$/, '/{id}').replace(/\/[a-z0-9_-]{10,}\.html$/i, '/{slug}.html').replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/'); } catch (e) {}
        result.pageTitle = doc.title || null;
        const h1 = doc.querySelector('h1'); if (h1) result.videoTitle = h1.textContent.trim();

        // <video>/<source>
        doc.querySelectorAll('video, video source').forEach(v => {
            const src = v.getAttribute('src') || v.getAttribute('data-src');
            if (src) { result.videoSources.sources.push({ type: src.includes('.m3u8') ? 'HLS' : src.includes('.mp4') ? 'MP4' : 'unknown', url: resolveUrl(src, baseUrl), foundIn: '<video> tag', quality: v.getAttribute('label') || null }); result.videoSources.found = true; result.videoSources.methods.push('video_tag'); }
        });

        // JS
        const allScript = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
        const jsPatterns = [/["'](?:file|src|source|video_url|mp4|hls|stream)["']\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8|webm)[^"']*?)["']/gi, /(?:https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8|webm)(?:\?[^\s"'<>]*)?)/gi];
        for (const pat of jsPatterns) { let m; while ((m = pat.exec(allScript)) !== null) { const u = (m[1] || m[0]).replace(/\\/g, ''); if (u.match(/\.(mp4|m3u8|webm)/)) { result.videoSources.sources.push({ type: u.includes('.m3u8') ? 'HLS' : u.includes('.mp4') ? 'MP4' : 'WebM', url: u, foundIn: 'JavaScript', quality: null }); result.videoSources.found = true; result.videoSources.methods.push('javascript'); } } pat.lastIndex = 0; }

        // og:meta
        doc.querySelectorAll('meta[property="og:video"], meta[property="og:video:url"], meta[property="og:video:secure_url"]').forEach(m => { const u = m.getAttribute('content'); if (u) { result.videoSources.sources.push({ type: u.includes('.m3u8') ? 'HLS' : u.includes('.mp4') ? 'MP4' : 'unknown', url: resolveUrl(u, baseUrl), foundIn: 'og:meta', quality: null }); result.videoSources.found = true; result.videoSources.methods.push('meta_tag'); } });

        // iframes
        const pIframes = [];
        doc.querySelectorAll('iframe[src], iframe[data-src]').forEach(iframe => { const s = iframe.getAttribute('src') || iframe.getAttribute('data-src'); if (s && (s.includes('player') || s.includes('embed') || s.includes('video'))) pIframes.push({ src: resolveUrl(s, baseUrl), width: iframe.getAttribute('width'), height: iframe.getAttribute('height') }); });
        if (pIframes.length > 0) { result.videoSources.playerIframes = pIframes; result.videoSources.methods.push('iframe'); }

        // Worker extract
        const workerExtracted = await extractVideoUrlViaWorker(videoUrl);
        if (workerExtracted) { result.videoSources.sources.push({ type: workerExtracted.includes('.m3u8') ? 'HLS' : workerExtracted.includes('.mp4') ? 'MP4' : 'unknown', url: workerExtracted, foundIn: 'Worker extract ✦', quality: null }); result.videoSources.found = true; result.videoSources.methods.push('worker_extract'); }

        // Local pattern fallback
        if (!result.videoSources.found) {
            const localPatterns = [/["'](https?:\/\/[^"']*\/get_file\/[^"']+\.mp4[^"']*)['"]/i, /["'](https?:\/\/[^"']+\.mp4(?:\?[^"']*)?)['"]/i, /["'](https?:\/\/[^"']+\.m3u8(?:\?[^"']*)?)['"]/i];
            for (const p of localPatterns) { const m = html.match(p); if (m && m[1]) { result.videoSources.sources.push({ type: m[1].includes('.m3u8') ? 'HLS' : 'MP4', url: m[1], foundIn: 'local pattern', quality: null }); result.videoSources.found = true; result.videoSources.methods.push('local_pattern'); break; } }
        }

        // Dedup
        const ss = new Set();
        result.videoSources.sources = result.videoSources.sources.filter(s => { if (ss.has(s.url)) return false; ss.add(s.url); return true; });
        result.videoSources.methods = uniqueArray(result.videoSources.methods);

        // Player config snippets
        const cfgPat = /(?:var|let|const)\s+(\w*(?:player|video|config|flashvars)\w*)\s*=\s*({[\s\S]*?});/gi;
        const configs = []; let cm; while ((cm = cfgPat.exec(allScript)) !== null) configs.push((cm[2] || '').substring(0, 1000));
        if (configs.length > 0) result.videoSources.playerConfigSnippets = configs.slice(0, 3);

        // Related
        for (const sel of ['.related', '.related-videos', '.similar', '.recommended', '#related', '[class*="related"]', '.more-videos']) {
            try { const el = doc.querySelector(sel); if (el) { const rl = el.querySelectorAll('a[href]'); if (rl.length > 0) { result.relatedVideos = { found: true, selector: sel, count: rl.length, sampleLinks: Array.from(rl).slice(0, 5).map(a => ({ text: a.textContent.trim().substring(0, 100), href: resolveUrl(a.getAttribute('href'), baseUrl) })) }; break; } } } catch (e) {}
        }

    } catch (err) {
        const cors = isCorsError(err);
        result.error = cors
            ? `🛡️ CORS-блокировка при загрузке видео-страницы. URL: ${videoUrl}`
            : `Ошибка: ${err.message}`;
        if (cors) setProgress(85, '🛡️ CORS: видео-страница заблокирована', 'cors-error');
        logTransport(`Видео-страница: ${err.message}`, 'fail');
    }
    return result;
}

function analyzeMeta(doc) {
    const meta = { title: doc.title || null, description: null, keywords: null, ogTitle: null, ogImage: null, language: null, generator: null };
    const d = doc.querySelector('meta[name="description"]'); if (d) meta.description = d.getAttribute('content');
    const k = doc.querySelector('meta[name="keywords"]'); if (k) meta.keywords = k.getAttribute('content');
    const ot = doc.querySelector('meta[property="og:title"]'); if (ot) meta.ogTitle = ot.getAttribute('content');
    const oi = doc.querySelector('meta[property="og:image"]'); if (oi) meta.ogImage = oi.getAttribute('content');
    const l = doc.documentElement.getAttribute('lang'); if (l) meta.language = l;
    const g = doc.querySelector('meta[name="generator"]'); if (g) meta.generator = g.getAttribute('content');
    return meta;
}

// ================================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ================================================================

async function runFullAnalysis() {
    const urlInput = document.getElementById('targetUrl');
    const targetUrl = (urlInput ? urlInput.value.trim() : '') || DEFAULT_TARGET_URL;

    if (!targetUrl) { setStatus('❌ Введите URL для анализа!', 'error'); return; }
    try { new URL(targetUrl); } catch { setStatus('❌ Некорректный URL! Укажите полный адрес включая https://', 'error'); return; }

    if (urlInput) urlInput.value = targetUrl;
    const baseUrl = getBaseUrl(targetUrl);
    const workerUrl = getWorkerUrl();

    const btnAnalyze = document.getElementById('btnAnalyze');
    if (btnAnalyze) { btnAnalyze.disabled = true; btnAnalyze.textContent = '⏳ Анализирую...'; }
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) resultsDiv.style.display = 'none';

    // Сброс
    updateCorsIndicator('hidden');
    updateWorkerStatus(!!workerUrl);
    transportLog = [];
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.classList.remove('cors-error', 'warning', 'worker');

    analysisResult = {
        _meta: {
            analyzedUrl: targetUrl,
            baseUrl,
            analyzedAt: new Date().toISOString(),
            workerUsed: workerUrl || 'нет',
            proxyMode: document.getElementById('proxySelect')?.value || 'auto',
            tool: 'Site Structure Analyzer v2.1'
        }
    };

    try {
        setStatus('📥 Загрузка главной страницы...', 'loading');
        setProgress(10, '📡 Подключение к сайту...');

        let html;
        try {
            html = await fetchPage(targetUrl);
        } catch (fetchErr) {
            const cors = isCorsError(fetchErr);
            if (cors) {
                setProgress(10, '❌ CORS-блокировка! Все методы исчерпаны', 'cors-error');
            } else {
                setProgress(10, `❌ ${fetchErr.message.substring(0, 60)}`, 'cors-error');
            }
            setStatus(`❌ ${fetchErr.message}`, 'error');
            analysisResult._error = {
                type: cors ? 'CORS' : 'FETCH_ERROR',
                message: fetchErr.message,
                suggestion: cors
                    ? 'Задайте Cloudflare Worker или используйте режим "Авто" с прокси'
                    : 'Проверьте URL и повторите попытку'
            };
            analysisResult._transportLog = transportLog;
            displayResults(analysisResult);
            return;
        }

        const doc = parseHTML(html);
        setProgress(20, '✅ Страница загружена');
        setStatus(`✅ Страница загружена (${(html.length / 1024).toFixed(1)} KB)`, 'success');

        setProgress(25, 'Кодировка...'); analysisResult.encoding = analyzeEncoding(doc, html);
        setProgress(30, 'Мета-информация...'); analysisResult.siteMetaInfo = analyzeMeta(doc);
        setProgress(40, 'Пагинация...'); analysisResult.mainPageAndPagination = analyzePagination(doc, baseUrl, targetUrl);
        setProgress(50, 'Поиск...'); analysisResult.search = analyzeSearch(doc, baseUrl, html);
        setProgress(60, 'Сортировка и категории...'); analysisResult.sortingAndCategories = analyzeSortingAndCategories(doc, baseUrl);
        setProgress(70, 'Карточки видео...'); analysisResult.videoCards = analyzeVideoCards(doc, baseUrl);

        setProgress(80, 'Видео-страница...');
        let sampleVideoUrl = null;
        if (analysisResult.videoCards.sampleCards?.length > 0) sampleVideoUrl = analysisResult.videoCards.sampleCards[0].link;
        analysisResult.videoPage = sampleVideoUrl
            ? await analyzeVideoPage(sampleVideoUrl, baseUrl)
            : { analyzed: false, note: 'Ссылки на видео не найдены в карточках' };

        setProgress(95, 'Формирование отчёта...');
        analysisResult._summary = {
            encoding: analysisResult.encoding.charset,
            hasPagination: analysisResult.mainPageAndPagination.pagination.found,
            paginationPattern: analysisResult.mainPageAndPagination.pagination.pattern,
            hasSearch: analysisResult.search.found,
            searchPattern: analysisResult.search.searchPattern,
            hasSorting: analysisResult.sortingAndCategories.sorting.found,
            sortingOptionsCount: analysisResult.sortingAndCategories.sorting.options.length,
            hasCategories: analysisResult.sortingAndCategories.categories.found,
            categoriesCount: analysisResult.sortingAndCategories.categories.totalCount || 0,
            videoCardsFound: analysisResult.videoCards.totalCardsFound,
            videoCardSelector: analysisResult.videoCards.cardSelector,
            videoSourceFound: analysisResult.videoPage.videoSources?.found || false,
            videoSourceMethods: analysisResult.videoPage.videoSources?.methods || [],
            hasRelatedVideos: analysisResult.videoPage.relatedVideos?.found || false
        };

        analysisResult._transportLog = transportLog;
        displayResults(analysisResult);
        setProgress(100, '✅ Готово!');
        setStatus('✅ Анализ завершён успешно!', 'success');

    } catch (err) {
        setStatus(`❌ ${err.message}`, 'error');
        setProgress(0, `❌ ${err.message.substring(0, 80)}`, 'cors-error');
        analysisResult._transportLog = transportLog;
        displayResults(analysisResult);
    } finally {
        if (btnAnalyze) { btnAnalyze.disabled = false; btnAnalyze.textContent = '🚀 Полный анализ'; }
    }
}

// ================================================================
// ОТОБРАЖЕНИЕ
// ================================================================

function displayResults(data) {
    const resultsDiv = document.getElementById('results');
    if (resultsDiv) resultsDiv.style.display = 'block';
    const jsonStr = JSON.stringify(data, null, 2);
    document.getElementById('jsonFormatted').innerHTML = syntaxHighlight(jsonStr);
    document.getElementById('jsonRaw').value = jsonStr;
    document.getElementById('visualReport').innerHTML = generateVisualReport(data);
    document.getElementById('btnCopy').disabled = false;
    document.getElementById('btnDownload').disabled = false;
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, match => {
        let cls = 'color:#ae81ff;';
        if (/^"/.test(match)) cls = /:$/.test(match) ? 'color:#a6e22e;' : 'color:#e6db74;';
        else if (/true|false/.test(match)) cls = 'color:#66d9ef;';
        else if (/null/.test(match)) cls = 'color:#f92672;';
        return `<span style="${cls}">${match}</span>`;
    });
}

function generateVisualReport(data) {
    let html = '';

    // Ошибка CORS
    if (data._error) {
        html += `<div class="report-section cors-error-section">
            <div class="report-section-header">🛡️ Ошибка доступа</div>
            <div class="report-section-body">
                <div class="report-item"><span class="report-label">Тип:</span><span class="report-value error">${escapeHtml(data._error.type)}</span></div>
                <div class="report-item"><span class="report-label">Описание:</span><span class="report-value error">${escapeHtml(data._error.message)}</span></div>
                ${data._error.suggestion ? `<div class="report-item"><span class="report-label">Решение:</span><span class="report-value warning">${escapeHtml(data._error.suggestion)}</span></div>` : ''}
                <div class="cors-help-box">
                    <h4>💡 Что такое CORS и как обойти?</h4>
                    <p>CORS (Cross-Origin Resource Sharing) — механизм безопасности браузера, запрещающий загрузку данных с другого домена без разрешения сервера.</p>
                    <p><strong>Варианты решения:</strong></p>
                    <ol>
                        <li><strong>Cloudflare Worker</strong> — задайте URL Worker-а в блоке сверху (самый надёжный способ)</li>
                        <li>Переключите режим на <strong>"Авто"</strong> — автоматический перебор 6 прокси</li>
                        <li>Разверните собственный <a href="https://github.com/Rob--W/cors-anywhere" target="_blank">cors-anywhere</a></li>
                    </ol>
                </div>
            </div>
        </div>`;
    }

    // Транспорт-лог
    if (data._transportLog && data._transportLog.length > 0) {
        html += `<div class="report-section">
            <div class="report-section-header">🔌 Лог транспорта (${data._transportLog.length} шагов)</div>
            <div class="report-section-body">
                <div class="transport-log">`;
        data._transportLog.forEach(entry => {
            html += `<div class="transport-log-entry ${entry.type}">[${entry.time}] ${escapeHtml(entry.message)}</div>`;
        });
        html += `</div></div></div>`;
    }

    // Сводка
    if (data._summary) {
        html += `<div class="report-section">
            <div class="report-section-header">📋 Сводка</div>
            <div class="report-section-body">
                <div class="report-item"><span class="report-label">URL:</span><span class="report-value">${escapeHtml(data._meta.analyzedUrl)}</span></div>
                <div class="report-item"><span class="report-label">Worker:</span><span class="report-value">${data._meta.workerUsed !== 'нет' ? '✅ ' + escapeHtml(data._meta.workerUsed) : '❌ не задан'}</span></div>
                <div class="report-item"><span class="report-label">Режим:</span><span class="report-value">${escapeHtml(data._meta.proxyMode === 'auto' ? 'Авто (каскад)' : data._meta.proxyMode === '' ? 'Прямой' : data._meta.proxyMode)}</span></div>
                <div class="report-item"><span class="report-label">Кодировка:</span><span class="report-value">${data.encoding?.charset || 'N/A'}</span></div>
                <div class="report-item"><span class="report-label">Пагинация:</span><span class="report-value ${data._summary.hasPagination ? '' : 'warning'}">${data._summary.hasPagination ? '✅ ' + data._summary.paginationPattern : '❌ Не найдена'}</span></div>
                <div class="report-item"><span class="report-label">Поиск:</span><span class="report-value ${data._summary.hasSearch ? '' : 'warning'}">${data._summary.hasSearch ? '✅ Найден' : '❌ Не найден'}</span></div>
                <div class="report-item"><span class="report-label">Сортировка:</span><span class="report-value ${data._summary.hasSorting ? '' : 'warning'}">${data._summary.hasSorting ? '✅ ' + data._summary.sortingOptionsCount + ' вариантов' : '❌ Не найдена'}</span></div>
                <div class="report-item"><span class="report-label">Категории:</span><span class="report-value ${data._summary.hasCategories ? '' : 'warning'}">${data._summary.hasCategories ? '✅ ' + data._summary.categoriesCount + ' шт.' : '❌ Не найдены'}</span></div>
                <div class="report-item"><span class="report-label">Карточек:</span><span class="report-value">${data._summary.videoCardsFound}</span></div>
                <div class="report-item"><span class="report-label">Видео-источники:</span><span class="report-value ${data._summary.videoSourceFound ? '' : 'warning'}">${data._summary.videoSourceFound ? '✅ (' + data._summary.videoSourceMethods.join(', ') + ')' : '❌ Не найдены'}</span></div>
            </div>
        </div>`;
    }

    // Карточки
    if (data.videoCards?.found) {
        const st = data.videoCards.structure;
        html += `<div class="report-section"><div class="report-section-header">🎬 Структура карточки</div><div class="report-section-body">
            <div class="report-item"><span class="report-label">Селектор:</span><span class="report-value"><span class="tag">${escapeHtml(data.videoCards.cardSelector)}</span></span></div>`;
        if (st.title.selector) html += `<div class="report-item"><span class="report-label">Название:</span><span class="report-value"><span class="tag">${escapeHtml(st.title.selector)}</span></span></div>`;
        if (st.link.selector) html += `<div class="report-item"><span class="report-label">Ссылка:</span><span class="report-value"><span class="tag">${escapeHtml(st.link.selector)}</span><br>Паттерн: ${escapeHtml(st.link.pattern || 'N/A')}</span></div>`;
        if (st.thumbnail.selector) html += `<div class="report-item"><span class="report-label">Превью:</span><span class="report-value"><span class="tag">${escapeHtml(st.thumbnail.selector)}</span> (attr: ${escapeHtml(st.thumbnail.attribute)})</span></div>`;
        if (st.duration.selector) html += `<div class="report-item"><span class="report-label">Длительность:</span><span class="report-value"><span class="tag">${escapeHtml(st.duration.selector)}</span> — "${escapeHtml(st.duration.example || '')}"</span></div>`;
        if (st.quality.selector) html += `<div class="report-item"><span class="report-label">Качество:</span><span class="report-value"><span class="tag">${escapeHtml(st.quality.selector)}</span> — "${escapeHtml(st.quality.example || '')}"</span></div>`;
        html += `</div></div>`;

        if (data.videoCards.sampleCards.length > 0) {
            html += `<div class="report-section"><div class="report-section-header">📑 Примеры карточек (${data.videoCards.sampleCards.length})</div><div class="report-section-body">`;
            data.videoCards.sampleCards.forEach((c, i) => {
                html += `<div style="margin-bottom:15px;padding:10px;background:#0f0f23;border-radius:8px;"><strong style="color:#00d4ff;">#${i + 1}</strong><br>`;
                if (c.title) html += `📌 <strong>Название:</strong> ${escapeHtml(c.title)}<br>`;
                if (c.link) html += `🔗 <strong>Ссылка:</strong> <a style="color:#00ff88;" href="${escapeHtml(c.link)}" target="_blank">${escapeHtml(c.link.substring(0, 80))}…</a><br>`;
                if (c.thumbnail) html += `🖼 <strong>Превью:</strong> <a style="color:#e6db74;" href="${escapeHtml(c.thumbnail)}" target="_blank">Открыть</a><br>`;
                if (c.duration) html += `⏱ <strong>Длительность:</strong> ${escapeHtml(c.duration)}<br>`;
                if (c.quality) html += `📺 <strong>Качество:</strong> ${escapeHtml(c.quality)}<br>`;
                html += `</div>`;
            });
            html += `</div></div>`;
        }
    }

    // Видео-страница
    if (data.videoPage?.analyzed) {
        html += `<div class="report-section"><div class="report-section-header">▶️ Страница видео</div><div class="report-section-body">
            <div class="report-item"><span class="report-label">URL паттерн:</span><span class="report-value">${escapeHtml(data.videoPage.urlStructure?.pattern || 'N/A')}</span></div>`;
        if (data.videoPage.videoSources?.sources?.length > 0) {
            html += `<div class="report-item"><span class="report-label">Источники:</span><span class="report-value">`;
            data.videoPage.videoSources.sources.forEach(s => { html += `<div style="margin:4px 0;"><span class="tag">${escapeHtml(s.type)}</span> ${escapeHtml(s.foundIn)} — <span style="color:#e6db74;word-break:break-all;">${escapeHtml(s.url.substring(0, 100))}…</span></div>`; });
            html += `</span></div>`;
        }
        if (data.videoPage.videoSources?.playerIframes?.length > 0) {
            html += `<div class="report-item"><span class="report-label">iframes:</span><span class="report-value">`;
            data.videoPage.videoSources.playerIframes.forEach(f => { html += `<div style="margin:4px 0;"><span class="tag">iframe</span> ${escapeHtml(f.src)}</div>`; });
            html += `</span></div>`;
        }
        if (data.videoPage.relatedVideos?.found) html += `<div class="report-item"><span class="report-label">Похожие:</span><span class="report-value">✅ ${data.videoPage.relatedVideos.count} ссылок — <span class="tag">${escapeHtml(data.videoPage.relatedVideos.selector)}</span></span></div>`;
        if (data.videoPage.error) html += `<div class="report-item"><span class="report-label">⚠️ Ошибка:</span><span class="report-value error">${escapeHtml(data.videoPage.error)}</span></div>`;
        html += `</div></div>`;
    }

    // Категории
    if (data.sortingAndCategories?.categories?.found) {
        html += `<div class="report-section"><div class="report-section-header">📁 Категории (${data.sortingAndCategories.categories.totalCount})</div><div class="report-section-body" style="max-height:300px;overflow-y:auto;">`;
        data.sortingAndCategories.categories.list.forEach(c => { html += `<span class="tag" style="margin:3px;">${escapeHtml(c.name)}</span>`; });
        html += `</div></div>`;
    }

    return html;
}

// ================================================================
// UI
// ================================================================

function showTab(name) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    const tab = document.getElementById('tab-' + name);
    if (tab) tab.classList.add('active');
    if (event?.target) event.target.classList.add('active');
}

function copyResults() {
    if (!analysisResult) return;
    const json = JSON.stringify(analysisResult, null, 2);
    navigator.clipboard.writeText(json)
        .then(() => setStatus('📋 JSON скопирован!', 'success'))
        .catch(() => {
            const ta = document.getElementById('jsonRaw');
            ta.select(); document.execCommand('copy');
            setStatus('📋 JSON скопирован!', 'success');
        });
}

function downloadResults() {
    if (!analysisResult) return;
    const json = JSON.stringify(analysisResult, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    try { a.download = `site-analysis-${new URL(analysisResult._meta.analyzedUrl).hostname}-${Date.now()}.json`; }
    catch { a.download = `site-analysis-${Date.now()}.json`; }
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus('💾 JSON скачан!', 'success');
}

function onProxyChange() {
    const sel = document.getElementById('proxySelect');
    const hint = document.getElementById('proxyHint');
    if (!hint || !sel) return;
    const hints = {
        'auto': '🔄 Сначала прямой запрос → Worker (если задан) → перебор 6 публичных прокси при CORS',
        '': '🔗 Только прямой запрос. Работает если сайт разрешает CORS. Иначе — ошибка.',
        'https://api.allorigins.win/raw?url=': '🌐 allorigins.win — надёжный публичный прокси',
        'https://corsproxy.io/?': '🌐 corsproxy.io — быстрый публичный прокси',
        'https://api.codetabs.com/v1/proxy?quest=': '🌐 codetabs.com — публичный прокси (бывают лимиты)',
        'https://thingproxy.freeboard.io/fetch/': '🌐 thingproxy — URL передаётся напрямую после /fetch/',
        'https://cors-anywhere.herokuapp.com/': '🌐 cors-anywhere — может требовать ручной активации на сайте прокси',
        'https://cors.bridged.cc/': '🌐 cors.bridged.cc — URL передаётся напрямую'
    };
    hint.textContent = hints[sel.value] || '';
}

// ================================================================
// ИНИЦИАЛИЗАЦИЯ
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    // URL
    const urlInput = document.getElementById('targetUrl');
    if (DEFAULT_TARGET_URL && urlInput && !urlInput.value) urlInput.value = DEFAULT_TARGET_URL;
    if (urlInput) urlInput.addEventListener('keypress', e => { if (e.key === 'Enter') runFullAnalysis(); });

    // Прокси подсказка
    const proxySelect = document.getElementById('proxySelect');
    if (proxySelect) { proxySelect.addEventListener('change', onProxyChange); onProxyChange(); }

    // Worker — сохранение/восстановление из localStorage
    const workerInput = document.getElementById('workerUrl');
    if (workerInput) {
        const saved = localStorage.getItem('analyzerWorkerUrl');
        if (saved) { workerInput.value = saved; updateWorkerStatus(true); }
        workerInput.addEventListener('input', () => {
            updateWorkerStatus(!!workerInput.value.trim());
        });
        workerInput.addEventListener('change', () => {
            const val = workerInput.value.trim();
            if (val) localStorage.setItem('analyzerWorkerUrl', val);
            else localStorage.removeItem('analyzerWorkerUrl');
        });
    }
});
