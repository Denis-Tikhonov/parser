// ================================================================
// SITE STRUCTURE ANALYZER — parser.js v1.1
// ================================================================
//
// ▶▶▶ КАК ИСПОЛЬЗОВАТЬ:
// 1. Введите URL в поле на странице
// 2. Или впишите URL прямо здесь:

const DEFAULT_TARGET_URL = "";
// ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
// ВСТАВЬТЕ ССЫЛКУ СЮДА, например:
// const DEFAULT_TARGET_URL = "https://trahkino.me/video/";
// ================================================================

let analysisResult = null;

// ---- Утилиты ----

function setStatus(msg, type = 'loading') {
    const el = document.getElementById('status');
    el.textContent = msg;
    el.className = 'status ' + type;
}

function setProgress(percent, text, subtype) {
    const container = document.getElementById('progress-container');
    const bar = document.getElementById('progress-bar');
    const txt = document.getElementById('progress-text');
    container.style.display = 'block';
    bar.style.width = percent + '%';
    txt.textContent = text || (percent + '%');

    // Меняем цвет полоски при ошибке CORS
    if (subtype === 'cors-error') {
        bar.classList.add('cors-error');
    } else if (subtype === 'warning') {
        bar.classList.add('warning');
    } else {
        bar.classList.remove('cors-error', 'warning');
    }
}

function hideProgress() {
    const container = document.getElementById('progress-container');
    if (container) container.style.display = 'none';
}

function getBaseUrl(url) {
    try {
        const u = new URL(url);
        return u.origin;
    } catch {
        return '';
    }
}

function resolveUrl(href, baseUrl) {
    if (!href) return '';
    try {
        return new URL(href, baseUrl).href;
    } catch {
        return href;
    }
}

function uniqueArray(arr) {
    return [...new Set(arr.filter(Boolean))];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================================================================
// ЗАГРУЗКА СТРАНИЦЫ — каскадная стратегия
// ================================================================
//
// 1) Прямой запрос (без прокси)             ← по умолчанию
// 2) Если CORS → автоматически через прокси  ← фоллбэк
// 3) Если прокси тоже не сработал → ошибка с пояснением
// ================================================================

async function fetchPage(url) {
    const proxySelect = document.getElementById('proxySelect');
    const selectedProxy = proxySelect.value;

    // ── Стратегия 1: выбран "Без прокси" → прямой запрос ──
    if (selectedProxy === '') {
        return await fetchDirect(url);
    }

    // ── Стратегия 2: выбран "Авто" → сначала прямой, потом прокси ──
    if (selectedProxy === 'auto') {
        // Попытка 1: Прямой запрос
        try {
            updateCorsIndicator('trying-direct');
            const html = await fetchDirect(url);
            // Успешно без прокси
            updateCorsIndicator('direct-ok');
            return html;
        } catch (directErr) {
            const isCors = isCorsError(directErr);
            if (isCors) {
                updateCorsIndicator('cors-detected');
                setStatus('⚠️ CORS-блокировка обнаружена. Подключаю прокси...', 'loading');
                setProgress(15, '🔄 CORS обнаружен → пробую прокси...', 'warning');
            } else {
                setStatus(`⚠️ Прямой запрос не удался: ${directErr.message}. Пробую прокси...`, 'loading');
                setProgress(15, '🔄 Прямой запрос не удался → прокси...', 'warning');
            }
        }

        // Попытка 2: Перебор публичных прокси
        const proxies = getProxyList();
        for (let i = 0; i < proxies.length; i++) {
            const proxy = proxies[i];
            try {
                setProgress(15 + i * 2, `🔄 Пробую прокси: ${proxy.name}...`, 'warning');
                const html = await fetchViaProxy(url, proxy.url);
                updateCorsIndicator('proxy-ok', proxy.name);
                setStatus(`✅ Загружено через прокси: ${proxy.name}`, 'success');
                return html;
            } catch (proxyErr) {
                console.warn(`Proxy ${proxy.name} failed:`, proxyErr.message);
            }
        }

        // Все прокси не сработали
        updateCorsIndicator('all-failed');
        throw new Error(
            'Не удалось загрузить страницу. Сайт блокирует все доступные методы.\n' +
            '🛡️ Возможные причины:\n' +
            '• CORS-политика сервера запрещает кросс-доменные запросы\n' +
            '• Сайт защищён Cloudflare / DDoS Guard\n' +
            '• Публичные прокси заблокированы или перегружены\n\n' +
            '💡 Решение: разверните собственный CORS-прокси (cors-anywhere)'
        );
    }

    // ── Стратегия 3: выбран конкретный прокси ──
    try {
        return await fetchViaProxy(url, selectedProxy);
    } catch (err) {
        if (isCorsError(err)) {
            throw new Error(
                `Прокси не смог загрузить страницу. ` +
                `Попробуйте режим "Авто" или другой прокси.\n` +
                `Ошибка: ${err.message}`
            );
        }
        throw err;
    }
}

// Прямой fetch без прокси
async function fetchDirect(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(url, {
            headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        if (!html || html.length < 50) {
            throw new Error('Получен пустой или слишком короткий ответ');
        }
        return html;
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

// Fetch через указанный прокси
async function fetchViaProxy(url, proxyPrefix) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const fetchUrl = proxyPrefix + encodeURIComponent(url);
        const response = await fetch(fetchUrl, {
            headers: { 'Accept': 'text/html,application/xhtml+xml,*/*' },
            signal: controller.signal
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        if (!html || html.length < 50) {
            throw new Error('Прокси вернул пустой ответ');
        }
        return html;
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}

// Определение CORS-ошибки
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
        msg.includes('type error') ||
        error.name === 'TypeError'
    );
}

// Список публичных прокси для автоматического перебора
function getProxyList() {
    return [
        { name: 'allorigins.win', url: 'https://api.allorigins.win/raw?url=' },
        { name: 'corsproxy.io', url: 'https://corsproxy.io/?' },
        { name: 'codetabs.com', url: 'https://api.codetabs.com/v1/proxy?quest=' }
    ];
}

// Обновление индикатора CORS в UI
function updateCorsIndicator(state, proxyName) {
    const indicator = document.getElementById('corsIndicator');
    if (!indicator) return;

    indicator.style.display = 'block';

    const states = {
        'trying-direct': {
            text: '🔗 Прямое подключение...',
            className: 'cors-indicator trying'
        },
        'direct-ok': {
            text: '✅ Прямое подключение — CORS разрешён',
            className: 'cors-indicator direct-ok'
        },
        'cors-detected': {
            text: '🛡️ CORS-блокировка обнаружена — подключаю прокси...',
            className: 'cors-indicator cors-blocked'
        },
        'proxy-ok': {
            text: `✅ Загружено через прокси: ${proxyName || ''}`,
            className: 'cors-indicator proxy-ok'
        },
        'all-failed': {
            text: '❌ Все методы заблокированы (CORS / Cloudflare / DDoS-защита)',
            className: 'cors-indicator all-failed'
        },
        'hidden': {
            text: '',
            className: 'cors-indicator'
        }
    };

    const s = states[state] || states['hidden'];
    indicator.textContent = s.text;
    indicator.className = s.className;
}

function parseHTML(html) {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
}

// ================================================================
// АНАЛИЗАТОРЫ
// ================================================================

// 1) Кодировка
function analyzeEncoding(doc, html) {
    const metaCharset = doc.querySelector('meta[charset]');
    const metaContentType = doc.querySelector('meta[http-equiv="Content-Type"]');

    let charset = 'Не определено';
    if (metaCharset) {
        charset = metaCharset.getAttribute('charset');
    } else if (metaContentType) {
        const content = metaContentType.getAttribute('content') || '';
        const match = content.match(/charset=([^\s;]+)/i);
        if (match) charset = match[1];
    }

    return {
        charset: charset.toUpperCase(),
        source: metaCharset ? '<meta charset>' : metaContentType ? '<meta http-equiv>' : 'не найдено',
        hasUtf8Bom: html.charCodeAt(0) === 0xFEFF
    };
}

// 2) Пагинация
function analyzePagination(doc, baseUrl, targetUrl) {
    const result = {
        mainPageUrl: targetUrl,
        pagination: {
            found: false,
            type: null,
            pattern: null,
            examples: [],
            selectors: []
        }
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
                links.forEach(a => {
                    const href = a.getAttribute('href');
                    if (href) paginationLinks.push(href);
                });
                break;
            }
        } catch (e) {}
    }

    if (paginationLinks.length === 0) {
        const allLinks = doc.querySelectorAll('a[href]');
        allLinks.forEach(a => {
            const href = a.getAttribute('href') || '';
            const text = a.textContent.trim();
            if (
                /[?&]page=\d+/i.test(href) ||
                /\/page\/\d+/i.test(href) ||
                /\/p\/\d+/i.test(href) ||
                /[?&]p=\d+/i.test(href) ||
                /[?&]from=\d+/i.test(href) ||
                (/\/\d+\/?$/.test(href) && /^\d+$/.test(text))
            ) {
                paginationLinks.push(href);
            }
        });
        if (paginationLinks.length > 0) {
            matchedSelector = 'a[href] (по паттерну URL)';
        }
    }

    if (paginationLinks.length > 0) {
        result.pagination.found = true;
        result.pagination.selectors.push(matchedSelector);
        result.pagination.examples = uniqueArray(
            paginationLinks.map(h => resolveUrl(h, baseUrl))
        ).slice(0, 10);

        const sampleHref = paginationLinks[0];
        if (/[?&]page=\d+/i.test(sampleHref)) {
            result.pagination.type = 'query_parameter';
            result.pagination.pattern = '?page=N';
        } else if (/\/page\/\d+/i.test(sampleHref)) {
            result.pagination.type = 'path_segment';
            result.pagination.pattern = '/page/N/';
        } else if (/[?&]from=\d+/i.test(sampleHref)) {
            result.pagination.type = 'offset';
            result.pagination.pattern = '?from=N';
        } else {
            result.pagination.type = 'other';
            result.pagination.pattern = sampleHref;
        }
    }

    const paginationContainers = [
        '.pagination', '.pager', '.pages', '.paginator',
        'nav.pagination', '.page-nav', '.wp-pagenavi',
        '[class*="pagination"]'
    ];

    for (const sel of paginationContainers) {
        try {
            const el = doc.querySelector(sel);
            if (el) {
                result.pagination.containerSelector = sel;
                result.pagination.containerHTML = el.outerHTML.substring(0, 500);
                break;
            }
        } catch (e) {}
    }

    return result;
}

// 3) Поиск
function analyzeSearch(doc, baseUrl, html) {
    const result = {
        found: false,
        forms: [],
        searchUrl: null,
        searchPattern: null
    };

    const forms = doc.querySelectorAll('form');
    forms.forEach(form => {
        const action = form.getAttribute('action') || '';
        const inputs = form.querySelectorAll('input');
        let hasSearchInput = false;
        let inputDetails = [];

        inputs.forEach(input => {
            const type = (input.getAttribute('type') || 'text').toLowerCase();
            const name = input.getAttribute('name') || '';
            const placeholder = input.getAttribute('placeholder') || '';

            if (
                type === 'search' || type === 'text' ||
                name.match(/^(q|query|search|s|keyword|k|find)$/i) ||
                placeholder.match(/(поиск|search|найти|искать)/i)
            ) {
                hasSearchInput = true;
            }

            inputDetails.push({ type, name, placeholder, classes: input.className });
        });

        if (hasSearchInput || action.match(/(search|find|poisk)/i)) {
            result.found = true;
            result.forms.push({
                action: resolveUrl(action, baseUrl),
                method: (form.getAttribute('method') || 'GET').toUpperCase(),
                inputs: inputDetails,
                formClasses: form.className,
                formId: form.id
            });
        }
    });

    const searchLinks = doc.querySelectorAll('a[href*="search"], a[href*="find"]');
    const searchLinkData = [];
    searchLinks.forEach(a => {
        searchLinkData.push({
            href: resolveUrl(a.getAttribute('href'), baseUrl),
            text: a.textContent.trim().substring(0, 100)
        });
    });
    if (searchLinkData.length > 0) result.searchLinks = searchLinkData.slice(0, 5);

    if (result.forms.length > 0) {
        const form = result.forms[0];
        const searchInput = form.inputs.find(i =>
            i.name.match(/^(q|query|search|s|keyword|k)$/i)
        );
        const paramName = searchInput ? searchInput.name : 'q';

        if (form.method === 'GET') {
            result.searchPattern = `${form.action}?${paramName}={запрос}`;
            result.searchUrl = form.action;
        } else {
            result.searchPattern = `POST ${form.action} (${paramName}={запрос})`;
            result.searchUrl = form.action;
        }
    }

    return result;
}

// 4) Сортировка и категории
function analyzeSortingAndCategories(doc, baseUrl) {
    const result = {
        sorting: { found: false, options: [], urlPattern: null },
        categories: { found: false, list: [], urlPattern: null }
    };

    // Сортировка
    const sortSelectors = [
        'select[name*="sort"]', 'select[name*="order"]',
        '[class*="sort"] a', '.sorting a', '.sort-options a',
        'a[href*="sort="]', 'a[href*="order="]',
        '[class*="tabs"] a', '.list-tabs a'
    ];

    for (const sel of sortSelectors) {
        try {
            const elements = doc.querySelectorAll(sel);
            elements.forEach(el => {
                if (el.tagName === 'SELECT') {
                    el.querySelectorAll('option').forEach(opt => {
                        result.sorting.options.push({
                            label: opt.textContent.trim(),
                            value: opt.value,
                            url: null
                        });
                    });
                    result.sorting.found = true;
                } else if (el.tagName === 'A') {
                    const href = el.getAttribute('href');
                    if (href) {
                        result.sorting.options.push({
                            label: el.textContent.trim(),
                            value: null,
                            url: resolveUrl(href, baseUrl)
                        });
                        result.sorting.found = true;
                    }
                }
            });
            if (result.sorting.found) break;
        } catch (e) {}
    }

    if (!result.sorting.found) {
        const allLinks = doc.querySelectorAll('a[href]');
        const sortPatterns = /(sort|order|popular|rating|newest|latest|longest|viewed|top)/i;
        allLinks.forEach(a => {
            const href = a.getAttribute('href') || '';
            const text = a.textContent.trim();
            if (sortPatterns.test(href) && text.length < 50 && text.length > 0) {
                result.sorting.options.push({
                    label: text, value: null, url: resolveUrl(href, baseUrl)
                });
                result.sorting.found = true;
            }
        });
    }

    const seen = new Set();
    result.sorting.options = result.sorting.options.filter(o => {
        const key = o.label + '|' + (o.url || o.value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 20);

    if (result.sorting.options.length > 0) {
        const sampleUrl = result.sorting.options.find(o => o.url)?.url;
        if (sampleUrl) {
            if (/[?&]sort=/i.test(sampleUrl)) result.sorting.urlPattern = '?sort={value}';
            else if (/[?&]order=/i.test(sampleUrl)) result.sorting.urlPattern = '?order={value}';
            else result.sorting.urlPattern = sampleUrl;
        }
    }

    // Категории
    const categorySelectors = [
        '.categories a', '.category-list a', '.cats a',
        'nav.categories a', '.tags a', '[class*="categor"] a',
        'a[href*="/categories/"]', 'a[href*="/category/"]',
        'a[href*="/tags/"]', 'a[href*="/tag/"]', 'a[href*="/cat/"]'
    ];

    const categoryLinks = [];
    let catSelector = '';

    for (const sel of categorySelectors) {
        try {
            const links = doc.querySelectorAll(sel);
            if (links.length >= 3) {
                catSelector = sel;
                links.forEach(a => {
                    const href = a.getAttribute('href');
                    const text = a.textContent.trim();
                    if (href && text && text.length < 100) {
                        categoryLinks.push({ name: text, url: resolveUrl(href, baseUrl) });
                    }
                });
                break;
            }
        } catch (e) {}
    }

    if (categoryLinks.length === 0) {
        const allLinks = doc.querySelectorAll('a[href]');
        const catPatterns = /\/(categories|category|cat|tags|tag|genre|genres)\//i;
        allLinks.forEach(a => {
            const href = a.getAttribute('href') || '';
            const text = a.textContent.trim();
            if (catPatterns.test(href) && text.length > 0 && text.length < 100) {
                categoryLinks.push({ name: text, url: resolveUrl(href, baseUrl) });
            }
        });
        if (categoryLinks.length > 0) catSelector = 'a[href] (по URL-паттерну)';
    }

    if (categoryLinks.length > 0) {
        result.categories.found = true;
        const seenCats = new Set();
        result.categories.list = categoryLinks.filter(c => {
            if (seenCats.has(c.url)) return false;
            seenCats.add(c.url);
            return true;
        }).slice(0, 50);
        result.categories.selector = catSelector;
        result.categories.totalCount = result.categories.list.length;

        if (result.categories.list.length > 0) {
            try {
                const urlPath = new URL(result.categories.list[0].url).pathname;
                result.categories.urlPattern = urlPath.replace(/[^/]+\/?$/, '{category_name}/');
            } catch (e) {}
        }
    }

    return result;
}

// 5) Карточки видео
function analyzeVideoCards(doc, baseUrl) {
    const result = {
        found: false,
        cardSelector: null,
        totalCardsFound: 0,
        structure: {
            title: { selector: null, example: null },
            link: { selector: null, example: null, pattern: null },
            thumbnail: { selector: null, example: null, attribute: null },
            duration: { selector: null, example: null },
            quality: { selector: null, example: null }
        },
        sampleCards: []
    };

    const cardSelectors = [
        '.video-item', '.video-card', '.thumb-item', '.thumb',
        '.video-thumb', '.video_block', '.video-block',
        '.item', '.video', '.clip', '.gallery-item',
        'article', '.post', '.list-item', '.grid-item',
        '[data-video-id]', '[data-id]', '.col', '.card'
    ];

    let cards = [];
    let usedSelector = '';

    for (const sel of cardSelectors) {
        try {
            const found = doc.querySelectorAll(sel);
            if (found.length >= 2) {
                const hasLinks = Array.from(found).some(el => el.querySelector('a[href]'));
                const hasImages = Array.from(found).some(el => el.querySelector('img'));
                if (hasLinks && hasImages) {
                    cards = Array.from(found);
                    usedSelector = sel;
                    break;
                }
            }
        } catch (e) {}
    }

    if (cards.length === 0) {
        const allDivs = doc.querySelectorAll('div, li, article');
        const potential = [];
        allDivs.forEach(div => {
            const imgs = div.querySelectorAll(':scope > img, :scope > a > img, :scope > div > img');
            const links = div.querySelectorAll(':scope > a[href]');
            if (imgs.length >= 1 && links.length >= 1 && div.querySelectorAll('a[href]').length < 10) {
                potential.push(div);
            }
        });
        if (potential.length >= 3) {
            cards = potential;
            usedSelector = 'auto-detected (div/li with img+a)';
        }
    }

    if (cards.length === 0) return result;

    result.found = true;
    result.cardSelector = usedSelector;
    result.totalCardsFound = cards.length;

    const sampleSize = Math.min(5, cards.length);

    for (let i = 0; i < sampleSize; i++) {
        const card = cards[i];
        const cardData = {};

        // Название
        const titleSelectors = [
            'h1', 'h2', 'h3', 'h4', 'h5',
            '.title', '.name', '.video-title',
            'a[title]', '[class*="title"]', 'strong', 'b'
        ];
        for (const ts of titleSelectors) {
            try {
                const titleEl = card.querySelector(ts);
                if (titleEl) {
                    const text = titleEl.textContent.trim();
                    if (text.length > 2 && text.length < 300) {
                        cardData.title = text;
                        if (i === 0) {
                            result.structure.title.selector = `${usedSelector} ${ts}`;
                            result.structure.title.tag = titleEl.tagName.toLowerCase();
                            result.structure.title.classes = titleEl.className;
                            result.structure.title.example = text;
                        }
                        break;
                    }
                }
            } catch (e) {}
        }

        if (!cardData.title) {
            const aWithTitle = card.querySelector('a[title]');
            if (aWithTitle) {
                cardData.title = aWithTitle.getAttribute('title');
                if (i === 0) {
                    result.structure.title.selector = `${usedSelector} a[title]`;
                    result.structure.title.attribute = 'title';
                }
            }
        }

        // Ссылка
        const linkEl = card.querySelector('a[href]');
        if (linkEl) {
            const href = linkEl.getAttribute('href');
            cardData.link = resolveUrl(href, baseUrl);
            if (i === 0) {
                result.structure.link.selector = `${usedSelector} a[href]`;
                result.structure.link.example = cardData.link;
                try {
                    const path = new URL(cardData.link).pathname;
                    result.structure.link.pattern = path
                        .replace(/\/\d+\//g, '/{id}/')
                        .replace(/\/\d+$/g, '/{id}')
                        .replace(/\/[a-z0-9-]+\.html$/i, '/{slug}.html')
                        .replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/');
                } catch (e) {}
            }
        }

        // Превью
        const imgAttrs = ['data-src', 'data-original', 'data-lazy-src', 'data-thumb', 'src'];
        const imgEl = card.querySelector('img');
        if (imgEl) {
            for (const attr of imgAttrs) {
                const src = imgEl.getAttribute(attr);
                if (src && !src.startsWith('data:') && src !== '') {
                    cardData.thumbnail = resolveUrl(src, baseUrl);
                    if (i === 0) {
                        result.structure.thumbnail.selector = `${usedSelector} img`;
                        result.structure.thumbnail.attribute = attr;
                        result.structure.thumbnail.classes = imgEl.className;
                        result.structure.thumbnail.example = cardData.thumbnail;
                    }
                    break;
                }
            }
        }

        // Длительность
        const durSelectors = [
            '.duration', '.time', '.video-time',
            '[class*="duration"]', '[class*="time"]'
        ];
        for (const ds of durSelectors) {
            try {
                const durEl = card.querySelector(ds);
                if (durEl) {
                    const text = durEl.textContent.trim();
                    if (/\d{1,2}:\d{2}/.test(text)) {
                        cardData.duration = text;
                        if (i === 0) {
                            result.structure.duration.selector = `${usedSelector} ${ds}`;
                            result.structure.duration.tag = durEl.tagName.toLowerCase();
                            result.structure.duration.classes = durEl.className;
                            result.structure.duration.example = text;
                        }
                        break;
                    }
                }
            } catch (e) {}
        }
        if (!cardData.duration) {
            const allSpans = card.querySelectorAll('span, div, small, em');
            for (const el of allSpans) {
                const text = el.textContent.trim();
                if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
                    cardData.duration = text;
                    if (i === 0) {
                        result.structure.duration.selector = `${usedSelector} ${el.tagName.toLowerCase()}`;
                        result.structure.duration.example = text;
                    }
                    break;
                }
            }
        }

        // Качество
        const qualSelectors = [
            '.quality', '.hd', '[class*="quality"]', '[class*="hd"]', '[class*="resolution"]'
        ];
        for (const qs of qualSelectors) {
            try {
                const qEl = card.querySelector(qs);
                if (qEl) {
                    const text = qEl.textContent.trim();
                    if (/\b(HD|FHD|4K|1080|720|2160|UHD|SD)\b/i.test(text)) {
                        cardData.quality = text;
                        if (i === 0) {
                            result.structure.quality.selector = `${usedSelector} ${qs}`;
                            result.structure.quality.example = text;
                        }
                        break;
                    }
                }
            } catch (e) {}
        }
        if (!cardData.quality) {
            const allEls = card.querySelectorAll('span, div, i, em, strong, b, small');
            for (const el of allEls) {
                const text = el.textContent.trim();
                if (/^(HD|FHD|4K|1080p?|720p?|2160p?|SD)$/i.test(text)) {
                    cardData.quality = text;
                    if (i === 0) {
                        result.structure.quality.selector = `${el.tagName.toLowerCase()}.${el.className}`;
                        result.structure.quality.example = text;
                    }
                    break;
                }
            }
        }

        result.sampleCards.push(cardData);
    }

    return result;
}

// 6) Страница видео
async function analyzeVideoPage(videoUrl, baseUrl) {
    const result = {
        analyzed: false,
        videoUrl: videoUrl,
        urlStructure: { pattern: null, example: videoUrl },
        videoSources: { found: false, sources: [], methods: [] },
        relatedVideos: { found: false, selector: null, count: 0 }
    };

    if (!videoUrl) return result;

    try {
        setStatus(`📥 Загрузка страницы видео: ${videoUrl.substring(0, 80)}...`, 'loading');
        setProgress(82, 'Загрузка страницы видео...');

        const html = await fetchPage(videoUrl);
        const doc = parseHTML(html);
        result.analyzed = true;

        setProgress(85, 'Анализ видео-источников...');

        try {
            const path = new URL(videoUrl).pathname;
            result.urlStructure.pattern = path
                .replace(/\/\d+\//g, '/{id}/')
                .replace(/\/\d+$/g, '/{id}')
                .replace(/\/[a-z0-9_-]{10,}\.html$/i, '/{slug}.html')
                .replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/');
        } catch (e) {}

        result.pageTitle = doc.title || null;
        const h1 = doc.querySelector('h1');
        if (h1) result.videoTitle = h1.textContent.trim();

        // Метод 1: <video>/<source>
        doc.querySelectorAll('video, video source').forEach(v => {
            const src = v.getAttribute('src') || v.getAttribute('data-src');
            if (src) {
                result.videoSources.sources.push({
                    type: src.includes('.m3u8') ? 'HLS (m3u8)' :
                          src.includes('.mp4') ? 'MP4' :
                          src.includes('.webm') ? 'WebM' : 'unknown',
                    url: resolveUrl(src, baseUrl),
                    foundIn: '<video>/<source> tag',
                    quality: v.getAttribute('label') || v.getAttribute('res') || null
                });
                result.videoSources.found = true;
                result.videoSources.methods.push('video_tag');
            }
        });

        // Метод 2: JavaScript
        const allScriptText = Array.from(doc.querySelectorAll('script'))
            .map(s => s.textContent).join('\n');

        const scriptPatterns = [
            /["'](?:file|src|source|video_url|mp4|hls|stream)["']\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8|webm)[^"']*?)["']/gi,
            /(?:file|src|source|video_url|stream)\s*[:=]\s*["'](https?:\/\/[^"']+?)["']/gi,
            /(?:https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8|webm)(?:\?[^\s"'<>]*)?)/gi
        ];

        for (const pattern of scriptPatterns) {
            let match;
            while ((match = pattern.exec(allScriptText)) !== null) {
                const url = match[1] || match[0];
                if (url && (url.includes('.mp4') || url.includes('.m3u8') || url.includes('.webm'))) {
                    const cleaned = url.replace(/\\/g, '');
                    result.videoSources.sources.push({
                        type: cleaned.includes('.m3u8') ? 'HLS (m3u8)' :
                              cleaned.includes('.mp4') ? 'MP4' : 'WebM',
                        url: cleaned,
                        foundIn: 'JavaScript inline',
                        quality: null
                    });
                    result.videoSources.found = true;
                    result.videoSources.methods.push('javascript');
                }
            }
            pattern.lastIndex = 0;
        }

        // Метод 3: meta/link
        doc.querySelectorAll(
            'meta[property="og:video"], meta[property="og:video:url"], ' +
            'meta[property="og:video:secure_url"], link[as="video"]'
        ).forEach(m => {
            const url = m.getAttribute('content') || m.getAttribute('href');
            if (url) {
                result.videoSources.sources.push({
                    type: url.includes('.m3u8') ? 'HLS (m3u8)' :
                          url.includes('.mp4') ? 'MP4' : 'unknown',
                    url: resolveUrl(url, baseUrl),
                    foundIn: 'meta/link tag',
                    quality: null
                });
                result.videoSources.found = true;
                result.videoSources.methods.push('meta_tag');
            }
        });

        // Метод 4: iframe
        const playerIframes = [];
        doc.querySelectorAll('iframe[src], iframe[data-src]').forEach(iframe => {
            const src = iframe.getAttribute('src') || iframe.getAttribute('data-src');
            if (src && (src.includes('player') || src.includes('embed') || src.includes('video'))) {
                playerIframes.push({
                    src: resolveUrl(src, baseUrl),
                    width: iframe.getAttribute('width'),
                    height: iframe.getAttribute('height')
                });
            }
        });
        if (playerIframes.length > 0) {
            result.videoSources.playerIframes = playerIframes;
            result.videoSources.methods.push('iframe');
        }

        // Дедупликация
        const seenSources = new Set();
        result.videoSources.sources = result.videoSources.sources.filter(s => {
            if (seenSources.has(s.url)) return false;
            seenSources.add(s.url);
            return true;
        });
        result.videoSources.methods = uniqueArray(result.videoSources.methods);

        // Конфиги плеера
        const playerConfigPatterns = [
            /(?:var|let|const|window\.)\s*(\w*(?:player|video|config|flashvars)\w*)\s*=\s*({[\s\S]*?});/gi
        ];
        const playerConfigs = [];
        for (const pattern of playerConfigPatterns) {
            let match;
            while ((match = pattern.exec(allScriptText)) !== null) {
                playerConfigs.push((match[2] || match[1] || '').substring(0, 1000));
            }
            pattern.lastIndex = 0;
        }
        if (playerConfigs.length > 0) {
            result.videoSources.playerConfigSnippets = playerConfigs.slice(0, 3);
        }

        // Похожие видео
        const relatedSelectors = [
            '.related', '.related-videos', '.similar', '.recommended',
            '#related', '[class*="related"]', '[class*="similar"]',
            '.more-videos'
        ];
        for (const sel of relatedSelectors) {
            try {
                const el = doc.querySelector(sel);
                if (el) {
                    const relatedLinks = el.querySelectorAll('a[href]');
                    if (relatedLinks.length > 0) {
                        result.relatedVideos.found = true;
                        result.relatedVideos.selector = sel;
                        result.relatedVideos.count = relatedLinks.length;
                        result.relatedVideos.sampleLinks = Array.from(relatedLinks)
                            .slice(0, 5)
                            .map(a => ({
                                text: a.textContent.trim().substring(0, 100),
                                href: resolveUrl(a.getAttribute('href'), baseUrl)
                            }));
                        break;
                    }
                }
            } catch (e) {}
        }

    } catch (err) {
        const isCors = isCorsError(err);
        result.error = isCors
            ? `🛡️ CORS-блокировка при загрузке страницы видео. Сервер запрещает кросс-доменные запросы. URL: ${videoUrl}`
            : `Не удалось загрузить страницу видео: ${err.message}`;

        if (isCors) {
            setProgress(85, '🛡️ CORS: страница видео заблокирована', 'cors-error');
        }
    }

    return result;
}

// 7) Мета-информация
function analyzeMeta(doc) {
    const meta = {
        title: doc.title || null,
        description: null,
        keywords: null,
        ogTitle: null,
        ogImage: null,
        language: null,
        generator: null
    };

    const desc = doc.querySelector('meta[name="description"]');
    if (desc) meta.description = desc.getAttribute('content');
    const kw = doc.querySelector('meta[name="keywords"]');
    if (kw) meta.keywords = kw.getAttribute('content');
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) meta.ogTitle = ogTitle.getAttribute('content');
    const ogImg = doc.querySelector('meta[property="og:image"]');
    if (ogImg) meta.ogImage = ogImg.getAttribute('content');
    const lang = doc.documentElement.getAttribute('lang');
    if (lang) meta.language = lang;
    const gen = doc.querySelector('meta[name="generator"]');
    if (gen) meta.generator = gen.getAttribute('content');

    return meta;
}

// ================================================================
// ГЛАВНАЯ ФУНКЦИЯ
// ================================================================

async function runFullAnalysis() {
    const urlInput = document.getElementById('targetUrl');
    const targetUrl = urlInput.value.trim() || DEFAULT_TARGET_URL;

    if (!targetUrl) {
        setStatus('❌ Введите URL для анализа!', 'error');
        return;
    }

    try {
        new URL(targetUrl);
    } catch {
        setStatus('❌ Некорректный URL! Укажите полный адрес включая https://', 'error');
        return;
    }

    urlInput.value = targetUrl;
    const baseUrl = getBaseUrl(targetUrl);

    const btnAnalyze = document.getElementById('btnAnalyze');
    btnAnalyze.disabled = true;
    btnAnalyze.textContent = '⏳ Анализирую...';

    const resultsDiv = document.getElementById('results');
    resultsDiv.style.display = 'none';

    // Сброс индикатора CORS
    updateCorsIndicator('hidden');
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.classList.remove('cors-error', 'warning');

    analysisResult = {
        _meta: {
            analyzedUrl: targetUrl,
            baseUrl: baseUrl,
            analyzedAt: new Date().toISOString(),
            proxyMode: document.getElementById('proxySelect').value || 'direct',
            tool: 'Site Structure Analyzer v1.1'
        }
    };

    try {
        // Загрузка
        setStatus('📥 Загрузка главной страницы...', 'loading');
        setProgress(10, '📡 Подключение к сайту...');

        let html;
        try {
            html = await fetchPage(targetUrl);
        } catch (fetchErr) {
            // Детальное сообщение об ошибке
            const isCors = isCorsError(fetchErr);
            if (isCors) {
                setProgress(10, '❌ CORS-блокировка! Сайт запрещает прямой доступ', 'cors-error');
                setStatus(
                    '❌ CORS-блокировка! Сайт запрещает кросс-доменные запросы из браузера.\n' +
                    '💡 Переключите режим на "Авто (прямой → прокси)" или выберите конкретный прокси.',
                    'error'
                );
                analysisResult._error = {
                    type: 'CORS',
                    message: 'Сервер не разрешает кросс-доменные запросы (отсутствует заголовок Access-Control-Allow-Origin)',
                    suggestion: 'Используйте CORS-прокси или разверните собственный cors-anywhere'
                };
            } else {
                setProgress(10, `❌ Ошибка загрузки: ${fetchErr.message.substring(0, 60)}`, 'cors-error');
                setStatus(`❌ Ошибка загрузки: ${fetchErr.message}`, 'error');
                analysisResult._error = {
                    type: 'FETCH_ERROR',
                    message: fetchErr.message
                };
            }
            displayResults(analysisResult);
            return;
        }

        const doc = parseHTML(html);
        setProgress(20, '✅ Страница загружена');
        setStatus(`✅ Страница загружена (${(html.length / 1024).toFixed(1)} KB)`, 'success');

        setProgress(25, 'Кодировка...');
        analysisResult.encoding = analyzeEncoding(doc, html);

        setProgress(30, 'Мета-информация...');
        analysisResult.siteMetaInfo = analyzeMeta(doc);

        setProgress(40, 'Пагинация...');
        analysisResult.mainPageAndPagination = analyzePagination(doc, baseUrl, targetUrl);

        setProgress(50, 'Поиск...');
        analysisResult.search = analyzeSearch(doc, baseUrl, html);

        setProgress(60, 'Сортировка и категории...');
        analysisResult.sortingAndCategories = analyzeSortingAndCategories(doc, baseUrl);

        setProgress(70, 'Карточки видео...');
        analysisResult.videoCards = analyzeVideoCards(doc, baseUrl);

        setProgress(80, 'Страница видео...');
        let sampleVideoUrl = null;
        if (analysisResult.videoCards.sampleCards?.length > 0) {
            sampleVideoUrl = analysisResult.videoCards.sampleCards[0].link;
        }
        analysisResult.videoPage = sampleVideoUrl
            ? await analyzeVideoPage(sampleVideoUrl, baseUrl)
            : { analyzed: false, note: 'Ссылки на видео не найдены' };

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

        displayResults(analysisResult);
        setProgress(100, '✅ Готово!');
        setStatus('✅ Анализ завершён успешно!', 'success');

    } catch (err) {
        setStatus(`❌ Ошибка: ${err.message}`, 'error');
        setProgress(0, `❌ ${err.message.substring(0, 80)}`, 'cors-error');
        console.error('Analysis error:', err);
    } finally {
        btnAnalyze.disabled = false;
        btnAnalyze.textContent = '🚀 Полный анализ';
    }
}

// ================================================================
// ОТОБРАЖЕНИЕ
// ================================================================

function displayResults(data) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.style.display = 'block';

    const jsonStr = JSON.stringify(data, null, 2);
    document.getElementById('jsonFormatted').innerHTML = syntaxHighlight(jsonStr);
    document.getElementById('jsonRaw').value = jsonStr;
    document.getElementById('visualReport').innerHTML = generateVisualReport(data);

    document.getElementById('btnCopy').disabled = false;
    document.getElementById('btnDownload').disabled = false;
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        function (match) {
            let cls = 'color:#ae81ff;';
            if (/^"/.test(match)) {
                cls = /:$/.test(match) ? 'color:#a6e22e;' : 'color:#e6db74;';
            } else if (/true|false/.test(match)) {
                cls = 'color:#66d9ef;';
            } else if (/null/.test(match)) {
                cls = 'color:#f92672;';
            }
            return '<span style="' + cls + '">' + match + '</span>';
        }
    );
}

function generateVisualReport(data) {
    let html = '';

    // Блок ошибки CORS (если есть)
    if (data._error) {
        html += `<div class="report-section cors-error-section">
            <div class="report-section-header">🛡️ Ошибка доступа</div>
            <div class="report-section-body">
                <div class="report-item">
                    <span class="report-label">Тип:</span>
                    <span class="report-value error">${escapeHtml(data._error.type)}</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Описание:</span>
                    <span class="report-value error">${escapeHtml(data._error.message)}</span>
                </div>
                ${data._error.suggestion ? `<div class="report-item">
                    <span class="report-label">Решение:</span>
                    <span class="report-value warning">${escapeHtml(data._error.suggestion)}</span>
                </div>` : ''}
                <div class="cors-help-box">
                    <h4>💡 Что такое CORS и как обойти?</h4>
                    <p>CORS (Cross-Origin Resource Sharing) — механизм безопасности браузера, запрещающий загрузку данных с другого домена.</p>
                    <p><strong>Варианты решения:</strong></p>
                    <ol>
                        <li>Переключите режим прокси на <strong>"Авто"</strong> — инструмент автоматически попробует публичные прокси</li>
                        <li>Выберите конкретный прокси из списка (allorigins, corsproxy, codetabs)</li>
                        <li>Разверните собственный <a href="https://github.com/Rob--W/cors-anywhere" target="_blank" style="color:#00d4ff;">cors-anywhere</a></li>
                    </ol>
                </div>
            </div>
        </div>`;
    }

    // Сводка
    if (data._summary) {
        html += `<div class="report-section">
            <div class="report-section-header">📋 Сводка</div>
            <div class="report-section-body">
                <div class="report-item">
                    <span class="report-label">URL:</span>
                    <span class="report-value">${escapeHtml(data._meta.analyzedUrl)}</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Режим прокси:</span>
                    <span class="report-value">${escapeHtml(data._meta.proxyMode === 'auto' ? 'Авто (прямой → прокси)' : data._meta.proxyMode === '' ? 'Без прокси (прямой)' : data._meta.proxyMode)}</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Кодировка:</span>
                    <span class="report-value">${data.encoding?.charset || 'N/A'}</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Пагинация:</span>
                    <span class="report-value ${data._summary.hasPagination ? '' : 'warning'}">
                        ${data._summary.hasPagination ? '✅ ' + data._summary.paginationPattern : '❌ Не найдена'}
                    </span>
                </div>
                <div class="report-item">
                    <span class="report-label">Поиск:</span>
                    <span class="report-value ${data._summary.hasSearch ? '' : 'warning'}">
                        ${data._summary.hasSearch ? '✅ Найден' : '❌ Не найден'}
                    </span>
                </div>
                <div class="report-item">
                    <span class="report-label">Сортировка:</span>
                    <span class="report-value ${data._summary.hasSorting ? '' : 'warning'}">
                        ${data._summary.hasSorting ? '✅ ' + data._summary.sortingOptionsCount + ' вариантов' : '❌ Не найдена'}
                    </span>
                </div>
                <div class="report-item">
                    <span class="report-label">Категории:</span>
                    <span class="report-value ${data._summary.hasCategories ? '' : 'warning'}">
                        ${data._summary.hasCategories ? '✅ ' + data._summary.categoriesCount + ' шт.' : '❌ Не найдены'}
                    </span>
                </div>
                <div class="report-item">
                    <span class="report-label">Карточек:</span>
                    <span class="report-value">${data._summary.videoCardsFound}</span>
                </div>
                <div class="report-item">
                    <span class="report-label">Видео-источники:</span>
                    <span class="report-value ${data._summary.videoSourceFound ? '' : 'warning'}">
                        ${data._summary.videoSourceFound ? '✅ (' + data._summary.videoSourceMethods.join(', ') + ')' : '❌ Не найдены'}
                    </span>
                </div>
            </div>
        </div>`;
    }

    // Карточки видео
    if (data.videoCards?.found) {
        const struct = data.videoCards.structure;
        html += `<div class="report-section">
            <div class="report-section-header">🎬 Структура карточки видео</div>
            <div class="report-section-body">
                <div class="report-item">
                    <span class="report-label">Селектор карточки:</span>
                    <span class="report-value"><span class="tag">${escapeHtml(data.videoCards.cardSelector)}</span></span>
                </div>`;

        if (struct.title.selector)
            html += `<div class="report-item"><span class="report-label">Название:</span><span class="report-value"><span class="tag">${escapeHtml(struct.title.selector)}</span></span></div>`;
        if (struct.link.selector)
            html += `<div class="report-item"><span class="report-label">Ссылка:</span><span class="report-value"><span class="tag">${escapeHtml(struct.link.selector)}</span><br>Паттерн: ${escapeHtml(struct.link.pattern || 'N/A')}</span></div>`;
        if (struct.thumbnail.selector)
            html += `<div class="report-item"><span class="report-label">Превью:</span><span class="report-value"><span class="tag">${escapeHtml(struct.thumbnail.selector)}</span> (attr: ${escapeHtml(struct.thumbnail.attribute)})</span></div>`;
        if (struct.duration.selector)
            html += `<div class="report-item"><span class="report-label">Длительность:</span><span class="report-value"><span class="tag">${escapeHtml(struct.duration.selector)}</span> — "${escapeHtml(struct.duration.example || '')}"</span></div>`;
        if (struct.quality.selector)
            html += `<div class="report-item"><span class="report-label">Качество:</span><span class="report-value"><span class="tag">${escapeHtml(struct.quality.selector)}</span> — "${escapeHtml(struct.quality.example || '')}"</span></div>`;

        html += `</div></div>`;

        // Примеры карточек
        if (data.videoCards.sampleCards.length > 0) {
            html += `<div class="report-section">
                <div class="report-section-header">📑 Примеры карточек (${data.videoCards.sampleCards.length})</div>
                <div class="report-section-body">`;
            data.videoCards.sampleCards.forEach((card, i) => {
                html += `<div style="margin-bottom:15px;padding:10px;background:#0f0f23;border-radius:8px;">
                    <strong style="color:#00d4ff;">#${i + 1}</strong><br>`;
                if (card.title) html += `📌 <strong>Название:</strong> ${escapeHtml(card.title)}<br>`;
                if (card.link) html += `🔗 <strong>Ссылка:</strong> <a style="color:#00ff88;" href="${escapeHtml(card.link)}" target="_blank">${escapeHtml(card.link.substring(0, 80))}…</a><br>`;
                if (card.thumbnail) html += `🖼 <strong>Превью:</strong> <a style="color:#e6db74;" href="${escapeHtml(card.thumbnail)}" target="_blank">Открыть</a><br>`;
                if (card.duration) html += `⏱ <strong>Длительность:</strong> ${escapeHtml(card.duration)}<br>`;
                if (card.quality) html += `📺 <strong>Качество:</strong> ${escapeHtml(card.quality)}<br>`;
                html += `</div>`;
            });
            html += `</div></div>`;
        }
    }

    // Видео-источники
    if (data.videoPage?.analyzed) {
        html += `<div class="report-section">
            <div class="report-section-header">▶️ Страница видео</div>
            <div class="report-section-body">
                <div class="report-item">
                    <span class="report-label">URL паттерн:</span>
                    <span class="report-value">${escapeHtml(data.videoPage.urlStructure?.pattern || 'N/A')}</span>
                </div>`;

        if (data.videoPage.videoSources?.sources?.length > 0) {
            html += `<div class="report-item"><span class="report-label">Источники:</span><span class="report-value">`;
            data.videoPage.videoSources.sources.forEach(s => {
                html += `<div style="margin:4px 0;"><span class="tag">${escapeHtml(s.type)}</span> ${escapeHtml(s.foundIn)} — <span style="color:#e6db74;word-break:break-all;">${escapeHtml(s.url.substring(0, 100))}…</span></div>`;
            });
            html += `</span></div>`;
        }

        if (data.videoPage.videoSources?.playerIframes?.length > 0) {
            html += `<div class="report-item"><span class="report-label">Player iframes:</span><span class="report-value">`;
            data.videoPage.videoSources.playerIframes.forEach(f => {
                html += `<div style="margin:4px 0;"><span class="tag">iframe</span> ${escapeHtml(f.src)}</div>`;
            });
            html += `</span></div>`;
        }

        if (data.videoPage.relatedVideos?.found) {
            html += `<div class="report-item">
                <span class="report-label">Похожие видео:</span>
                <span class="report-value">✅ ${data.videoPage.relatedVideos.count} ссылок — <span class="tag">${escapeHtml(data.videoPage.relatedVideos.selector)}</span></span>
            </div>`;
        }

        if (data.videoPage.error) {
            html += `<div class="report-item">
                <span class="report-label">⚠️ Ошибка:</span>
                <span class="report-value error">${escapeHtml(data.videoPage.error)}</span>
            </div>`;
        }

        html += `</div></div>`;
    }

    // Категории
    if (data.sortingAndCategories?.categories?.found) {
        html += `<div class="report-section">
            <div class="report-section-header">📁 Категории (${data.sortingAndCategories.categories.totalCount})</div>
            <div class="report-section-body" style="max-height:300px;overflow-y:auto;">`;
        data.sortingAndCategories.categories.list.forEach(cat => {
            html += `<span class="tag" style="margin:3px;">${escapeHtml(cat.name)}</span>`;
        });
        html += `</div></div>`;
    }

    return html;
}

// ================================================================
// UI ФУНКЦИИ
// ================================================================

function showTab(name) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    event.target.classList.add('active');
}

function copyResults() {
    if (!analysisResult) return;
    const json = JSON.stringify(analysisResult, null, 2);
    navigator.clipboard.writeText(json).then(() => {
        setStatus('📋 JSON скопирован в буфер обмена!', 'success');
    }).catch(() => {
        const textarea = document.getElementById('jsonRaw');
        textarea.select();
        document.execCommand('copy');
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
    try {
        const hostname = new URL(analysisResult._meta.analyzedUrl).hostname;
        a.download = `site-analysis-${hostname}-${Date.now()}.json`;
    } catch {
        a.download = `site-analysis-${Date.now()}.json`;
    }
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus('💾 JSON скачан!', 'success');
}

// Обновление подсказки при смене прокси
function onProxyChange() {
    const proxySelect = document.getElementById('proxySelect');
    const proxyHint = document.getElementById('proxyHint');
    if (!proxyHint) return;

    const hints = {
        'auto': '🔄 Сначала прямой запрос. Если CORS — автоматический перебор прокси.',
        '': '🔗 Прямой запрос без прокси. Работает только если сайт разрешает CORS.',
        'https://api.allorigins.win/raw?url=': '🌐 Публичный прокси allorigins.win',
        'https://corsproxy.io/?': '🌐 Публичный прокси corsproxy.io',
        'https://api.codetabs.com/v1/proxy?quest=': '🌐 Публичный прокси codetabs.com'
    };

    proxyHint.textContent = hints[proxySelect.value] || '';
}

// ================================================================
// ИНИЦИАЛИЗАЦИЯ
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('targetUrl');
    if (DEFAULT_TARGET_URL && !urlInput.value) {
        urlInput.value = DEFAULT_TARGET_URL;
    }

    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') runFullAnalysis();
    });

    // Инициализация подсказки прокси
    const proxySelect = document.getElementById('proxySelect');
    if (proxySelect) {
        proxySelect.addEventListener('change', onProxyChange);
        onProxyChange();
    }
});
