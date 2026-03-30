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

    const jsSearchPatterns = html.match(/['""]([^'"]*(?:search|find)[^'"]*)['""]/gi);
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
            if (/[?&]sort=/i.test(sampleUrl)) {
                result.sorting.urlPattern = '?sort={value}';
            } else if (/[?&]order=/i.test(sampleUrl)) {
                result.sorting.urlPattern = '?order={value}';
            } else {
                result.sorting.urlPattern = sampleUrl;
            }
        }
    }

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
            if (links.length >= 3) {
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
        
        const seenCats = new Set();
        result.categories.list = categoryLinks.filter(c => {
            const key = c.url;
            if (seenCats.has(key)) return false;
            seenCats.add(key);
            return true;
        }).slice(0, 50);
        
        result.categories.selector = catSelector;
        result.categories.totalCount = result.categories.list.length;
        
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

    const cardSelectors = [
        '.video-item', '.video-card', '.thumb-item', '.thumb',
        '.video-thumb', '.video_block', '.video-block',
        '.item', '.video', '.clip', '.gallery-item',
        'article', '.post', '.entry',
        '.list-item', '.grid-item',
        '[data-video-id]', '[data-id]',
        '.col', '.card'
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
        } catch(e) {}
    }

    if (cards.length === 0) {
        const allDivs = doc.querySelectorAll('div, li, article, section');
        const potential = [];
        allDivs.forEach(div => {
            const imgs = div.querySelectorAll(':scope > img, :scope > a > img, :scope > div > img, :scope > a > div > img');
            const links = div.querySelectorAll(':scope > a[href]');
            if (imgs.length >= 1 && links.length >= 1) {
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

    // *** ИЗМЕНЕНИЕ: анализируем ВСЕ карточки (для вкладки эмуляции) ***
    const analyzeCount = cards.length;
    
    for (let i = 0; i < analyzeCount; i++) {
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
                            result.structure.title.selector = `${usedSelector} ${ts}`;
                            result.structure.title.tag = titleEl.tagName.toLowerCase();
                            result.structure.title.classes = titleEl.className;
                        }
                        break;
                    }
                }
            } catch(e) {}
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

        // --- Ссылка ---
        const linkEl = card.querySelector('a[href]');
        if (linkEl) {
            const href = linkEl.getAttribute('href');
            cardData.link = resolveUrl(href, baseUrl);
            if (i === 0) {
                result.structure.link.selector = `${usedSelector} a[href]`;
                result.structure.link.example = cardData.link;
                
                try {
                    const path = new URL(cardData.link).pathname;
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

    if (result.sampleCards.length > 0 && !result.structure.title.example) {
        result.structure.title.example = result.sampleCards[0].title || null;
    }

    return result;
}

// 6) Страница видео (плеер)
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

        // --- Заголовок страницы видео ---
        result.pageTitle = doc.title || null;
        const h1 = doc.querySelector('h1');
        if (h1) result.videoTitle = h1.textContent.trim();

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

        for (const pattern of scriptPatterns) {
            let match;
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

        // Метод 4: iframe
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

        // Дедупликация
        const seenSources = new Set();
        result.videoSources.sources = result.videoSources.sources.filter(s => {
            if (seenSources.has(s.url)) return false;
            seenSources.add(s.url);
            return true;
        });
        
        result.videoSources.methods = uniqueArray(result.videoSources.methods);

        // Player configs
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

// 7) Общая мета-информация
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
            tool: 'Site Structure Analyzer v1.1'
        }
    };

    try {
        setStatus('📥 Загрузка главной страницы...', 'loading');
        setProgress(10, 'Загрузка страницы...');
        
        const html = await fetchPage(targetUrl);
        const doc = parseHTML(html);
        
        setProgress(20, 'Страница загружена');
        setStatus(`✅ Страница загружена (${(html.length / 1024).toFixed(1)} KB)`, 'success');

        setProgress(25, 'Анализ кодировки...');
        analysisResult.encoding = analyzeEncoding(doc, html);

        setProgress(30, 'Мета-информация...');
        analysisResult.siteMetaInfo = analyzeMeta(doc, html);

        setProgress(40, 'Анализ пагинации...');
        analysisResult.mainPageAndPagination = analyzePagination(doc, baseUrl, targetUrl);

        setProgress(50, 'Анализ поиска...');
        analysisResult.search = analyzeSearch(doc, baseUrl, html);

        setProgress(60, 'Сортировка и категории...');
        analysisResult.sortingAndCategories = analyzeSortingAndCategories(doc, baseUrl, html);

        setProgress(70, 'Анализ карточек видео...');
        analysisResult.videoCards = analyzeVideoCards(doc, baseUrl);

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

    // Форматированный JSON
    const jsonStr = JSON.stringify(data, null, 2);
    document.getElementById('jsonFormatted').innerHTML = syntaxHighlight(jsonStr);
    
    // Raw JSON
    document.getElementById('jsonRaw').value = jsonStr;

    // Визуальный отчёт
    document.getElementById('visualReport').innerHTML = generateVisualReport(data);

    // ===== НОВОЕ: Эмуляция карточек =====
    renderEmulatedCards(data);

    // ===== НОВОЕ: Эмуляция видео =====
    renderEmulatedVideo(data);

    // Активируем кнопки
    document.getElementById('btnCopy').disabled = false;
    document.getElementById('btnDownload').disabled = false;
}

// ================================================================
// ЭМУЛЯЦИЯ КАРТОЧЕК (НОВАЯ ВКЛАДКА)
// ================================================================

function renderEmulatedCards(data) {
    const container = document.getElementById('emulatedCards');
    const emptyState = document.getElementById('cardsEmptyState');
    const cheatsheet = document.getElementById('cardsSelectorCheatsheet');
    const countInfo = document.getElementById('cardsCountInfo');

    container.innerHTML = '';

    if (!data.videoCards || !data.videoCards.found || !data.videoCards.sampleCards.length) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        cheatsheet.style.display = 'none';
        countInfo.textContent = '';
        return;
    }

    container.style.display = '';
    emptyState.style.display = 'none';

    const cards = data.videoCards.sampleCards;
    countInfo.textContent = `Найдено: ${cards.length} карточек (селектор: ${data.videoCards.cardSelector})`;

    cards.forEach((card, index) => {
        const cardEl = document.createElement('div');
        cardEl.className = 'emu-card';

        // Номер
        const numberHtml = `<div class="emu-card-number">#${index + 1}</div>`;

        // Превью
        let thumbHtml = '';
        if (card.thumbnail) {
            thumbHtml = `
                <div class="emu-card-thumb">
                    ${numberHtml}
                    <img src="${escapeHtml(card.thumbnail)}" 
                         alt="${escapeHtml(card.title || '')}" 
                         loading="lazy"
                         onerror="this.parentElement.innerHTML='${numberHtml}<div class=\\'thumb-placeholder\\'>🖼️<br><small style=\\'font-size:11px;color:#555\\'>Ошибка загрузки</small></div>'">
                    <div class="emu-card-badges">
                        ${card.duration ? `<span class="emu-badge emu-badge-duration">${escapeHtml(card.duration)}</span>` : ''}
                        ${card.quality ? `<span class="emu-badge emu-badge-quality">${escapeHtml(card.quality)}</span>` : ''}
                    </div>
                </div>`;
        } else {
            thumbHtml = `
                <div class="emu-card-thumb">
                    ${numberHtml}
                    <div class="thumb-placeholder">🎬</div>
                    <div class="emu-card-badges">
                        ${card.duration ? `<span class="emu-badge emu-badge-duration">${escapeHtml(card.duration)}</span>` : ''}
                        ${card.quality ? `<span class="emu-badge emu-badge-quality">${escapeHtml(card.quality)}</span>` : ''}
                    </div>
                </div>`;
        }

        // Инфо
        let infoHtml = '<div class="emu-card-info">';
        
        if (card.title) {
            infoHtml += `<div class="emu-card-title" title="${escapeHtml(card.title)}">${escapeHtml(card.title)}</div>`;
        } else {
            infoHtml += `<div class="emu-card-title" style="color:#555;font-style:italic;">Без названия</div>`;
        }

        if (card.link) {
            infoHtml += `<a class="emu-card-link" href="${escapeHtml(card.link)}" target="_blank" rel="noopener">${escapeHtml(card.link)}</a>`;
        }

        // Мета-данные
        const metaParts = [];
        if (card.duration) metaParts.push(`<span class="emu-card-meta-item">⏱ ${escapeHtml(card.duration)}</span>`);
        if (card.quality) metaParts.push(`<span class="emu-card-meta-item">📺 ${escapeHtml(card.quality)}</span>`);
        if (card.thumbnail) metaParts.push(`<span class="emu-card-meta-item">🖼 Есть превью</span>`);
        
        if (metaParts.length) {
            infoHtml += `<div class="emu-card-meta">${metaParts.join('')}</div>`;
        }

        infoHtml += '</div>';

        cardEl.innerHTML = thumbHtml + infoHtml;
        container.appendChild(cardEl);
    });

    // ---- Шпаргалка по селекторам ----
    const struct = data.videoCards.structure;
    const hasAnySelector = struct.title.selector || struct.link.selector || 
                           struct.thumbnail.selector || struct.duration.selector || 
                           struct.quality.selector;
    
    if (hasAnySelector) {
        cheatsheet.style.display = 'block';
        let cheatHtml = '';

        const rows = [
            { label: '📦 Карточка', value: data.videoCards.cardSelector },
            { label: '📌 Название', value: struct.title.selector, extra: struct.title.tag ? `тег: <${struct.title.tag}>` : '' },
            { label: '🔗 Ссылка', value: struct.link.selector, extra: struct.link.pattern ? `паттерн: ${struct.link.pattern}` : '' },
            { label: '🖼 Превью', value: struct.thumbnail.selector, extra: struct.thumbnail.attribute ? `атрибут: ${struct.thumbnail.attribute}` : '' },
            { label: '⏱ Длительность', value: struct.duration.selector, extra: struct.duration.tag ? `тег: <${struct.duration.tag}>` : '' },
            { label: '📺 Качество', value: struct.quality.selector }
        ];

        rows.forEach(row => {
            if (row.value) {
                cheatHtml += `<div class="cheatsheet-row">
                    <span class="cheatsheet-label">${row.label}</span>
                    <span class="cheatsheet-value">${escapeHtml(row.value)}${row.extra ? ` <span style="color:#666;font-size:11px;">(${escapeHtml(row.extra)})</span>` : ''}</span>
                </div>`;
            }
        });

        document.getElementById('cheatsheetContent').innerHTML = cheatHtml;
    } else {
        cheatsheet.style.display = 'none';
    }
}

function setCardView(view, btn) {
    const container = document.getElementById('emulatedCards');
    
    if (view === 'list') {
        container.classList.add('list-view');
    } else {
        container.classList.remove('list-view');
    }

    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
}

// ================================================================
// ЭМУЛЯЦИЯ ВИДЕО-СТРАНИЦЫ (НОВАЯ ВКЛАДКА)
// ================================================================

function renderEmulatedVideo(data) {
    const container = document.getElementById('emulatedVideo');
    const emptyState = document.getElementById('videoEmptyState');

    container.innerHTML = '';

    if (!data.videoPage || !data.videoPage.analyzed) {
        container.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    container.style.display = '';
    emptyState.style.display = 'none';

    const vp = data.videoPage;
    let html = '<div class="emu-video-page">';

    // ---- Заголовок видео ----
    const videoTitle = vp.videoTitle || vp.pageTitle || 'Без названия';
    html += `<h3 style="color:#ddd; margin-bottom:15px; font-size:1.2em;">${escapeHtml(videoTitle)}</h3>`;

    // ---- Плеер ----
    html += '<div class="emu-player-container">';
    
    let playerRendered = false;

    // Пытаемся встроить реальный плеер
    if (vp.videoSources && vp.videoSources.found && vp.videoSources.sources.length > 0) {
        // Ищем MP4 для нативного плеера
        const mp4Source = vp.videoSources.sources.find(s => s.type === 'MP4');
        const hlsSource = vp.videoSources.sources.find(s => s.type === 'HLS (m3u8)');
        
        if (mp4Source) {
            html += `<video controls preload="metadata" poster="">
                <source src="${escapeHtml(mp4Source.url)}" type="video/mp4">
                Ваш браузер не поддерживает видео.
            </video>`;
            playerRendered = true;
        } else if (hlsSource) {
            // HLS — показываем плейсхолдер с инфо
            html += `<div class="emu-player-placeholder">
                <span class="play-icon">📡</span>
                <p>HLS Stream (m3u8)</p>
                <p style="font-size:12px; color:#555; margin-top:5px;">Для воспроизведения HLS нужен hls.js или VLC</p>
                <code style="font-size:11px; color:#44dd44; margin-top:10px; word-break:break-all; padding:0 20px; text-align:center;">${escapeHtml(hlsSource.url.substring(0, 120))}...</code>
            </div>`;
            playerRendered = true;
        }
    }
    
    // Если есть iframe плеер
    if (!playerRendered && vp.videoSources && vp.videoSources.playerIframes && vp.videoSources.playerIframes.length > 0) {
        const iframe = vp.videoSources.playerIframes[0];
        html += `<iframe src="${escapeHtml(iframe.src)}" allowfullscreen></iframe>`;
        playerRendered = true;
    }

    // Если ничего не нашли
    if (!playerRendered) {
        html += `<div class="emu-player-placeholder">
            <span class="play-icon">▶️</span>
            <p>Прямой источник видео не обнаружен</p>
            <p style="font-size:12px; color:#555; margin-top:5px;">Видео может быть зашифровано или загружаться динамически</p>
        </div>`;
    }

    html += '</div>'; // /emu-player-container

    // ---- Мета-информация видео ----
    html += '<dl class="emu-video-meta">';
    
    html += `<dt>URL страницы:</dt>
             <dd><a href="${escapeHtml(vp.videoUrl)}" target="_blank" style="color:#4488cc;">${escapeHtml(vp.videoUrl)}</a></dd>`;
    
    if (vp.urlStructure && vp.urlStructure.pattern) {
        html += `<dt>URL паттерн:</dt>
                 <dd style="color:#ffaa44;">${escapeHtml(vp.urlStructure.pattern)}</dd>`;
    }

    if (vp.videoSources) {
        html += `<dt>Источники найдены:</dt>
                 <dd>${vp.videoSources.found ? 
                    `<span style="color:#44dd44;">✅ Да (${vp.videoSources.sources.length} шт.)</span>` : 
                    `<span style="color:#ff4444;">❌ Нет</span>`}</dd>`;
        
        if (vp.videoSources.methods && vp.videoSources.methods.length > 0) {
            html += `<dt>Методы обнаружения:</dt>
                     <dd>${vp.videoSources.methods.map(m => `<span class="tag">${escapeHtml(m)}</span>`).join(' ')}</dd>`;
        }
    }

    if (vp.relatedVideos) {
        html += `<dt>Похожие видео:</dt>
                 <dd>${vp.relatedVideos.found ? 
                    `<span style="color:#44dd44;">✅ ${vp.relatedVideos.count} шт. (${escapeHtml(vp.relatedVideos.selector)})</span>` :
                    `<span style="color:#888;">Не найдены</span>`}</dd>`;
    }

    html += '</dl>';

    // ---- Список источников видео ----
    if (vp.videoSources && vp.videoSources.sources.length > 0) {
        html += '<div class="emu-video-sources">';
        html += '<h4>📡 Обнаруженные источники видео</h4>';

        vp.videoSources.sources.forEach((source, idx) => {
            const typeClass = source.type.includes('HLS') ? 'hls' :
                            source.type === 'MP4' ? 'mp4' :
                            source.type === 'WebM' ? 'webm' : 'unknown';
            
            html += `<div class="emu-source-item">
                <span class="emu-source-type ${typeClass}">${escapeHtml(source.type)}</span>
                <span class="emu-source-url">${escapeHtml(source.url)}</span>
                <span class="emu-source-found-in">via: ${escapeHtml(source.foundIn)}</span>
                <div class="emu-source-actions">
                    <button class="emu-source-btn" onclick="copyToClipboard('${escapeHtml(source.url).replace(/'/g, "\\'")}')">📋 Копировать</button>
                    <a class="emu-source-btn" href="${escapeHtml(source.url)}" target="_blank" style="text-decoration:none;">🔗 Открыть</a>
                </div>
            </div>`;
        });

        html += '</div>';
    }

    // ---- iframe плееры ----
    if (vp.videoSources && vp.videoSources.playerIframes && vp.videoSources.playerIframes.length > 0) {
        html += '<div class="emu-iframes-section">';
        html += '<h4>🪟 Обнаруженные iframe-плееры</h4>';

        vp.videoSources.playerIframes.forEach((iframe, idx) => {
            html += `<div class="emu-source-item">
                <span class="emu-source-type iframe">iframe</span>
                <span class="emu-source-url">${escapeHtml(iframe.src)}</span>
                <span class="emu-source-found-in">${iframe.width ? iframe.width + 'x' + iframe.height : ''}</span>
                <div class="emu-source-actions">
                    <button class="emu-source-btn" onclick="copyToClipboard('${escapeHtml(iframe.src).replace(/'/g, "\\'")}')">📋</button>
                    <a class="emu-source-btn" href="${escapeHtml(iframe.src)}" target="_blank" style="text-decoration:none;">🔗</a>
                </div>
            </div>`;
        });

        html += '</div>';
    }

    // ---- Конфиги плеера (JS сниппеты) ----
    if (vp.videoSources && vp.videoSources.playerConfigSnippets && vp.videoSources.playerConfigSnippets.length > 0) {
        html += '<div class="emu-config-snippets">';
        html += '<h4>🔧 Обнаруженные JS-конфиги плеера</h4>';

        vp.videoSources.playerConfigSnippets.forEach((snippet, idx) => {
            html += `<div class="emu-config-snippet">${escapeHtml(snippet)}</div>`;
        });

        html += '</div>';
    }

    // ---- Note ----
    if (vp.videoSources && vp.videoSources.note) {
        html += `<div style="margin-top:15px; padding:12px; background:#2a2a1e; border:1px solid #555522; border-radius:8px; color:#ffaa44; font-size:13px;">
            ⚠️ ${escapeHtml(vp.videoSources.note)}
        </div>`;
    }

    // ---- Похожие видео ----
    if (vp.relatedVideos && vp.relatedVideos.found && vp.relatedVideos.sampleLinks) {
        html += '<div class="emu-related">';
        html += `<h4>🔄 Похожие видео <span style="color:#666;font-size:12px;">(${vp.relatedVideos.count} найдено, показаны первые ${vp.relatedVideos.sampleLinks.length})</span></h4>`;
        html += '<div class="emu-related-grid">';

        vp.relatedVideos.sampleLinks.forEach(link => {
            html += `<div class="emu-related-item">
                ${link.text ? `<div class="related-text">${escapeHtml(link.text)}</div>` : ''}
                <a href="${escapeHtml(link.href)}" target="_blank">${escapeHtml(link.href.substring(0, 60))}...</a>
            </div>`;
        });

        html += '</div></div>';
    }

    // ---- Ошибка ----
    if (vp.error) {
        html += `<div style="margin-top:15px; padding:12px; background:#3e1a1a; border:1px solid #553333; border-radius:8px; color:#ff4444; font-size:13px;">
            ❌ ${escapeHtml(vp.error)}
        </div>`;
    }

    html += '</div>'; // /emu-video-page

    container.innerHTML = html;
}

// Утилита копирования в буфер
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        setStatus('📋 Скопировано в буфер обмена!', 'success');
    }).catch(() => {
        // Фоллбэк
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setStatus('📋 Скопировано!', 'success');
    });
}

// ================================================================
// ВИЗУАЛЬНЫЙ ОТЧЁТ (оригинальный, без изменений)
// ================================================================

function syntaxHighlight(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
        /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
        function (match) {
            let cls = 'color: #ae81ff;';
            if (/^"/.test(match)) {
                if (/:$/.test(match)) {
                    cls = 'color: #a6e22e;';
                } else {
                    cls = 'color: #e6db74;';
                }
            } else if (/true|false/.test(match)) {
                cls = 'color: #66d9ef;';
            } else if (/null/.test(match)) {
                cls = 'color: #f92672;';
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

    // Карточки
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

        // Примеры (только первые 5 в визуальном отчёте)
        if (data.videoCards.sampleCards.length > 0) {
            const showCount = Math.min(5, data.videoCards.sampleCards.length);
            html += `<div class="report-section">
                <div class="report-section-header">📑 Примеры карточек (${showCount} из ${data.videoCards.sampleCards.length})</div>
                <div class="report-section-body">`;
            
            for (let i = 0; i < showCount; i++) {
                const card = data.videoCards.sampleCards[i];
                html += `<div style="margin-bottom:15px; padding:10px; background:#0f0f23; border-radius:8px;">
                    <strong style="color:#00d4ff;">#${i+1}</strong><br>`;
                if (card.title) html += `📌 <strong>Название:</strong> ${escapeHtml(card.title)}<br>`;
                if (card.link) html += `🔗 <strong>Ссылка:</strong> <a style="color:#00ff88;" href="${card.link}" target="_blank">${card.link.substring(0, 80)}...</a><br>`;
                if (card.thumbnail) html += `🖼 <strong>Превью:</strong> <a style="color:#e6db74;" href="${card.thumbnail}" target="_blank">Открыть</a><br>`;
                if (card.duration) html += `⏱ <strong>Длительность:</strong> ${card.duration}<br>`;
                if (card.quality) html += `📺 <strong>Качество:</strong> ${card.quality}<br>`;
                html += `</div>`;
            }

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
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
}

// ================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ UI
// ================================================================

function showTab(name, btnEl) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
    
    document.getElementById('tab-' + name).classList.add('active');
    if (btnEl) {
        btnEl.classList.add('active');
    }
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
    
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            runFullAnalysis();
        }
    });
});
