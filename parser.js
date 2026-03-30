// ================================================================
// SITE STRUCTURE ANALYZER — parser.js
// ================================================================
// Анализирует HTML-структуру сайта и собирает информацию в JSON.
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

function setProgress(percent, text) {
    const container = document.getElementById('progress-container');
    const bar = document.getElementById('progress-bar');
    const txt = document.getElementById('progress-text');
    container.style.display = 'block';
    bar.style.width = percent + '%';
    txt.textContent = text || (percent + '%');
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

// ---- Загрузка страницы через прокси ----

async function fetchPage(url) {
    const proxy = document.getElementById('proxySelect').value;
    const fetchUrl = proxy + encodeURIComponent(url);
    
    const response = await fetch(fetchUrl, {
        headers: {
            'Accept': 'text/html,application/xhtml+xml,*/*'
        }
    });
    
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    return html;
}

function parseHTML(html) {
    const parser = new DOMParser();
    return parser.parseFromString(html, 'text/html');
}

// ================================================================
// АНАЛИЗАТОРЫ (каждый отвечает за свой раздел)
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
    
    // Проверка по DOCTYPE и BOM
    const hasUtf8Bom = html.charCodeAt(0) === 0xFEFF;
    
    return {
        charset: charset.toUpperCase(),
        source: metaCharset ? '<meta charset>' : metaContentType ? '<meta http-equiv>' : 'не найдено',
        hasUtf8Bom: hasUtf8Bom
    };
}

// 2) Главная страница и пагинация
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

    // Ищем ссылки пагинации
    const paginationSelectors = [
        '.pagination a', '.pager a', '.pages a', '.page-numbers a',
        'nav.pagination a', '.paginator a', '.page-nav a',
        'ul.pagination a', '.wp-pagenavi a', '.nav-links a',
        'a.page-link', '.paging a', '.page_nav a',
        '[class*="pagination"] a', '[class*="pager"] a', '[class*="page"] a'
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

    // Если специальные селекторы не нашли, ищем по паттернам в href
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
                /\/\d+\/?$/.test(href) && /^\d+$/.test(text)
            ) {
                paginationLinks.push(href);
            }
        });
        if (paginationLinks.length > 0) {
            matchedSelector = 'a[href] (найдено по паттерну URL)';
        }
    }

    if (paginationLinks.length > 0) {
        result.pagination.found = true;
        result.pagination.selectors.push(matchedSelector);
        
        const resolvedLinks = uniqueArray(paginationLinks.map(h => resolveUrl(h, baseUrl)));
        result.pagination.examples = resolvedLinks.slice(0, 10);
        
        // Определяем паттерн
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

    // Ищем контейнер пагинации
    const paginationContainers = [
        '.pagination', '.pager', '.pages', '.paginator',
        'nav.pagination', '.page-nav', '.wp-pagenavi', '.nav-links',
        '[class*="pagination"]', '[class*="pager"]'
    ];
    
    for (const sel of paginationContainers) {
        try {
            const el = doc.querySelector(sel);
            if (el) {
                result.pagination.containerSelector = sel;
                result.pagination.containerHTML = el.outerHTML.substring(0, 500);
                break;
            }
        } catch(e) {}
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

    // Ищем формы поиска
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
            
            inputDetails.push({
                type, name, placeholder,
                classes: input.className
            });
        });

        if (hasSearchInput || action.match(/(search|find|poisk)/i)) {
            result.found = true;
            const formData = {
                action: resolveUrl(action, baseUrl),
                method: (form.getAttribute('method') || 'GET').toUpperCase(),
                inputs: inputDetails,
                formClasses: form.className,
                formId: form.id
            };
            result.forms.push(formData);
        }
    });

    // Ищем ссылки на поиск
    const searchLinks = doc.querySelectorAll('a[href*="search"], a[href*="find"]');
    const searchLinkData = [];
    searchLinks.forEach(a => {
        searchLinkData.push({
            href: resolveUrl(a.getAttribute('href'), baseUrl),
            text: a.textContent.trim().substring(0, 100)
        });
    });
    if (searchLinkData.length > 0) {
        result.searchLinks = searchLinkData.slice(0, 5);
    }

    // Определяем паттерн
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

    // Поиск в JavaScript (иногда URL поиска в JS)
    const jsSearchPatterns = html.match(/['"]([^'"]*(?:search|find)[^'"]*)['"]/gi);
    if (jsSearchPatterns) {
        result.jsSearchHints = uniqueArray(
            jsSearchPatterns.map(s => s.replace(/['"]/g, ''))
        ).slice(0, 5);
    }

    return result;
}

// 4) Сортировка и категории
function analyzeSortingAndCategories(doc, baseUrl, html) {
    const result = {
        sorting: {
            found: false,
            options: [],
            urlPattern: null
        },
        categories: {
            found: false,
            list: [],
            urlPattern: null
        }
    };

    // --- Сортировка ---
    
    // Ищем элементы сортировки
    const sortSelectors = [
        'select[name*="sort"]', 'select[name*="order"]',
        '[class*="sort"] a', '[class*="sort"] select',
        '[class*="order"] a', '[class*="filter"] a',
        '.sorting a', '.sort-options a', '.sort-by a',
        'a[href*="sort="]', 'a[href*="order="]',
        '[class*="tabs"] a', '.list-tabs a'
    ];

    for (const sel of sortSelectors) {
        try {
            const elements = doc.querySelectorAll(sel);
            elements.forEach(el => {
                if (el.tagName === 'SELECT') {
                    const options = el.querySelectorAll('option');
                    options.forEach(opt => {
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
        } catch(e) {}
    }

    // Если не нашли через селекторы, ищем по ссылкам
    if (!result.sorting.found) {
        const allLinks = doc.querySelectorAll('a[href]');
        const sortPatterns = /(sort|order|popular|rating|newest|latest|longest|viewed|top)/i;
        
        allLinks.forEach(a => {
            const href = a.getAttribute('href') || '';
            const text = a.textContent.trim();
            if (
                sortPatterns.test(href) && 
                text.length < 50 &&
                text.length > 0
            ) {
                result.sorting.options.push({
                    label: text,
                    value: null,
                    url: resolveUrl(href, baseUrl)
                });
                result.sorting.found = true;
            }
        });
    }

    // Дедупликация
    const seen = new Set();
    result.sorting.options = result.sorting.options.filter(o => {
        const key = o.label + '|' + (o.url || o.value);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).slice(0, 20);

    // Определяем URL-паттерн сортировки
    if (result.sorting.options.length > 0) {
        const sampleUrl = result.sorting.options.find(o => o.url)?.url;
        if (sampleUrl) {
            if (/[?&]sort=/i.test(sampleUrl)) {
                result.sorting.urlPattern = '?sort={value}';
            } else if (/[?&]order=/i.test(sampleUrl)) {
                result.sorting.urlPattern = '?order={value}';
            } else {
                result.sorting.urlPattern = sampleUrl;
            }
        }
    }

    // --- Категории ---
    
    const categorySelectors = [
        '.categories a', '.category-list a', '.cats a',
        'nav.categories a', '.cat-list a', '.tags a',
        '[class*="categor"] a', '[class*="tag-list"] a',
        '.sidebar a', 'aside a',
        'a[href*="/categories/"]', 'a[href*="/category/"]',
        'a[href*="/tags/"]', 'a[href*="/tag/"]',
        'a[href*="/cat/"]'
    ];

    const categoryLinks = [];
    let catSelector = '';
    
    for (const sel of categorySelectors) {
        try {
            const links = doc.querySelectorAll(sel);
            if (links.length >= 3) { // Минимум 3 ссылки — вероятно категории
                catSelector = sel;
                links.forEach(a => {
                    const href = a.getAttribute('href');
                    const text = a.textContent.trim();
                    if (href && text && text.length < 100) {
                        categoryLinks.push({
                            name: text,
                            url: resolveUrl(href, baseUrl)
                        });
                    }
                });
                break;
            }
        } catch(e) {}
    }

    // Если через селекторы не нашли, ищем по URL паттернам
    if (categoryLinks.length === 0) {
        const allLinks = doc.querySelectorAll('a[href]');
        const catPatterns = /\/(categories|category|cat|tags|tag|genre|genres)\//i;
        
        allLinks.forEach(a => {
            const href = a.getAttribute('href') || '';
            const text = a.textContent.trim();
            if (catPatterns.test(href) && text.length > 0 && text.length < 100) {
                categoryLinks.push({
                    name: text,
                    url: resolveUrl(href, baseUrl)
                });
            }
        });
        if (categoryLinks.length > 0) {
            catSelector = 'a[href] (найдено по URL паттерну)';
        }
    }

    if (categoryLinks.length > 0) {
        result.categories.found = true;
        
        // Дедупликация
        const seenCats = new Set();
        result.categories.list = categoryLinks.filter(c => {
            const key = c.url;
            if (seenCats.has(key)) return false;
            seenCats.add(key);
            return true;
        }).slice(0, 50);
        
        result.categories.selector = catSelector;
        result.categories.totalCount = result.categories.list.length;
        
        // URL паттерн
        if (result.categories.list.length > 0) {
            const sampleCatUrl = result.categories.list[0].url;
            const urlPath = new URL(sampleCatUrl).pathname;
            result.categories.urlPattern = urlPath.replace(/[^/]+\/?$/, '{category_name}/');
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

    // Попытки найти контейнер карточек
    const cardSelectors = [
        // Специфические
        '.video-item', '.video-card', '.thumb-item', '.thumb',
        '.video-thumb', '.video_block', '.video-block',
        '.item', '.video', '.clip', '.gallery-item',
        // Общие с вложенными изображениями
        'article', '.post', '.entry',
        // Список-элементы
        '.list-item', '.grid-item',
        // Попытка по data-атрибутам
        '[data-video-id]', '[data-id]',
        // Общие обёртки
        '.col', '.card'
    ];

    let cards = [];
    let usedSelector = '';

    for (const sel of cardSelectors) {
        try {
            const found = doc.querySelectorAll(sel);
            // Проверяем что это реально карточки (имеют img и a)
            if (found.length >= 2) {
                const hasLinks = Array.from(found).some(el => el.querySelector('a[href]'));
                const hasImages = Array.from(found).some(el => el.querySelector('img'));
                if (hasLinks && hasImages) {
                    cards = Array.from(found);
                    usedSelector = sel;
                    break;
                }
            }
        } catch(e) {}
    }

    // Фоллбэк: ищем все блоки с img + a внутри
    if (cards.length === 0) {
        const allDivs = doc.querySelectorAll('div, li, article, section');
        const potential = [];
        allDivs.forEach(div => {
            const imgs = div.querySelectorAll(':scope > img, :scope > a > img, :scope > div > img, :scope > a > div > img');
            const links = div.querySelectorAll(':scope > a[href]');
            if (imgs.length >= 1 && links.length >= 1) {
                // Проверяем что это не слишком большой контейнер
                if (div.querySelectorAll('a[href]').length < 10) {
                    potential.push(div);
                }
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

    // Анализируем структуру первых карточек
    const sampleSize = Math.min(5, cards.length);
    
    for (let i = 0; i < sampleSize; i++) {
        const card = cards[i];
        const cardData = {};

        // --- Название ---
        const titleSelectors = [
            'h1', 'h2', 'h3', 'h4', 'h5', 
            '.title', '.name', '.video-title',
            'a[title]', '[class*="title"]', '[class*="name"]',
            'strong', 'b'
        ];
        
        for (const ts of titleSelectors) {
            try {
                const titleEl = card.querySelector(ts);
                if (titleEl) {
                    const text = titleEl.textContent.trim();
                    if (text.length > 2 && text.length < 300) {
                        cardData.title = text;
                        if (i === 0) {
                            result.structure.title.selector = 
                                `${usedSelector} ${ts}`;
                            result.structure.title.tag = titleEl.tagName.toLowerCase();
                            result.structure.title.classes = titleEl.className;
                        }
                        break;
                    }
                }
            } catch(e) {}
        }

        // Фоллбэк: title из атрибута
        if (!cardData.title) {
            const aWithTitle = card.querySelector('a[title]');
            if (aWithTitle) {
                cardData.title = aWithTitle.getAttribute('title');
                if (sampleSize === 0) {
                    result.structure.title.selector = `${usedSelector} a[title]`;
                    result.structure.title.attribute = 'title';
                }
            }
        }

        // --- Ссылка ---
        const linkEl = card.querySelector('a[href]');
        if (linkEl) {
            const href = linkEl.getAttribute('href');
            cardData.link = resolveUrl(href, baseUrl);
            if (i === 0) {
                result.structure.link.selector = `${usedSelector} a[href]`;
                result.structure.link.example = cardData.link;
                
                // Определяем паттерн URL видео
                try {
                    const path = new URL(cardData.link).pathname;
                    // Заменяем числовые ID и slug на плейсхолдеры
                    const pattern = path
                        .replace(/\/\d+\//g, '/{id}/')
                        .replace(/\/\d+$/g, '/{id}')
                        .replace(/\/[a-z0-9-]+\.html$/i, '/{slug}.html')
                        .replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/');
                    result.structure.link.pattern = pattern;
                } catch(e) {}
            }
        }

        // --- Превью ---
        const imgSelectors = [
            'img[data-src]', 'img[data-original]', 'img[data-lazy-src]',
            'img[src]', 'img'
        ];

        for (const is of imgSelectors) {
            try {
                const imgEl = card.querySelector(is);
                if (imgEl) {
                    const src = imgEl.getAttribute('data-src') || 
                                imgEl.getAttribute('data-original') ||
                                imgEl.getAttribute('data-lazy-src') ||
                                imgEl.getAttribute('data-thumb') ||
                                imgEl.getAttribute('src');
                    
                    if (src && !src.startsWith('data:') && src !== '') {
                        cardData.thumbnail = resolveUrl(src, baseUrl);
                        if (i === 0) {
                            const attrUsed = imgEl.getAttribute('data-src') ? 'data-src' :
                                           imgEl.getAttribute('data-original') ? 'data-original' :
                                           imgEl.getAttribute('data-lazy-src') ? 'data-lazy-src' :
                                           imgEl.getAttribute('data-thumb') ? 'data-thumb' : 'src';
                            result.structure.thumbnail.selector = `${usedSelector} ${is}`;
                            result.structure.thumbnail.attribute = attrUsed;
                            result.structure.thumbnail.classes = imgEl.className;
                            result.structure.thumbnail.example = cardData.thumbnail;
                        }
                        break;
                    }
                }
            } catch(e) {}
        }

        // --- Длительность ---
        const durationSelectors = [
            '.duration', '.time', '.video-time', '.video-duration',
            '[class*="duration"]', '[class*="time"]', '[class*="length"]',
            'span.duration', 'div.duration'
        ];

        for (const ds of durationSelectors) {
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
            } catch(e) {}
        }

        // Фоллбэк для длительности — ищем текст по регулярке
        if (!cardData.duration) {
            const allSpans = card.querySelectorAll('span, div, p, small, em');
            for (const el of allSpans) {
                const text = el.textContent.trim();
                if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text)) {
                    cardData.duration = text;
                    if (i === 0) {
                        result.structure.duration.selector = `${usedSelector} ${el.tagName.toLowerCase()}.${el.className}`;
                        result.structure.duration.tag = el.tagName.toLowerCase();
                        result.structure.duration.classes = el.className;
                        result.structure.duration.example = text;
                    }
                    break;
                }
            }
        }

        // --- Качество (HD/4K) ---
        const qualitySelectors = [
            '.quality', '.hd', '.video-quality', '.badge',
            '[class*="quality"]', '[class*="hd"]', '[class*="resolution"]'
        ];

        for (const qs of qualitySelectors) {
            try {
                const qEl = card.querySelector(qs);
                if (qEl) {
                    const text = qEl.textContent.trim();
                    if (/\b(HD|FHD|4K|1080p?|720p?|2160p?|UHD)\b/i.test(text)) {
                        cardData.quality = text;
                        if (i === 0) {
                            result.structure.quality.selector = `${usedSelector} ${qs}`;
                            result.structure.quality.tag = qEl.tagName.toLowerCase();
                            result.structure.quality.classes = qEl.className;
                            result.structure.quality.example = text;
                        }
                        break;
                    }
                }
            } catch(e) {}
        }

        // Фоллбэк — ищем текст HD/4K в карточке
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

    // Назначаем примеры если нашлись
    if (result.sampleCards.length > 0 && !result.structure.title.example) {
        result.structure.title.example = result.sampleCards[0].title || null;
    }

    return result;
}

// 6) Страница видео (плеер) — анализ одной страницы видео
async function analyzeVideoPage(videoUrl, baseUrl) {
    const result = {
        analyzed: false,
        videoUrl: videoUrl,
        urlStructure: {
            pattern: null,
            example: videoUrl
        },
        videoSources: {
            found: false,
            sources: [],
            methods: []
        },
        relatedVideos: {
            found: false,
            selector: null,
            count: 0,
            containerHTML: null
        }
    };

    if (!videoUrl) return result;

    try {
        setStatus(`Загрузка страницы видео: ${videoUrl.substring(0, 80)}...`, 'loading');
        const html = await fetchPage(videoUrl);
        const doc = parseHTML(html);
        result.analyzed = true;

        // --- Структура URL ---
        try {
            const path = new URL(videoUrl).pathname;
            result.urlStructure.pattern = path
                .replace(/\/\d+\//g, '/{id}/')
                .replace(/\/\d+$/g, '/{id}')
                .replace(/\/\d+-/g, '/{id}-')
                .replace(/-\d+\//g, '-{id}/')
                .replace(/\/[a-z0-9_-]{10,}\.html$/i, '/{slug}.html')
                .replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/');
        } catch(e) {}

        // --- Источники видео ---

        // Метод 1: тег <video> и <source>
        const videoTags = doc.querySelectorAll('video, video source');
        videoTags.forEach(v => {
            const src = v.getAttribute('src') || v.getAttribute('data-src');
            if (src) {
                result.videoSources.sources.push({
                    type: src.includes('.m3u8') ? 'HLS (m3u8)' :
                          src.includes('.mp4') ? 'MP4' :
                          src.includes('.webm') ? 'WebM' : 'unknown',
                    url: resolveUrl(src, baseUrl),
                    foundIn: '<video>/<source> tag',
                    quality: v.getAttribute('label') || v.getAttribute('data-quality') || 
                             v.getAttribute('res') || null
                });
                result.videoSources.found = true;
                result.videoSources.methods.push('video_tag');
            }
        });

        // Метод 2: Поиск в JavaScript
        const scriptPatterns = [
            /["'](?:file|src|source|video_url|video_src|mp4|hls|stream)["']\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8|webm)[^"']*?)["']/gi,
            /(?:file|src|source|video_url|stream)\s*[:=]\s*["'](https?:\/\/[^"']+?)["']/gi,
            /(?:https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8|webm)(?:\?[^\s"'<>]*)?)/gi
        ];

        const scripts = doc.querySelectorAll('script');
        const allScriptText = Array.from(scripts).map(s => s.textContent).join('\n');
        
        // Также проверяем inline обработчики и атрибуты
        const fullHTML = html;

        for (const pattern of scriptPatterns) {
            let match;
            // Проверяем в scripts
            while ((match = pattern.exec(allScriptText)) !== null) {
                const url = match[1] || match[0];
                if (url && (url.includes('.mp4') || url.includes('.m3u8') || url.includes('.webm'))) {
                    const cleaned = url.replace(/\\/g, '');
                    result.videoSources.sources.push({
                        type: cleaned.includes('.m3u8') ? 'HLS (m3u8)' :
                              cleaned.includes('.mp4') ? 'MP4' :
                              cleaned.includes('.webm') ? 'WebM' : 'unknown',
                        url: cleaned,
                        foundIn: 'JavaScript variable/inline',
                        quality: null
                    });
                    result.videoSources.found = true;
                    result.videoSources.methods.push('javascript');
                }
            }
            pattern.lastIndex = 0;
        }

        // Метод 3: meta и link теги
        const metaVideo = doc.querySelectorAll(
            'meta[property="og:video"], meta[property="og:video:url"], ' +
            'meta[property="og:video:secure_url"], link[as="video"]'
        );
        metaVideo.forEach(m => {
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

        // Метод 4: iframe (часто плеер в iframe)
        const iframes = doc.querySelectorAll('iframe[src]');
        const playerIframes = [];
        iframes.forEach(iframe => {
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
            if (!result.videoSources.found) {
                result.videoSources.note = 'Видео загружается через iframe. Прямые ссылки могут быть внутри iframe.';
            }
        }

        // Дедупликация источников
        const seenSources = new Set();
        result.videoSources.sources = result.videoSources.sources.filter(s => {
            if (seenSources.has(s.url)) return false;
            seenSources.add(s.url);
            return true;
        });
        
        result.videoSources.methods = uniqueArray(result.videoSources.methods);

        // Поиск переменных JS с конфигурацией плеера
        const playerConfigPatterns = [
            /(?:var|let|const|window\.)\s*(\w*(?:player|video|config|settings|flashvars)\w*)\s*=\s*({[\s\S]*?});/gi,
            /(?:playerInstance|jwplayer|flowplayer|videojs)\s*[\.(]\s*['"]*[^'"]*['"]*\s*[\).]\s*(?:setup|source|src)\s*\(\s*({[\s\S]*?})\s*\)/gi
        ];

        const playerConfigs = [];
        for (const pattern of playerConfigPatterns) {
            let match;
            while ((match = pattern.exec(allScriptText)) !== null) {
                try {
                    const configStr = (match[2] || match[1] || '').substring(0, 1000);
                    playerConfigs.push(configStr);
                } catch(e) {}
            }
            pattern.lastIndex = 0;
        }
        if (playerConfigs.length > 0) {
            result.videoSources.playerConfigSnippets = playerConfigs.slice(0, 3);
        }

        // --- Похожие видео ---
        const relatedSelectors = [
            '.related', '.related-videos', '.similar', '.recommended',
            '#related', '#related-videos',
            '[class*="related"]', '[class*="similar"]', '[class*="recommended"]',
            '.more-videos', '.also-like'
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
                        result.relatedVideos.containerHTML = el.outerHTML.substring(0, 500);
                        
                        // Пример ссылок
                        result.relatedVideos.sampleLinks = Array.from(relatedLinks)
                            .slice(0, 5)
                            .map(a => ({
                                text: a.textContent.trim().substring(0, 100),
                                href: resolveUrl(a.getAttribute('href'), baseUrl)
                            }));
                        break;
                    }
                }
            } catch(e) {}
        }

    } catch (err) {
        result.error = `Не удалось загрузить страницу видео: ${err.message}`;
    }

    return result;
}

// 7) Общая мета-информация о сайте
function analyzeMeta(doc, html) {
    const meta = {
        title: doc.title || null,
        description: null,
        keywords: null,
        ogTitle: null,
        ogDescription: null,
        ogImage: null,
        language: null,
        generator: null
    };

    const descMeta = doc.querySelector('meta[name="description"]');
    if (descMeta) meta.description = descMeta.getAttribute('content');

    const kwMeta = doc.querySelector('meta[name="keywords"]');
    if (kwMeta) meta.keywords = kwMeta.getAttribute('content');

    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) meta.ogTitle = ogTitle.getAttribute('content');

    const ogDesc = doc.querySelector('meta[property="og:description"]');
    if (ogDesc) meta.ogDescription = ogDesc.getAttribute('content');

    const ogImg = doc.querySelector('meta[property="og:image"]');
    if (ogImg) meta.ogImage = ogImg.getAttribute('content');

    const htmlLang = doc.documentElement.getAttribute('lang');
    if (htmlLang) meta.language = htmlLang;

    const generator = doc.querySelector('meta[name="generator"]');
    if (generator) meta.generator = generator.getAttribute('content');

    return meta;
}

// ================================================================
// ГЛАВНАЯ ФУНКЦИЯ АНАЛИЗА
// ================================================================

async function runFullAnalysis() {
    const urlInput = document.getElementById('targetUrl');
    const targetUrl = urlInput.value.trim() || DEFAULT_TARGET_URL;
    
    if (!targetUrl) {
        setStatus('❌ Введите URL для анализа!', 'error');
        return;
    }

    // Валидация URL
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

    analysisResult = {
        _meta: {
            analyzedUrl: targetUrl,
            baseUrl: baseUrl,
            analyzedAt: new Date().toISOString(),
            tool: 'Site Structure Analyzer v1.0'
        }
    };

    try {
        // Шаг 1: Загрузка главной страницы
        setStatus('📥 Загрузка главной страницы...', 'loading');
        setProgress(10, 'Загрузка страницы...');
        
        const html = await fetchPage(targetUrl);
        const doc = parseHTML(html);
        
        setProgress(20, 'Страница загружена');
        setStatus(`✅ Страница загружена (${(html.length / 1024).toFixed(1)} KB)`, 'success');

        // Шаг 2: Кодировка
        setProgress(25, 'Анализ кодировки...');
        analysisResult.encoding = analyzeEncoding(doc, html);

        // Шаг 3: Мета-информация
        setProgress(30, 'Мета-информация...');
        analysisResult.siteMetaInfo = analyzeMeta(doc, html);

        // Шаг 4: Пагинация
        setProgress(40, 'Анализ пагинации...');
        analysisResult.mainPageAndPagination = analyzePagination(doc, baseUrl, targetUrl);

        // Шаг 5: Поиск
        setProgress(50, 'Анализ поиска...');
        analysisResult.search = analyzeSearch(doc, baseUrl, html);

        // Шаг 6: Сортировка и категории
        setProgress(60, 'Сортировка и категории...');
        analysisResult.sortingAndCategories = analyzeSortingAndCategories(doc, baseUrl, html);

        // Шаг 7: Карточки видео
        setProgress(70, 'Анализ карточек видео...');
        analysisResult.videoCards = analyzeVideoCards(doc, baseUrl);

        // Шаг 8: Анализ страницы видео (берём первую найденную ссылку)
        setProgress(80, 'Анализ страницы видео...');
        
        let sampleVideoUrl = null;
        if (analysisResult.videoCards.sampleCards && analysisResult.videoCards.sampleCards.length > 0) {
            sampleVideoUrl = analysisResult.videoCards.sampleCards[0].link;
        }
        
        if (sampleVideoUrl) {
            analysisResult.videoPage = await analyzeVideoPage(sampleVideoUrl, baseUrl);
        } else {
            analysisResult.videoPage = {
                analyzed: false,
                note: 'Не удалось найти ссылку на страницу видео для анализа'
            };
        }

        setProgress(95, 'Формирование отчёта...');

        // Итоговая сводка
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

        // Отображаем результат
        displayResults(analysisResult);
        setProgress(100, 'Готово!');
        setStatus('✅ Анализ завершён успешно!', 'success');

    } catch (err) {
        setStatus(`❌ Ошибка: ${err.message}`, 'error');
        console.error('Analysis error:', err);
        
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
            setStatus(
                '❌ Ошибка сети. Попробуйте другой CORS-прокси или проверьте URL. ' +
                'Некоторые сайты блокируют прокси-запросы.', 
                'error'
            );
        }
    } finally {
        btnAnalyze.disabled = false;
        btnAnalyze.textContent = '🚀 Полный анализ';
    }
}

// ================================================================
// ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ
// ================================================================

function displayResults(data) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.style.display = 'block';

    // Форматированный JSON с подсветкой
    const jsonStr = JSON.stringify(data, null, 2);
    document.getElementById('jsonFormatted').innerHTML = syntaxHighlight(jsonStr);
    
    // Raw JSON
    document.getElementById('jsonRaw').value = jsonStr;

    // Визуальный отчёт
    document.getElementById('visualReport').innerHTML = generateVisualReport(data);

    // Активируем кнопки
    document.getElementById('btnCopy').disabled = false;
    document.getElementById('btnDownload').disabled = false;
}

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        function (match) {
            let cls = 'color: #ae81ff;'; // number
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'color: #a6e22e;'; // key
                } else {
                    cls = 'color: #e6db74;'; // string
                }
            } else if (/true|false/.test(match)) {
                cls = 'color: #66d9ef;'; // boolean
            } else if (/null/.test(match)) {
                cls = 'color: #f92672;'; // null
            }
            return '<span style="' + cls + '">' + match + '</span>';
        }
    );
}

function generateVisualReport(data) {
    let html = '';

    // Сводка
    html += `<div class="report-section">
        <div class="report-section-header">📋 Сводка</div>
        <div class="report-section-body">
            <div class="report-item">
                <span class="report-label">URL:</span>
                <span class="report-value">${data._meta.analyzedUrl}</span>
            </div>
            <div class="report-item">
                <span class="report-label">Кодировка:</span>
                <span class="report-value">${data.encoding.charset}</span>
            </div>
            <div class="report-item">
                <span class="report-label">Пагинация:</span>
                <span class="report-value ${data._summary.hasPagination ? '' : 'warning'}">
                    ${data._summary.hasPagination ? '✅ Найдена — ' + data._summary.paginationPattern : '❌ Не найдена'}
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
                <span class="report-label">Карточек видео:</span>
                <span class="report-value">${data._summary.videoCardsFound}</span>
            </div>
            <div class="report-item">
                <span class="report-label">Видео-источники:</span>
                <span class="report-value ${data._summary.videoSourceFound ? '' : 'warning'}">
                    ${data._summary.videoSourceFound ? '✅ Найдены (' + data._summary.videoSourceMethods.join(', ') + ')' : '❌ Не найдены'}
                </span>
            </div>
        </div>
    </div>`;

    // Карточки видео
    if (data.videoCards.found) {
        html += `<div class="report-section">
            <div class="report-section-header">🎬 Структура карточки видео</div>
            <div class="report-section-body">
                <div class="report-item">
                    <span class="report-label">Селектор карточки:</span>
                    <span class="report-value"><span class="tag">${data.videoCards.cardSelector}</span></span>
                </div>`;
        
        const struct = data.videoCards.structure;
        if (struct.title.selector) {
            html += `<div class="report-item">
                <span class="report-label">Название:</span>
                <span class="report-value"><span class="tag">${struct.title.selector}</span> — "${struct.title.example || ''}"</span>
            </div>`;
        }
        if (struct.link.selector) {
            html += `<div class="report-item">
                <span class="report-label">Ссылка:</span>
                <span class="report-value"><span class="tag">${struct.link.selector}</span><br>Паттерн: ${struct.link.pattern || 'N/A'}</span>
            </div>`;
        }
        if (struct.thumbnail.selector) {
            html += `<div class="report-item">
                <span class="report-label">Превью:</span>
                <span class="report-value"><span class="tag">${struct.thumbnail.selector}</span> (attr: ${struct.thumbnail.attribute})</span>
            </div>`;
        }
        if (struct.duration.selector) {
            html += `<div class="report-item">
                <span class="report-label">Длительность:</span>
                <span class="report-value"><span class="tag">${struct.duration.selector}</span> — "${struct.duration.example || ''}"</span>
            </div>`;
        }
        if (struct.quality.selector) {
            html += `<div class="report-item">
                <span class="report-label">Качество:</span>
                <span class="report-value"><span class="tag">${struct.quality.selector}</span> — "${struct.quality.example || ''}"</span>
            </div>`;
        }

        html += `</div></div>`;

        // Примеры карточек
        if (data.videoCards.sampleCards.length > 0) {
            html += `<div class="report-section">
                <div class="report-section-header">📑 Примеры карточек (${data.videoCards.sampleCards.length})</div>
                <div class="report-section-body">`;
            
            data.videoCards.sampleCards.forEach((card, i) => {
                html += `<div style="margin-bottom:15px; padding:10px; background:#0f0f23; border-radius:8px;">
                    <strong style="color:#00d4ff;">#${i+1}</strong><br>`;
                if (card.title) html += `📌 <strong>Название:</strong> ${escapeHtml(card.title)}<br>`;
                if (card.link) html += `🔗 <strong>Ссылка:</strong> <a style="color:#00ff88;" href="${card.link}" target="_blank">${card.link.substring(0, 80)}...</a><br>`;
                if (card.thumbnail) html += `🖼 <strong>Превью:</strong> <a style="color:#e6db74;" href="${card.thumbnail}" target="_blank">Открыть</a><br>`;
                if (card.duration) html += `⏱ <strong>Длительность:</strong> ${card.duration}<br>`;
                if (card.quality) html += `📺 <strong>Качество:</strong> ${card.quality}<br>`;
                html += `</div>`;
            });

            html += `</div></div>`;
        }
    }

    // Видео-источники
    if (data.videoPage && data.videoPage.analyzed) {
        html += `<div class="report-section">
            <div class="report-section-header">▶️ Страница видео</div>
            <div class="report-section-body">
                <div class="report-item">
                    <span class="report-label">URL паттерн:</span>
                    <span class="report-value">${data.videoPage.urlStructure.pattern || 'N/A'}</span>
                </div>`;
        
        if (data.videoPage.videoSources.sources.length > 0) {
            html += `<div class="report-item">
                <span class="report-label">Найдены источники:</span>
                <span class="report-value">`;
            data.videoPage.videoSources.sources.forEach(s => {
                html += `<div style="margin:4px 0;"><span class="tag">${s.type}</span> ${s.foundIn} — <span style="color:#e6db74; word-break:break-all;">${s.url.substring(0, 100)}...</span></div>`;
            });
            html += `</span></div>`;
        }

        if (data.videoPage.videoSources.playerIframes) {
            html += `<div class="report-item">
                <span class="report-label">Player iframes:</span>
                <span class="report-value">`;
            data.videoPage.videoSources.playerIframes.forEach(f => {
                html += `<div style="margin:4px 0;"><span class="tag">iframe</span> ${f.src}</div>`;
            });
            html += `</span></div>`;
        }

        if (data.videoPage.relatedVideos.found) {
            html += `<div class="report-item">
                <span class="report-label">Похожие видео:</span>
                <span class="report-value">✅ Найдены (${data.videoPage.relatedVideos.count} ссылок) — <span class="tag">${data.videoPage.relatedVideos.selector}</span></span>
            </div>`;
        }

        html += `</div></div>`;
    }

    // Категории
    if (data.sortingAndCategories.categories.found) {
        html += `<div class="report-section">
            <div class="report-section-header">📁 Категории (${data.sortingAndCategories.categories.totalCount})</div>
            <div class="report-section-body" style="max-height:300px; overflow-y:auto;">`;
        
        data.sortingAndCategories.categories.list.forEach(cat => {
            html += `<span class="tag" style="margin:3px;">${escapeHtml(cat.name)}</span>`;
        });

        html += `</div></div>`;
    }

    return html;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ UI
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
        // Фоллбэк для старых браузеров
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
    
    const hostname = new URL(analysisResult._meta.analyzedUrl).hostname;
    a.download = `site-analysis-${hostname}-${Date.now()}.json`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setStatus('💾 JSON-файл скачан!', 'success');
}

// ================================================================
// ИНИЦИАЛИЗАЦИЯ
// ================================================================

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('targetUrl');
    if (DEFAULT_TARGET_URL && !urlInput.value) {
        urlInput.value = DEFAULT_TARGET_URL;
    }
    
    // Enter для запуска анализа
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            runFullAnalysis();
        }
    });
});
