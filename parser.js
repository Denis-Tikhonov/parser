// ================================================================
// SITE STRUCTURE ANALYZER v3.2
// Full: XPath, Fallbacks, views/likes/date, slug name,
// <time> tag, query params, Base64, JS dependency, cookies
// ================================================================

const DEFAULT_TARGET_URL = "";
let analysisResult = null;
let transportLog = [];
const logT = (m, t = 'info') => transportLog.push({ time: new Date().toLocaleTimeString(), message: m, type: t });

// ================================================================
// UTILS
// ================================================================
const $ = id => document.getElementById(id);
const setStatus = (m, t = 'loading') => { const e = $('status'); if (e) { e.textContent = m; e.className = 'status ' + t; } };
const setProgress = (p, t, s) => { const c = $('progress-container'), b = $('progress-bar'), x = $('progress-text'); if (!c) return; c.style.display = 'block'; b.style.width = p + '%'; x.textContent = t || p + '%'; b.classList.remove('cors-error', 'warning', 'worker'); if (s) b.classList.add(s); };
const baseOf = u => { try { return new URL(u).origin; } catch { return ''; } };
const resolve = (h, b) => { if (!h) return ''; try { return new URL(h, b).href; } catch { return h; } };
const uniq = a => [...new Set(a.filter(Boolean))];
const esc = t => { if (!t) return ''; const d = document.createElement('div'); d.textContent = String(t); return d.innerHTML; };

// ================================================================
// XPATH
// ================================================================
function genXPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `//*[@id="${el.id}"]`;
    const parts = []; let cur = el;
    while (cur && cur.nodeType === 1) {
        let tag = cur.tagName.toLowerCase();
        if (cur.className && typeof cur.className === 'string') {
            const cls = cur.className.trim().split(/\s+/).filter(c => c.length > 0)[0];
            if (cls && cls.length > 2 && !['col', 'row', 'item', 'div', 'block', 'wrap', 'container'].includes(cls)) {
                parts.unshift(`//${tag}[contains(@class,"${cls}")]`);
                break;
            }
        }
        let idx = 1, sib = cur.previousElementSibling;
        while (sib) { if (sib.tagName === cur.tagName) idx++; sib = sib.previousElementSibling; }
        parts.unshift(`/${tag}[${idx}]`);
        cur = cur.parentElement;
    }
    return parts.join('');
}
function shortXP(el) {
    if (!el || el.nodeType !== 1) return '';
    const tag = el.tagName.toLowerCase();
    if (el.id) return `//*[@id="${el.id}"]`;
    if (el.className && typeof el.className === 'string') { const c = el.className.trim().split(/\s+/)[0]; if (c) return `//${tag}[contains(@class,"${c}")]`; }
    return `//${tag}`;
}

// ================================================================
// UA / Headers
// ================================================================
const UA = {
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    mobile: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    bot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
};
function getUA() { const s = $('uaSelect'); if (!s) return UA.desktop; if (s.value === 'custom') { const c = $('uaCustom'); return c?.value.trim() || UA.desktop; } return UA[s.value] || UA.desktop; }

// ================================================================
// Worker / CORS
// ================================================================
const getW = () => { const i = $('workerUrl'); return i ? i.value.trim().replace(/\/$/, '') : ''; };
const updW = h => { const b = $('workerStatusBadge'); if (b) { b.textContent = h ? '✦ активен' : '○ не задан'; b.className = 'worker-badge ' + (h ? 'active' : 'inactive'); } };
function updCI(state, detail) {
    const el = $('corsIndicator'); if (!el) return;
    const m = { 'trying-direct': ['🔗 Прямое...', 'trying'], 'direct-ok': ['✅ Прямой OK', 'direct-ok'], 'trying-worker': ['⚡ Worker...', 'trying'],
        'worker-ok': ['✅ Worker ' + (detail || ''), 'worker-ok'], 'cors-detected': ['🛡️ CORS → прокси', 'cors-blocked'], 'trying-proxy': ['🔄 ' + (detail || ''), 'cors-blocked'],
        'proxy-ok': ['✅ ' + (detail || ''), 'proxy-ok'], 'all-failed': ['❌ Всё заблокировано', 'all-failed'], hidden: ['', ''] };
    const s = m[state] || m.hidden; el.textContent = s[0]; el.className = 'cors-indicator ' + s[1]; el.style.display = state === 'hidden' ? 'none' : 'block';
}
const proxies = () => [
    { n: 'allorigins', u: 'https://api.allorigins.win/raw?url=' }, { n: 'corsproxy', u: 'https://corsproxy.io/?' },
    { n: 'codetabs', u: 'https://api.codetabs.com/v1/proxy?quest=' }, { n: 'thingproxy', u: 'https://thingproxy.freeboard.io/fetch/' },
    { n: 'cors-anywhere', u: 'https://cors-anywhere.herokuapp.com/' }, { n: 'cors.bridged', u: 'https://cors.bridged.cc/' }
];
const isCE = e => { if (!e) return false; const m = (e.message || '').toLowerCase(); return m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed') || e.name === 'TypeError'; };

// ================================================================
// FETCH
// ================================================================
async function fDirect(url) { const a = new AbortController(), t = setTimeout(() => a.abort(), 10000); try { const r = await fetch(url, { headers: { Accept: 'text/html,*/*' }, signal: a.signal }); clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); const h = await r.text(); if (h.length < 50) throw new Error('Empty'); return h; } catch (e) { clearTimeout(t); throw e; } }
async function fWorker(url) { const w = getW(); if (!w) throw new Error('No worker'); const a = new AbortController(), t = setTimeout(() => a.abort(), 15000); try { const r = await fetch(w + '/?url=' + encodeURIComponent(url) + '&ua=' + encodeURIComponent(getUA()), { headers: { Accept: 'text/html,*/*' }, signal: a.signal }); clearTimeout(t); if (!r.ok) throw new Error('W' + r.status); const h = await r.text(); if (h.length < 50) throw new Error('Empty'); return h; } catch (e) { clearTimeout(t); throw e; } }
async function fProxy(url, pfx) { const a = new AbortController(), t = setTimeout(() => a.abort(), 15000); const raw = pfx.includes('thingproxy') || pfx.includes('cors-anywhere') || pfx.includes('cors.bridged'); try { const r = await fetch(raw ? pfx + url : pfx + encodeURIComponent(url), { headers: { Accept: 'text/html,*/*' }, signal: a.signal }); clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); const h = await r.text(); if (h.length < 50) throw new Error('Empty'); return h; } catch (e) { clearTimeout(t); throw e; } }

async function fetchPage(url) {
    const mode = ($('proxySelect') || {}).value || 'auto', w = getW();
    if (mode === '') { logT('Direct', 'info'); updCI('trying-direct'); try { const h = await fDirect(url); logT('✅', 'success'); updCI('direct-ok'); return h; } catch (e) { logT('❌ ' + e.message, 'fail'); updCI('all-failed'); throw e; } }
    if (mode === 'auto') {
        try { logT('1 Direct', 'info'); updCI('trying-direct'); setProgress(12, '🔗'); const h = await fDirect(url); logT('✅', 'success'); updCI('direct-ok'); return h; } catch (e) { logT(isCE(e) ? '🛡️ CORS' : e.message, 'warning'); }
        if (w) { try { logT('2 Worker', 'info'); updCI('trying-worker'); setProgress(14, '⚡', 'worker'); const h = await fWorker(url); logT('✅ W', 'success'); updCI('worker-ok', w); return h; } catch (e) { logT('W: ' + e.message, 'fail'); } }
        updCI('cors-detected'); const px = proxies();
        for (let i = 0; i < px.length; i++) { try { logT('3 ' + px[i].n, 'info'); updCI('trying-proxy', px[i].n); setProgress(15 + i * 2, px[i].n, 'warning'); const h = await fProxy(url, px[i].u); logT('✅ ' + px[i].n, 'success'); updCI('proxy-ok', px[i].n); return h; } catch (e) { logT('❌ ' + px[i].n, 'fail'); } }
        updCI('all-failed'); throw new Error('All blocked');
    }
    // specific proxy
    if (w) { try { const h = await fWorker(url); logT('✅ W', 'success'); updCI('worker-ok', w); return h; } catch (e) { logT('W: ' + e.message, 'warning'); } }
    try { const h = await fProxy(url, mode); updCI('proxy-ok', mode.split('/')[2]); return h; } catch (e) { updCI('all-failed'); throw e; }
}
async function extractVW(u) { const w = getW(); if (!w) return null; try { const r = await fetch(w + '/?url=' + encodeURIComponent(u) + '&mode=extract'); if (!r.ok) return null; const d = await r.json(); return d.success && d.videoUrl ? d.videoUrl : null; } catch { return null; } }
const parseH = h => new DOMParser().parseFromString(h, 'text/html');

// ================================================================
// ANALYZERS
// ================================================================

// -- DOM --
function aDom(doc) {
    const all = doc.querySelectorAll('*').length, scr = doc.querySelectorAll('script'), inl = Array.from(scr).reduce((s, e) => s + (e.textContent || '').length, 0);
    return { totalElements: all, scripts: scr.length, inlineScriptSize: inl, externalScripts: Array.from(scr).filter(s => s.src).map(s => s.src).slice(0, 15), images: doc.querySelectorAll('img').length, links: doc.querySelectorAll('a[href]').length, forms: doc.querySelectorAll('form').length, iframes: doc.querySelectorAll('iframe').length };
}

// -- Frameworks --
function aFW(doc, html) {
    const found = [], src = html + Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const ck = [['React', ['data-reactroot', '_reactRootContainer', 'ReactDOM']], ['Next.js', ['__NEXT_DATA__', '_next/static']], ['Vue.js', ['__vue__', 'v-cloak', 'data-v-', 'createApp']], ['Nuxt.js', ['__NUXT__', '_nuxt/']], ['Angular', ['ng-app', 'ng-version', 'zone.js']], ['Svelte', ['__svelte']], ['jQuery', ['jquery.min.js', 'jQuery']], ['WordPress', ['wp-content', 'wp-json']], ['Cloudflare', ['cf-browser-verification', 'challenges.cloudflare.com']], ['DDoS-Guard', ['ddos-guard']], ['JW Player', ['jwplayer']], ['Video.js', ['videojs', 'video-js']], ['HLS.js', ['hls.js', 'Hls.']]];
    for (const [n, ps] of ck) { for (const p of ps) { if (src.includes(p)) { found.push(n); break; } } }
    return uniq(found);
}

// -- API --
function aAPI(doc, html) {
    const src = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n'), eps = [];
    for (const p of [/fetch\s*\(\s*['"`](\/[^'"`]+)/gi, /axios\.\w+\(\s*['"`](\/[^'"`]+)/gi, /\.ajax\([^}]*url:\s*['"`](\/[^'"`]+)/gi]) { let m; while ((m = p.exec(src))) if (m[1]) eps.push(m[1]); p.lastIndex = 0; }
    const ap = /['"`]((?:\/api\/|\/v[12]\/|\/graphql|\/wp-json\/)[^'"`]*?)['"`]/gi; let m2; while ((m2 = ap.exec(src))) if (m2[1]) eps.push(m2[1]);
    const sv = []; for (const p of [/__NEXT_DATA__/, /__NUXT__/, /__INITIAL_STATE__/, /window\.__data/i]) if (p.test(src)) sv.push(p.source.replace(/\\/g, ''));
    return { endpoints: uniq(eps).slice(0, 15), stateVars: sv };
}

// -- Protection --
function aProt(doc, html) {
    const r = { cloudflare: false, ddosGuard: false, recaptcha: false, ageGate: null, cookies: [] }, lc = html.toLowerCase();
    if (lc.includes('challenges.cloudflare.com') || lc.includes('cf-browser-verification')) r.cloudflare = true;
    if (lc.includes('ddos-guard')) r.ddosGuard = true;
    if (lc.includes('recaptcha') || lc.includes('hcaptcha')) r.recaptcha = true;
    const src = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const cp = /(?:setCookie|document\.cookie\s*=\s*['"`])([^'"`=;]+)/gi; let cm; while ((cm = cp.exec(src))) r.cookies.push(cm[1]);
    r.cookies = uniq(r.cookies).slice(0, 10);
    let agF = false, agS = null;
    for (const s of ['#age-verify', '#age-gate', '.age-verify', '.age-gate', '[class*="age-verif"]', '[class*="age-gate"]', '#disclaimer']) { try { if (doc.querySelector(s)) { agF = true; agS = s; break; } } catch {} }
    if (!agF && /(?:мне\s*(?:уже\s*)?18|i\s*am\s*(?:over\s*)?18|18\+|старше\s*18|confirm.*age)/i.test(doc.body?.textContent || '')) agF = true;
    if (agF) { let tp = 'css-overlay'; if (lc.includes('cookie') && lc.includes('age')) tp = 'cookie'; r.ageGate = { detected: true, type: tp, selector: agS, impact: tp === 'css-overlay' ? 'low' : 'medium', note: tp === 'css-overlay' ? 'Контент в HTML — оверлей визуальный' : 'Может требоваться cookie' }; }
    return r;
}

// -- Obfuscation --
function aObf(html) {
    const r = { base64Urls: [], obfPatterns: [], tokenUrls: [] };
    let m; const at = /atob\s*\(\s*['"`]([A-Za-z0-9+/=]{20,})['"`]\s*\)/gi;
    while ((m = at.exec(html))) { try { const d = atob(m[1]); if (/https?:\/\/.*\.(mp4|m3u8)/.test(d)) r.base64Urls.push({ enc: m[1].substring(0, 50), dec: d.substring(0, 200), type: d.includes('.m3u8') ? 'HLS' : 'MP4' }); } catch {} }
    const b6 = /['"`]([A-Za-z0-9+/=]{40,})['"`]/g;
    while ((m = b6.exec(html))) { try { const d = atob(m[1]); if (/https?:\/\/.*\.(mp4|m3u8)/.test(d)) r.base64Urls.push({ enc: m[1].substring(0, 50), dec: d.substring(0, 200), type: d.includes('.m3u8') ? 'HLS' : 'MP4' }); } catch {} }
    if (/String\.fromCharCode/.test(html)) r.obfPatterns.push('String.fromCharCode');
    const tp = /https?:\/\/[^\s"'<>]+\.(mp4|m3u8)[^\s"'<>]*(?:token|expires|hash|sign)=[^\s"'<>]+/gi;
    while ((m = tp.exec(html))) r.tokenUrls.push(m[0].substring(0, 200));
    r.base64Urls = r.base64Urls.slice(0, 5); r.tokenUrls = r.tokenUrls.slice(0, 5);
    return r;
}

// -- JS Dependency --
function aJSDep(doc, html, cardsFound, fw) {
    const r = { jsRequired: 'no', catalog: 'no', player: 'no', evidence: [] };
    const root = doc.querySelector('#app, #root, #__next, #__nuxt, [data-reactroot]');
    if (root && root.children.length <= 3) { r.evidence.push(`SPA root <${root.tagName.toLowerCase()}> id="${root.id || root.className}" — ${root.children.length} children`); r.catalog = 'yes'; }
    const ns = doc.querySelector('noscript'); if (ns && ns.textContent.trim().length > 10 && /enable|javascript|включите/i.test(ns.textContent)) { r.evidence.push('<noscript> warning'); r.catalog = 'yes'; }
    const dt = doc.querySelectorAll('*').length;
    if (dt < 80) { r.evidence.push(`Tiny DOM: ${dt}`); r.catalog = 'yes'; }
    else if (dt < 200 && !cardsFound) { r.evidence.push(`Small DOM ${dt} + no cards`); r.catalog = 'yes'; }
    const src = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    if (/__NEXT_DATA__\s*=\s*\{/.test(src)) { r.evidence.push('__NEXT_DATA__ with data'); if (r.catalog !== 'yes') r.catalog = 'partial'; }
    if (/__NUXT__\s*=/.test(src)) { r.evidence.push('__NUXT__ state'); if (r.catalog !== 'yes') r.catalog = 'partial'; }
    if (cardsFound) { r.evidence.push('Cards in HTML — no JS needed for catalog'); r.catalog = 'no'; }
    if (fw.some(f => ['JW Player', 'Video.js', 'HLS.js'].includes(f))) { r.player = 'yes'; r.evidence.push('JS player: ' + fw.filter(f => ['JW Player', 'Video.js', 'HLS.js'].includes(f)).join(', ')); }
    r.jsRequired = r.catalog === 'yes' ? 'yes' : r.catalog === 'partial' || r.player === 'yes' ? 'partial' : 'no';
    return r;
}

// -- Query Params --
function aQueryParams(doc, baseUrl) {
    const params = {};
    doc.querySelectorAll('a[href]').forEach(a => {
        try {
            const u = new URL(resolve(a.getAttribute('href'), baseUrl));
            u.searchParams.forEach((v, k) => {
                if (!params[k]) params[k] = { values: new Set(), count: 0 };
                params[k].values.add(v);
                params[k].count++;
            });
        } catch {}
    });
    // Classify
    const result = [];
    for (const [k, data] of Object.entries(params)) {
        const vals = [...data.values].slice(0, 10);
        let category = 'unknown';
        if (/^(page|p|pg|start|offset|from)$/i.test(k)) category = 'pagination';
        else if (/^(sort|order|orderby|sortby)$/i.test(k)) category = 'sorting';
        else if (/^(q|query|search|s|keyword|k|find)$/i.test(k)) category = 'search';
        else if (/^(cat|category|tag|genre|type|filter)$/i.test(k)) category = 'filter';
        else if (/^(id|vid|video)$/i.test(k)) category = 'content_id';
        else if (/^(lang|locale|hl)$/i.test(k)) category = 'locale';
        else if (/^(limit|per_page|count|size)$/i.test(k)) category = 'limit';
        result.push({ param: k, category, values: vals, occurrences: data.count });
    }
    result.sort((a, b) => b.occurrences - a.occurrences);
    return result.slice(0, 30);
}

// -- Encoding --
function aEnc(doc, html) {
    const mc = doc.querySelector('meta[charset]'), mct = doc.querySelector('meta[http-equiv="Content-Type"]');
    let cs = 'N/A'; if (mc) cs = mc.getAttribute('charset'); else if (mct) { const m = (mct.getAttribute('content') || '').match(/charset=([^\s;]+)/i); if (m) cs = m[1]; }
    return { charset: cs.toUpperCase() };
}

// -- Pagination --
function aPag(doc, base, target) {
    const r = { mainPageUrl: target, pagination: { found: false, type: null, pattern: null, examples: [] } };
    let pl = [], ms = '';
    for (const s of ['.pagination a', '.pager a', '.pages a', 'nav.pagination a', '.paginator a', 'ul.pagination a', 'a.page-link', '.paging a', '[class*="pagination"] a']) { try { const l = doc.querySelectorAll(s); if (l.length) { ms = s; l.forEach(a => { const h = a.getAttribute('href'); if (h) pl.push(h); }); break; } } catch {} }
    if (!pl.length) { doc.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href') || '', t = a.textContent.trim(); if (/[?&]page=\d+/i.test(h) || /\/page\/\d+/i.test(h) || /[?&]p=\d+/i.test(h) || (/\/\d+\/?$/.test(h) && /^\d+$/.test(t))) pl.push(h); }); if (pl.length) ms = 'pattern'; }
    if (pl.length) { r.pagination.found = true; r.pagination.selector = ms; r.pagination.examples = uniq(pl.map(h => resolve(h, base))).slice(0, 10); const s0 = pl[0]; if (/[?&]page=\d+/i.test(s0)) { r.pagination.type = 'query'; r.pagination.pattern = '?page=N'; } else if (/\/page\/\d+/i.test(s0)) { r.pagination.type = 'path'; r.pagination.pattern = '/page/N/'; } else { r.pagination.type = 'other'; r.pagination.pattern = s0; } }
    return r;
}

// -- Search --
function aSrch(doc, base) {
    const r = { found: false, forms: [], searchPattern: null };
    doc.querySelectorAll('form').forEach(f => { const act = f.getAttribute('action') || ''; let si = false, det = [];
        f.querySelectorAll('input').forEach(i => { const ty = (i.getAttribute('type') || 'text').toLowerCase(), nm = i.getAttribute('name') || '', ph = i.getAttribute('placeholder') || '';
            if (ty === 'search' || nm.match(/^(q|query|search|s|keyword|k|find)$/i) || ph.match(/(поиск|search|найти)/i)) si = true; det.push({ type: ty, name: nm, placeholder: ph }); });
        f.querySelectorAll('select').forEach(s => { const nm = s.getAttribute('name') || ''; const opts = Array.from(s.querySelectorAll('option')).map(o => ({ value: o.value, text: o.textContent.trim() })); det.push({ type: 'select', name: nm, options: opts }); });
        if (si || act.match(/(search|find)/i)) { r.found = true; r.forms.push({ action: resolve(act, base), method: (f.getAttribute('method') || 'GET').toUpperCase(), inputs: det }); }
    });
    if (r.forms.length) { const f = r.forms[0], si = f.inputs.find(i => i.name.match(/^(q|query|search|s|keyword|k)$/i)), p = si ? si.name : 'q'; r.searchPattern = f.method === 'GET' ? `${f.action}?${p}={q}` : `POST ${f.action} (${p}={q})`; }
    return r;
}

// -- Sort & Categories --
function aSC(doc, base) {
    const r = { sorting: { found: false, options: [] }, categories: { found: false, list: [] } };
    for (const s of ['select[name*="sort"]', '[class*="sort"] a', '.sorting a', 'a[href*="sort="]', 'a[href*="order="]']) {
        try { const els = doc.querySelectorAll(s); els.forEach(el => { if (el.tagName === 'SELECT') { el.querySelectorAll('option').forEach(o => r.sorting.options.push({ label: o.textContent.trim(), value: o.value })); r.sorting.found = true; } else if (el.tagName === 'A') { const h = el.getAttribute('href'); if (h) { r.sorting.options.push({ label: el.textContent.trim(), url: resolve(h, base) }); r.sorting.found = true; } } }); if (r.sorting.found) break; } catch {} }
    if (!r.sorting.found) { const sp = /(sort|order|popular|rating|newest|latest|longest|viewed|top)/i; doc.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href') || '', t = a.textContent.trim(); if (sp.test(h) && t.length > 0 && t.length < 50) { r.sorting.options.push({ label: t, url: resolve(h, base) }); r.sorting.found = true; } }); }
    const sn = new Set(); r.sorting.options = r.sorting.options.filter(o => { const k = o.label + (o.url || o.value || ''); if (sn.has(k)) return false; sn.add(k); return true; }).slice(0, 20);
    for (const s of ['.categories a', '.category-list a', '.cats a', '.tags a', '[class*="categor"] a', 'a[href*="/categories/"]', 'a[href*="/category/"]', 'a[href*="/tags/"]']) { try { const l = doc.querySelectorAll(s); if (l.length >= 3) { l.forEach(a => { const h = a.getAttribute('href'), t = a.textContent.trim(); if (h && t && t.length < 100) r.categories.list.push({ name: t, url: resolve(h, base) }); }); break; } } catch {} }
    if (r.categories.list.length) { r.categories.found = true; const sc = new Set(); r.categories.list = r.categories.list.filter(c => { if (sc.has(c.url)) return false; sc.add(c.url); return true; }).slice(0, 50); r.categories.totalCount = r.categories.list.length; }
    return r;
}

// ================================================================
// VIDEO CARDS — FULL with views/likes/date/slug + XPath + Fallbacks
// ================================================================

function extractSlugName(href) {
    if (!href) return null;
    try {
        const path = new URL(href).pathname;
        // Find the last meaningful segment
        const segments = path.split('/').filter(Boolean);
        for (let i = segments.length - 1; i >= 0; i--) {
            const seg = segments[i];
            if (/^[a-z0-9][-a-z0-9_]{5,}$/i.test(seg) && !/^\d+$/.test(seg)) {
                return seg.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
            }
        }
    } catch {}
    return null;
}

function findInCard(card, selectors, validate) {
    const results = [];
    for (const sel of selectors) {
        try {
            const el = card.querySelector(sel);
            if (el) {
                const text = el.textContent.trim();
                if (validate ? validate(text, el) : text.length > 0) {
                    results.push({ el, sel, text });
                }
            }
        } catch {}
    }
    return results;
}

function aCards(doc, base) {
    const r = {
        found: false, cardSelector: null, cardXPath: null, totalCardsFound: 0,
        structure: {
            title: { css: null, xpath: null, fallbacks: [], example: null },
            link: { css: null, xpath: null, fallbacks: [], example: null, pattern: null },
            thumbnail: { css: null, xpath: null, fallbacks: [], attribute: null, example: null },
            duration: { css: null, xpath: null, fallbacks: [], example: null },
            quality: { css: null, xpath: null, fallbacks: [], example: null },
            views: { css: null, xpath: null, fallbacks: [], example: null },
            likes: { css: null, xpath: null, fallbacks: [], example: null },
            date: { css: null, xpath: null, fallbacks: [], example: null },
        },
        sampleCards: []
    };

    const cSels = ['.video-item', '.video-card', '.thumb-item', '.thumb', '.video-thumb', '.video_block', '.video-block', '.item', '.video', '.clip', '.gallery-item', 'article', '.post', '.list-item', '.grid-item', '[data-video-id]', '[data-id]', '.card'];
    let cards = [], uS = '';
    for (const s of cSels) { try { const f = doc.querySelectorAll(s); if (f.length >= 2 && Array.from(f).some(e => e.querySelector('a[href]')) && Array.from(f).some(e => e.querySelector('img'))) { cards = Array.from(f); uS = s; break; } } catch {} }
    if (!cards.length) { const p = []; doc.querySelectorAll('div,li,article').forEach(d => { if (d.querySelectorAll(':scope>img,:scope>a>img,:scope>div>img').length >= 1 && d.querySelectorAll(':scope>a[href]').length >= 1 && d.querySelectorAll('a[href]').length < 10) p.push(d); }); if (p.length >= 3) { cards = p; uS = 'auto'; } }
    if (!cards.length) return r;
    r.found = true; r.cardSelector = uS; r.totalCardsFound = cards.length;
    r.cardXPath = genXPath(cards[0]);

    const titleSels = ['h1','h2','h3','h4','h5','.title','.name','.video-title','a[title]','[class*="title"]','[class*="name"]','strong','b'];
    const durSels = ['.duration','.time','.video-time','[class*="duration"]','[class*="time"]','[class*="length"]','time'];
    const qualSels = ['.quality','.hd','[class*="quality"]','[class*="hd"]','[class*="resolution"]'];
    const viewSels = ['.views','.count','.video-views','[class*="view"]','[class*="watch"]','[class*="seen"]','.stats'];
    const likeSels = ['.likes','.rating','.video-rating','[class*="like"]','[class*="rate"]','[class*="thumb"]','[class*="favorite"]'];
    const dateSels = ['.date','.added','.video-added','[class*="date"]','[class*="added"]','[class*="ago"]','[class*="time-ago"]','time[datetime]'];
    const imgAttrs = ['data-src', 'data-original', 'data-lazy-src', 'data-thumb', 'src'];

    for (let i = 0; i < Math.min(8, cards.length); i++) {
        const card = cards[i], cd = {};

        // === TITLE ===
        const tFB = [];
        for (const ts of titleSels) {
            try {
                const el = card.querySelector(ts);
                if (el) {
                    const t = ts === 'a[title]' ? (el.getAttribute('title') || '') : el.textContent.trim();
                    if (t.length > 2 && t.length < 300) {
                        tFB.push({ css: `${uS} ${ts}`, xpath: shortXP(el), example: t.substring(0, 80), source: 'text' });
                        if (!cd.title) cd.title = t;
                    }
                }
            } catch {}
        }
        // img alt as name fallback
        const imgAlt = card.querySelector('img[alt]');
        if (imgAlt) {
            const alt = imgAlt.getAttribute('alt') || '';
            if (alt.length > 3 && alt.length < 200) {
                tFB.push({ css: `${uS} img[alt]`, xpath: shortXP(imgAlt), example: alt.substring(0, 80), source: 'img-alt', attr: 'alt' });
                if (!cd.title) cd.title = alt;
            }
        }
        if (i === 0 && tFB.length) { r.structure.title.css = tFB[0].css; r.structure.title.xpath = tFB[0].xpath; r.structure.title.example = tFB[0].example; r.structure.title.fallbacks = tFB.slice(1); }

        // === LINK ===
        const lk = card.querySelector('a[href]');
        if (lk) {
            cd.link = resolve(lk.getAttribute('href'), base);
            if (i === 0) {
                r.structure.link.css = `${uS} a[href]`; r.structure.link.xpath = shortXP(lk); r.structure.link.example = cd.link;
                try { r.structure.link.pattern = new URL(cd.link).pathname.replace(/\/\d+\//g, '/{id}/').replace(/\/\d+$/, '/{id}').replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/'); } catch {}
                const ols = card.querySelectorAll('a[href]');
                if (ols.length > 1) r.structure.link.fallbacks = Array.from(ols).slice(1, 4).map(a => ({ css: `${uS} a[href]`, xpath: shortXP(a) }));
            }
            // Slug name
            const slug = extractSlugName(cd.link);
            if (slug && !cd.title) cd.title = slug;
            if (slug) cd.slugName = slug;
        }

        // === THUMBNAIL ===
        const allImgs = card.querySelectorAll('img');
        const thFB = [];
        allImgs.forEach(img => {
            for (const at of imgAttrs) {
                const sv = img.getAttribute(at);
                if (sv && !sv.startsWith('data:') && sv.length > 5) {
                    thFB.push({ css: `${uS} img`, xpath: shortXP(img), attr: at, example: resolve(sv, base) });
                    if (!cd.thumbnail) cd.thumbnail = resolve(sv, base);
                    break;
                }
            }
        });
        if (i === 0 && thFB.length) { r.structure.thumbnail.css = thFB[0].css; r.structure.thumbnail.xpath = thFB[0].xpath; r.structure.thumbnail.attribute = thFB[0].attr; r.structure.thumbnail.example = thFB[0].example; r.structure.thumbnail.fallbacks = thFB.slice(1); }

        // === DURATION ===
        const dFB = [];
        for (const ds of durSels) {
            try {
                const el = card.querySelector(ds);
                if (el) {
                    let t = el.textContent.trim();
                    // <time datetime="PT5M30S"> support
                    if (el.tagName === 'TIME' && el.getAttribute('datetime')) {
                        const dt = el.getAttribute('datetime');
                        const ptm = dt.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
                        if (ptm) t = [ptm[1] || '', ptm[2] || '0', (ptm[3] || '0').padStart(2, '0')].filter(Boolean).join(':');
                    }
                    if (/\d{1,2}:\d{2}/.test(t)) {
                        dFB.push({ css: `${uS} ${ds}`, xpath: shortXP(el), example: t });
                        if (!cd.duration) cd.duration = t;
                    }
                }
            } catch {}
        }
        if (!cd.duration) { for (const el of card.querySelectorAll('span,div,small,em')) { const t = el.textContent.trim(); if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) { cd.duration = t; dFB.push({ css: `${uS} ${el.tagName.toLowerCase()}`, xpath: shortXP(el), example: t }); break; } } }
        if (i === 0 && dFB.length) { r.structure.duration.css = dFB[0].css; r.structure.duration.xpath = dFB[0].xpath; r.structure.duration.example = dFB[0].example; r.structure.duration.fallbacks = dFB.slice(1); }

        // === QUALITY ===
        const qFB = [];
        for (const qs of qualSels) { try { const el = card.querySelector(qs); if (el) { const t = el.textContent.trim(); if (/\b(HD|FHD|4K|1080|720|SD)\b/i.test(t)) { qFB.push({ css: `${uS} ${qs}`, xpath: shortXP(el), example: t }); if (!cd.quality) cd.quality = t; } } } catch {} }
        if (i === 0 && qFB.length) { r.structure.quality.css = qFB[0].css; r.structure.quality.xpath = qFB[0].xpath; r.structure.quality.example = qFB[0].example; r.structure.quality.fallbacks = qFB.slice(1); }

        // === VIEWS ===
        const vFB = [];
        for (const vs of viewSels) {
            try {
                const el = card.querySelector(vs);
                if (el) {
                    const t = el.textContent.trim();
                    if (/[\d,.]+/.test(t) && t.length < 30) {
                        const numMatch = t.match(/([\d,.]+\s*[KkMm]?)\s*(views?|просмотр|раз|hits?)?/i);
                        if (numMatch) { vFB.push({ css: `${uS} ${vs}`, xpath: shortXP(el), example: numMatch[0].trim() }); if (!cd.views) cd.views = numMatch[0].trim(); }
                    }
                }
            } catch {}
        }
        // data-views attribute
        if (!cd.views) { const dvEl = card.querySelector('[data-views]'); if (dvEl) { cd.views = dvEl.getAttribute('data-views'); vFB.push({ css: `${uS} [data-views]`, xpath: shortXP(dvEl), example: cd.views, attr: 'data-views' }); } }
        if (i === 0 && vFB.length) { r.structure.views.css = vFB[0].css; r.structure.views.xpath = vFB[0].xpath; r.structure.views.example = vFB[0].example; r.structure.views.fallbacks = vFB.slice(1); }

        // === LIKES / RATING ===
        const lFB = [];
        for (const ls of likeSels) {
            try {
                const el = card.querySelector(ls);
                if (el) {
                    const t = el.textContent.trim();
                    if (/[\d,.%]+/.test(t) && t.length < 30) {
                        lFB.push({ css: `${uS} ${ls}`, xpath: shortXP(el), example: t });
                        if (!cd.likes) cd.likes = t;
                    }
                }
            } catch {}
        }
        if (!cd.likes) { for (const attr of ['data-likes', 'data-rating', 'data-score']) { const el = card.querySelector(`[${attr}]`); if (el) { cd.likes = el.getAttribute(attr); lFB.push({ css: `${uS} [${attr}]`, xpath: shortXP(el), example: cd.likes, attr }); break; } } }
        if (i === 0 && lFB.length) { r.structure.likes.css = lFB[0].css; r.structure.likes.xpath = lFB[0].xpath; r.structure.likes.example = lFB[0].example; r.structure.likes.fallbacks = lFB.slice(1); }

        // === DATE ===
        const dtFB = [];
        for (const ds of dateSels) {
            try {
                const el = card.querySelector(ds);
                if (el) {
                    let t = el.textContent.trim();
                    // <time datetime="...">
                    if (el.tagName === 'TIME' && el.getAttribute('datetime') && !/PT\d/.test(el.getAttribute('datetime'))) {
                        t = el.getAttribute('datetime');
                    }
                    if (t.length > 2 && t.length < 50 && (/\d/.test(t))) {
                        dtFB.push({ css: `${uS} ${ds}`, xpath: shortXP(el), example: t });
                        if (!cd.date) cd.date = t;
                    }
                }
            } catch {}
        }
        // Regex fallback for relative dates
        if (!cd.date) {
            for (const el of card.querySelectorAll('span,div,small,em,time')) {
                const t = el.textContent.trim();
                if (/^\d+\s*(дн|час|мин|сек|ago|day|hour|min|week|month|year|назад)/i.test(t) || /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(t)) {
                    cd.date = t; dtFB.push({ css: `${uS} ${el.tagName.toLowerCase()}`, xpath: shortXP(el), example: t }); break;
                }
            }
        }
        if (i === 0 && dtFB.length) { r.structure.date.css = dtFB[0].css; r.structure.date.xpath = dtFB[0].xpath; r.structure.date.example = dtFB[0].example; r.structure.date.fallbacks = dtFB.slice(1); }

        r.sampleCards.push(cd);
    }
    return r;
}

// ================================================================
// VIDEO PAGE
// ================================================================
async function aVidPage(url, base) {
    const r = { analyzed: false, videoUrl: url, urlStructure: { pattern: null }, videoSources: { found: false, sources: [], methods: [] }, relatedVideos: { found: false } };
    if (!url) return r;
    try {
        setStatus('📥 Видео...', 'loading'); setProgress(82, 'Видео...');
        const html = await fetchPage(url); const doc = parseH(html); r.analyzed = true;
        try { r.urlStructure.pattern = new URL(url).pathname.replace(/\/\d+\//g, '/{id}/').replace(/\/\d+$/, '/{id}').replace(/\/[a-z0-9_-]{10,}\/?$/i, '/{slug}/'); } catch {}
        r.pageTitle = doc.title; const h1 = doc.querySelector('h1'); if (h1) r.videoTitle = h1.textContent.trim();
        doc.querySelectorAll('video, video source').forEach(v => { const s = v.getAttribute('src') || v.getAttribute('data-src'); if (s) { r.videoSources.sources.push({ type: s.includes('.m3u8') ? 'HLS' : s.includes('.mp4') ? 'MP4' : '?', url: resolve(s, base), foundIn: '<video>', attr: v.hasAttribute('data-src') ? 'data-src' : 'src', quality: v.getAttribute('label') || v.getAttribute('res') || null }); r.videoSources.found = true; r.videoSources.methods.push('video_tag'); } });
        const asc = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
        for (const p of [/["'](?:file|src|source|video_url|mp4|hls)["']\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8|webm)[^"']*?)["']/gi, /(?:https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8|webm)(?:\?[^\s"'<>]*)?)/gi]) {
            let m; while ((m = p.exec(asc))) { const u = (m[1] || m[0]).replace(/\\/g, ''); if (/\.(mp4|m3u8|webm)/.test(u)) { const tok = /(?:token|expires|hash|sign)=/i.test(u); r.videoSources.sources.push({ type: u.includes('.m3u8') ? 'HLS' : u.includes('.mp4') ? 'MP4' : 'WebM', url: u, foundIn: 'JS', tokenized: tok }); r.videoSources.found = true; r.videoSources.methods.push('javascript'); } } p.lastIndex = 0;
        }
        doc.querySelectorAll('meta[property="og:video"],meta[property="og:video:url"]').forEach(m => { const u = m.getAttribute('content'); if (u) { r.videoSources.sources.push({ type: u.includes('.m3u8') ? 'HLS' : 'MP4', url: resolve(u, base), foundIn: 'og:meta' }); r.videoSources.found = true; r.videoSources.methods.push('meta_tag'); } });
        const ifs = []; doc.querySelectorAll('iframe[src],iframe[data-src]').forEach(f => { const s = f.getAttribute('src') || f.getAttribute('data-src'); if (s && (s.includes('player') || s.includes('embed') || s.includes('video'))) ifs.push({ src: resolve(s, base), attr: f.hasAttribute('data-src') ? 'data-src' : 'src' }); });
        if (ifs.length) { r.videoSources.playerIframes = ifs; r.videoSources.methods.push('iframe'); }
        const we = await extractVW(url); if (we) { r.videoSources.sources.push({ type: we.includes('.m3u8') ? 'HLS' : 'MP4', url: we, foundIn: 'Worker✦' }); r.videoSources.found = true; r.videoSources.methods.push('worker_extract'); }
        const ob = aObf(html); if (ob.base64Urls.length) { ob.base64Urls.forEach(b => { r.videoSources.sources.push({ type: b.type, url: b.dec, foundIn: 'Base64', base64: true }); }); r.videoSources.found = true; r.videoSources.methods.push('base64'); }
        if (!r.videoSources.found) { for (const p of [/["'](https?:\/\/[^"']+\.mp4[^"']*)['"]/i, /["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/i]) { const m = html.match(p); if (m?.[1]) { r.videoSources.sources.push({ type: m[1].includes('.m3u8') ? 'HLS' : 'MP4', url: m[1], foundIn: 'pattern' }); r.videoSources.found = true; r.videoSources.methods.push('pattern'); break; } } }
        const ss = new Set(); r.videoSources.sources = r.videoSources.sources.filter(s => { if (ss.has(s.url)) return false; ss.add(s.url); return true; }); r.videoSources.methods = uniq(r.videoSources.methods);
        r.obfuscation = ob;
        for (const sel of ['.related', '.related-videos', '.similar', '.recommended', '#related', '[class*="related"]']) { try { const el = doc.querySelector(sel); if (el) { const rl = el.querySelectorAll('a[href]'); if (rl.length) { r.relatedVideos = { found: true, selector: sel, count: rl.length, sampleLinks: Array.from(rl).slice(0, 5).map(a => ({ text: a.textContent.trim().substring(0, 80), href: resolve(a.getAttribute('href'), base) })) }; break; } } } catch {} }
    } catch (e) { r.error = isCE(e) ? '🛡️ CORS' : e.message; }
    return r;
}

// -- Meta --
function aMeta(doc) { const m = { title: doc.title }; const d = doc.querySelector('meta[name="description"]'); if (d) m.description = d.getAttribute('content'); const ot = doc.querySelector('meta[property="og:title"]'); if (ot) m.ogTitle = ot.getAttribute('content'); const l = doc.documentElement.getAttribute('lang'); if (l) m.language = l; return m; }

// ================================================================
// ARCHITECTURE SYNTHESIS
// ================================================================
function synth(doc, html, vc, vp, enc, pag, srch, sc, prot, fw, api, dom, jsd, obf) {
    let st = 'A', lb = 'Статический HTML', ds = 'Все данные в HTML';
    const empty = dom.totalElements < 100, spa = fw.some(f => ['React', 'Vue.js', 'Angular', 'Next.js', 'Nuxt.js'].includes(f));
    const hasApi = api.endpoints.length > 0 || api.stateVars.length > 0;
    const hls = vp?.videoSources?.sources?.some(s => (s.type || '').includes('HLS'));
    const ifr = vp?.videoSources?.playerIframes?.length > 0;
    if (empty && spa) { st = 'C'; lb = 'Dynamic JS (SPA)'; ds = 'Headless или реверс API'; }
    else if (!empty && hasApi && !vc?.found) { st = 'B'; lb = 'JSON API'; ds = 'API sniffing'; }
    else if (hls && !vc?.found) { st = 'D'; lb = 'Стриминг'; ds = 'Stream extractor'; }
    else if (vc?.found && (ifr || spa || hasApi)) { st = 'E'; lb = 'Гибрид'; ds = 'HTML каталог + JS плеер'; }

    let cx = 1.0; const cf = [];
    if (vc?.found) { cx -= .5; cf.push({ t: 'Карточки в HTML', e: -.5 }); } else { cx += 1.5; cf.push({ t: 'Нет карточек', e: 1.5 }); }
    if (vp?.videoSources?.found) { const mt = vp.videoSources.methods || []; if (mt.includes('video_tag')) { cf.push({ t: '<video>', e: -.3 }); cx -= .3; } else if (mt.includes('javascript')) { cf.push({ t: 'JS', e: .3 }); cx += .3; } else if (mt.includes('base64')) { cf.push({ t: 'Base64', e: .8 }); cx += .8; } } else { cx += 1; cf.push({ t: 'Нет видео', e: 1 }); }
    if (ifr) { cx += .5; cf.push({ t: 'iframe', e: .5 }); }
    if (empty) { cx += 1.5; cf.push({ t: 'Пустой DOM', e: 1.5 }); }
    if (spa) { cx += .5; cf.push({ t: 'SPA', e: .5 }); }
    if (prot.cloudflare) { cx += 1; cf.push({ t: 'Cloudflare', e: 1 }); }
    if (prot.ddosGuard) { cx += .8; cf.push({ t: 'DDoS-Guard', e: .8 }); }
    if (prot.recaptcha) { cx += 1; cf.push({ t: 'CAPTCHA', e: 1 }); }
    if (obf?.base64Urls?.length) { cx += .5; cf.push({ t: 'Base64 obf', e: .5 }); }
    if (prot.ageGate?.type && prot.ageGate.type !== 'css-overlay') { cx += .5; cf.push({ t: 'Age gate', e: .5 }); }
    const lvl = Math.max(1, Math.min(5, Math.round(cx)));
    const ll = { 1: 'Элементарно', 2: 'Просто', 3: 'Средне', 4: 'Сложно', 5: 'Очень сложно' };
    let rm = 'CSS + XPath', rt = 'Cheerio/BS4', rtr = 'Прокси', rn = [];
    if (st === 'B') { rm = 'API sniffing'; rt = 'requests+JSON'; rn.push('DevTools → Network'); }
    else if (st === 'C') { rm = 'Headless'; rt = 'Puppeteer/Playwright'; rtr = 'Headless Chrome'; }
    else if (st === 'D') { rm = 'Stream extract'; rt = 'yt-dlp/ffmpeg'; }
    else if (st === 'E') { rm = 'CSS + JS regex'; rt = 'Cheerio + regex'; if (ifr) rn.push('iframe → доп. запрос'); }
    if (prot.cloudflare || prot.ddosGuard) { rtr = 'Worker / stealth'; rn.push('Анти-DDoS'); }
    if (jsd.jsRequired === 'yes') rn.push('Каталог требует JS');
    return { siteType: st, siteTypeLabel: lb, siteTypeDesc: ds, complexity: lvl, complexityLabel: ll[lvl], complexityFactors: cf, recommendation: { method: rm, tools: rt, transport: rtr, notes: rn }, frameworks: fw, apiEndpoints: api.endpoints, stateVars: api.stateVars, protection: prot, domInfo: dom, jsDependency: jsd, obfuscation: obf, headersUsed: { 'User-Agent': getUA() } };
}

// ================================================================
// MAIN
// ================================================================
async function runFullAnalysis() {
    const ui = $('targetUrl'), targetUrl = (ui?.value.trim() || '') || DEFAULT_TARGET_URL;
    if (!targetUrl) { setStatus('❌ URL!', 'error'); return; }
    try { new URL(targetUrl); } catch { setStatus('❌ Bad URL', 'error'); return; }
    if (ui) ui.value = targetUrl;
    const base = baseOf(targetUrl), w = getW();
    const btn = $('btnAnalyze'); if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
    $('results').style.display = 'none'; updCI('hidden'); updW(!!w); transportLog = [];
    const pb = $('progress-bar'); if (pb) pb.classList.remove('cors-error', 'warning', 'worker');
    analysisResult = { _meta: { analyzedUrl: targetUrl, baseUrl: base, analyzedAt: new Date().toISOString(), workerUsed: w || 'нет', userAgent: getUA(), tool: 'v3.2' } };
    try {
        setStatus('📥 ...', 'loading'); setProgress(10, '📡');
        let html; try { html = await fetchPage(targetUrl); } catch (e) { setProgress(10, '❌', 'cors-error'); setStatus('❌ ' + e.message, 'error'); analysisResult._error = { type: isCE(e) ? 'CORS' : 'FETCH', message: e.message }; analysisResult._transportLog = transportLog; displayResults(analysisResult); return; }
        const doc = parseH(html); setProgress(20, (html.length / 1024).toFixed(0) + 'KB');
        setProgress(22, 'DOM'); const dom = aDom(doc);
        setProgress(25, 'Enc'); analysisResult.encoding = aEnc(doc, html);
        setProgress(27, 'Meta'); analysisResult.meta = aMeta(doc);
        setProgress(30, 'FW'); const fw = aFW(doc, html);
        setProgress(34, 'API'); const api = aAPI(doc, html);
        setProgress(38, 'Prot'); const prot = aProt(doc, html);
        setProgress(40, 'Obf'); const obf = aObf(html);
        setProgress(44, 'Pag'); analysisResult.pagination = aPag(doc, base, targetUrl);
        setProgress(48, 'Search'); analysisResult.search = aSrch(doc, base);
        setProgress(52, 'Sort/Cat'); analysisResult.sortCat = aSC(doc, base);
        setProgress(58, 'Query params'); analysisResult.queryParams = aQueryParams(doc, base);
        setProgress(65, 'Cards'); analysisResult.videoCards = aCards(doc, base);
        setProgress(72, 'JS dep'); const jsd = aJSDep(doc, html, analysisResult.videoCards.found, fw);
        setProgress(78, 'Video page');
        const svUrl = analysisResult.videoCards.sampleCards?.[0]?.link;
        analysisResult.videoPage = svUrl ? await aVidPage(svUrl, base) : { analyzed: false };
        setProgress(90, 'Synth');
        analysisResult.architecture = synth(doc, html, analysisResult.videoCards, analysisResult.videoPage, analysisResult.encoding, analysisResult.pagination, analysisResult.search, analysisResult.sortCat, prot, fw, api, dom, jsd, obf);
        analysisResult._summary = {
            siteType: analysisResult.architecture.siteType, siteTypeLabel: analysisResult.architecture.siteTypeLabel,
            complexity: analysisResult.architecture.complexity, complexityLabel: analysisResult.architecture.complexityLabel,
            jsRequired: jsd.jsRequired, encoding: analysisResult.encoding.charset,
            hasPagination: analysisResult.pagination.pagination.found, paginationPattern: analysisResult.pagination.pagination.pattern,
            hasSearch: analysisResult.search.found, hasSorting: analysisResult.sortCat.sorting.found,
            hasCategories: analysisResult.sortCat.categories.found, categoriesCount: analysisResult.sortCat.categories.totalCount || 0,
            videoCardsFound: analysisResult.videoCards.totalCardsFound,
            fieldsFound: Object.entries(analysisResult.videoCards.structure).filter(([_, v]) => v.css).map(([k]) => k),
            videoSourceFound: analysisResult.videoPage.videoSources?.found || false,
            videoSourceMethods: analysisResult.videoPage.videoSources?.methods || [],
            frameworks: fw, queryParamsCount: analysisResult.queryParams?.length || 0,
            protection: { cloudflare: prot.cloudflare, ddosGuard: prot.ddosGuard, recaptcha: prot.recaptcha, ageGate: !!prot.ageGate?.detected },
            obfuscation: (obf.base64Urls.length + obf.obfPatterns.length) > 0,
        };
        analysisResult._transportLog = transportLog;
        displayResults(analysisResult); setProgress(100, '✅'); setStatus('✅ Готово!', 'success');
    } catch (e) { setStatus('❌ ' + e.message, 'error'); analysisResult._transportLog = transportLog; displayResults(analysisResult); }
    finally { if (btn) { btn.disabled = false; btn.textContent = '🚀 Полный анализ'; } }
}

// ================================================================
// DISPLAY
// ================================================================
function displayResults(d) {
    $('results').style.display = 'block';
    const j = JSON.stringify(d, null, 2);
    $('jsonFormatted').innerHTML = synHL(j); $('jsonRaw').value = j;
    $('visualReport').innerHTML = genVis(d); $('archReport').innerHTML = genArch(d);
    $('btnCopyJson').disabled = false; $('btnCopyArch').disabled = false;
}

// ================================================================
// ARCHITECTURE TAB
// ================================================================
function genArch(d) {
    if (!d.architecture) return d._error ? genCors(d) : '<p style="color:#555">Нет данных</p>';
    const a = d.architecture, l = a.complexity, lc = ['', 'level-1-color', 'level-2-color', 'level-3-color', 'level-4-color', 'level-5-color'][l];
    let h = '';

    // Diagnosis
    h += `<div class="arch-diagnosis"><div class="arch-diagnosis-main level-${l}">
        <span class="arch-type-badge arch-type-${a.siteType}">Тип ${a.siteType}</span>
        <div class="arch-site-type">${esc(a.siteTypeLabel)}</div><div class="arch-site-desc">${esc(a.siteTypeDesc)}</div>
        <table style="font-size:12px;color:#aaa;width:100%;margin-top:10px;border-collapse:collapse"><tr><th style="text-align:left;padding:3px 6px;color:#666;border-bottom:1px solid #222">Фактор</th><th style="text-align:right;padding:3px 6px;color:#666;border-bottom:1px solid #222">Вес</th></tr>
        ${a.complexityFactors.map(f => `<tr><td style="padding:2px 6px">${esc(f.t)}</td><td style="text-align:right;color:${f.e > 0 ? '#ff6666' : '#66ff66'}">${f.e > 0 ? '+' : ''}${f.e}</td></tr>`).join('')}</table>
    </div><div class="arch-complexity"><div class="complexity-gauge"><span class="complexity-number ${lc}">${l}/5</span></div><div class="complexity-label ${lc}">${esc(a.complexityLabel)}</div><div class="complexity-sublabel">Сложность</div></div></div>`;

    // JS verdict
    const js = a.jsDependency; if (js) {
        const vc = js.jsRequired === 'yes' ? 'js-verdict-yes' : js.jsRequired === 'partial' ? 'js-verdict-partial' : 'js-verdict-no';
        h += `<div class="arch-js-verdict"><h4 class="${vc}">🔧 JS: ${js.jsRequired === 'yes' ? '❌ Требуется' : js.jsRequired === 'partial' ? '⚠️ Частично' : '✅ Не нужен'}</h4>
        <p>Каталог: ${js.catalog === 'yes' ? '❌ JS' : js.catalog === 'partial' ? '⚠️ Частично' : '✅ HTML'} | Плеер: ${js.player === 'yes' ? '⚠️ JS' : '✅ Direct'}</p>
        ${js.evidence.length ? '<ul style="margin-top:6px;padding-left:18px">' + js.evidence.map(e => `<li style="font-size:12px;color:#777">${esc(e)}</li>`).join('') + '</ul>' : ''}</div>`;
    }

    // Recommendations
    const rc = a.recommendation;
    h += `<div class="arch-block"><h3 class="warn-title">🔧 Рекомендуемый стек</h3><div class="arch-rec-grid">
        <span class="arch-rec-label">📦 Метод:</span><span class="arch-rec-value"><code>${esc(rc.method)}</code></span>
        <span class="arch-rec-label">🛠 Инструменты:</span><span class="arch-rec-value"><code>${esc(rc.tools)}</code></span>
        <span class="arch-rec-label">🔗 Транспорт:</span><span class="arch-rec-value">${esc(rc.transport)}</span>
        <span class="arch-rec-label">📡 UA:</span><span class="arch-rec-value"><code style="font-size:10px">${esc((a.headersUsed?.['User-Agent'] || '').substring(0, 70))}</code></span>
        ${rc.notes.map(n => `<span class="arch-rec-label">⚠️</span><span class="arch-rec-value warn">${esc(n)}</span>`).join('')}
    </div></div>`;

    // Selectors table
    const vc2 = d.videoCards; if (vc2?.found) {
        h += `<div class="arch-block"><h3>🎯 Селекторы (${vc2.totalCardsFound} карточек)</h3><table class="sel-table"><tr><th>Поле</th><th>CSS primary</th><th>XPath</th><th>Fallbacks</th><th>Пример</th></tr>`;
        const mkRow = (name, field, extra) => {
            const fbs = (field.fallbacks || []).map(f => `<code class="fb">${esc(f.css || f.attr || '')}</code>`).join(' ');
            return `<tr><td><strong>${name}</strong></td><td><code>${esc(field.css || '—')}</code></td><td><code class="xp">${esc(field.xpath || '—')}</code></td><td>${fbs || '—'}</td><td style="font-size:11px;color:#888;max-width:180px;overflow:hidden;text-overflow:ellipsis">${esc((extra || field.example || '').substring(0, 55))}</td></tr>`;
        };
        const st = vc2.structure;
        h += `<tr><td><strong>📦 Card</strong></td><td><code>${esc(vc2.cardSelector)}</code></td><td><code class="xp">${esc(vc2.cardXPath || '—')}</code></td><td>—</td><td>${vc2.totalCardsFound}</td></tr>`;
        h += mkRow('📌 Title', st.title);
        h += mkRow('🔗 Link', st.link, st.link.pattern);
        h += mkRow('🖼 Thumb', st.thumbnail, st.thumbnail.attribute ? 'attr:' + st.thumbnail.attribute : '');
        h += mkRow('⏱ Duration', st.duration);
        h += mkRow('📺 Quality', st.quality);
        h += mkRow('👁 Views', st.views);
        h += mkRow('👍 Likes', st.likes);
        h += mkRow('📅 Date', st.date);
        h += '</table></div>';
    }

    // Video sources
    if (d.videoPage?.videoSources?.sources?.length) {
        h += '<div class="arch-block"><h3>🎬 Видео-источники</h3>';
        d.videoPage.videoSources.sources.forEach(s => {
            h += `<div class="video-url-item"><code>${esc(s.url)}</code><div class="video-url-meta">
                <span class="vtag ${(s.type || '').includes('HLS') ? 'hls' : 'mp4'}">${esc(s.type)}</span>
                <span class="vtag mth">${esc(s.foundIn)}</span>
                ${s.tokenized ? '<span class="vtag tok">⏰ Token</span>' : ''}${s.base64 ? '<span class="vtag b64">🔐 Base64</span>' : ''}
                ${s.attr ? `<span class="vtag mth">${esc(s.attr)}</span>` : ''}${s.quality ? `<span class="vtag mth">${esc(s.quality)}</span>` : ''}
            </div></div>`;
        }); h += '</div>';
    }

    // Query Params
    if (d.queryParams?.length) {
        h += `<div class="arch-block"><h3>🔎 Query-параметры со страницы (${d.queryParams.length})</h3><table class="qp-table"><tr><th>Параметр</th><th>Тип</th><th>Значения</th><th>#</th></tr>`;
        d.queryParams.forEach(p => { h += `<tr><td><code>${esc(p.param)}</code></td><td><span class="tag">${esc(p.category)}</span></td><td style="font-size:11px;color:#888">${p.values.slice(0, 5).map(v => esc(v)).join(', ')}</td><td>${p.occurrences}</td></tr>`; });
        h += '</table></div>';
    }

    // Checklist
    const sm = d._summary || {};
    const checks = [
        { i: '📄', l: 'Каталог', v: vc2?.found ? `✅ ${vc2.totalCardsFound}` : '❌', c: vc2?.found ? 'ok' : 'fail' },
        { i: '🗂', l: 'Полей найдено', v: sm.fieldsFound?.length ? `✅ ${sm.fieldsFound.join(', ')}` : '❌', c: sm.fieldsFound?.length ? 'ok' : 'fail' },
        { i: '📑', l: 'Пагинация', v: sm.hasPagination ? `✅ ${sm.paginationPattern}` : '❌', c: sm.hasPagination ? 'ok' : 'fail' },
        { i: '🔍', l: 'Поиск', v: sm.hasSearch ? '✅' : '❌', c: sm.hasSearch ? 'ok' : 'fail' },
        { i: '📁', l: 'Категории', v: sm.hasCategories ? `✅ ${sm.categoriesCount}` : '❌', c: sm.hasCategories ? 'ok' : 'fail' },
        { i: '▶️', l: 'Видео', v: sm.videoSourceFound ? `✅ ${sm.videoSourceMethods.join(',')}` : '❌', c: sm.videoSourceFound ? 'ok' : 'fail' },
        { i: '🔐', l: 'Обфускация', v: sm.obfuscation ? '⚠️' : '—', c: sm.obfuscation ? 'warn' : 'neutral' },
        { i: '🔎', l: 'Query params', v: sm.queryParamsCount ? `${sm.queryParamsCount}` : '—', c: sm.queryParamsCount ? 'ok' : 'neutral' },
        { i: '📊', l: 'DOM', v: a.domInfo?.totalElements || '?', c: (a.domInfo?.totalElements || 0) < 100 ? 'warn' : 'ok' },
        { i: '🛡️', l: 'Cloudflare', v: a.protection?.cloudflare ? '⚠️' : '—', c: a.protection?.cloudflare ? 'warn' : 'neutral' },
        { i: '🤖', l: 'CAPTCHA', v: a.protection?.recaptcha ? '❌' : '—', c: a.protection?.recaptcha ? 'fail' : 'neutral' },
        { i: '🍪', l: 'Cookies', v: a.protection?.cookies?.length ? `⚠️ ${a.protection.cookies.length}` : '—', c: a.protection?.cookies?.length ? 'warn' : 'neutral' },
    ];
    h += '<div class="arch-block"><h3>✅ Чеклист</h3><div class="arch-checklist-grid">';
    checks.forEach(c => { h += `<div class="arch-check-item"><span class="arch-check-icon">${c.i}</span><span class="arch-check-label">${esc(c.l)}</span><span class="arch-check-value ${c.c}">${c.v}</span></div>`; });
    h += '</div></div>';

    // Age gate
    if (a.protection?.ageGate?.detected) { const ag = a.protection.ageGate; h += `<div class="arch-age-gate"><h4>🔞 Age gate <span class="gate-type ${ag.type}">${esc(ag.type)}</span></h4><p>${ag.impact === 'low' ? '🟢' : '🟡'} ${esc(ag.note)}</p></div>`; }

    // Details grid
    h += '<div class="arch-details">';
    h += `<div class="arch-detail-card"><h4>⚙️ Фреймворки</h4>${a.frameworks?.length ? '<ul>' + a.frameworks.map(f => `<li><code>${esc(f)}</code></li>`).join('') + '</ul>' : '<p class="arch-detail-empty">—</p>'}</div>`;
    h += `<div class="arch-detail-card"><h4>🔌 API / State</h4>${(a.apiEndpoints?.length || a.stateVars?.length) ? '<ul>' + (a.stateVars || []).map(v => `<li>🗂 <code>${esc(v)}</code></li>`).join('') + (a.apiEndpoints || []).map(e => `<li>🔗 <code>${esc(e)}</code></li>`).join('') + '</ul>' : '<p class="arch-detail-empty">Данные в HTML</p>'}</div>`;
    h += `<div class="arch-detail-card"><h4>📊 DOM</h4><ul><li>Элементов: <code>${a.domInfo?.totalElements || 0}</code></li><li>Scripts: <code>${a.domInfo?.scripts || 0}</code> (${((a.domInfo?.inlineScriptSize || 0) / 1024).toFixed(1)}KB)</li><li>Img: <code>${a.domInfo?.images || 0}</code> Links: <code>${a.domInfo?.links || 0}</code></li><li>iframe: <code>${a.domInfo?.iframes || 0}</code> Forms: <code>${a.domInfo?.forms || 0}</code></li></ul></div>`;
    if (a.protection?.cookies?.length) h += `<div class="arch-detail-card"><h4>🍪 JS Cookies</h4><ul>${a.protection.cookies.map(c => `<li><code>${esc(c)}</code></li>`).join('')}</ul></div>`;
    h += '</div>';

    // Sample cards
    if (d.videoCards?.sampleCards?.length) {
        h += `<div class="arch-block"><h3>📑 Примеры (${d.videoCards.sampleCards.length})</h3>`;
        d.videoCards.sampleCards.forEach((c, i) => {
            h += `<div style="margin-bottom:10px;padding:8px;background:#0f0f23;border-radius:6px;font-size:12px"><strong style="color:#00d4ff">#${i + 1}</strong> `;
            if (c.title) h += `📌${esc(c.title.substring(0, 60))} `;
            if (c.duration) h += `⏱${esc(c.duration)} `;
            if (c.quality) h += `📺${esc(c.quality)} `;
            if (c.views) h += `👁${esc(c.views)} `;
            if (c.likes) h += `👍${esc(c.likes)} `;
            if (c.date) h += `📅${esc(c.date)} `;
            if (c.slugName) h += `<span style="color:#555">slug:${esc(c.slugName.substring(0, 30))}</span>`;
            h += '</div>';
        });
        h += '</div>';
    }

    // Transport log
    if (d._transportLog?.length) { h += `<div class="arch-block"><h3>🔌 Транспорт</h3><div class="transport-log">`; d._transportLog.forEach(e => { h += `<div class="transport-log-entry ${e.type}">[${e.time}] ${esc(e.message)}</div>`; }); h += '</div></div>'; }
    return h;
}

function genCors(d) { return `<div class="report-section cors-error-section"><div class="report-section-header">🛡️ Ошибка</div><div class="report-section-body"><div class="report-item"><span class="report-label">Тип:</span><span class="report-value error">${esc(d._error?.type)}</span></div><div class="report-item"><span class="report-label">Info:</span><span class="report-value error">${esc(d._error?.message)}</span></div><div class="cors-help-box"><h4>💡</h4><ol><li>Worker</li><li>Авто</li><li><a href="https://github.com/Rob--W/cors-anywhere" target="_blank">cors-anywhere</a></li></ol></div></div></div>`; }

// ================================================================
// VISUAL
// ================================================================
function genVis(d) {
    let h = ''; if (d._error) h += genCors(d);
    if (d._summary) {
        const s = d._summary;
        h += `<div class="report-section"><div class="report-section-header">📋 Сводка</div><div class="report-section-body">
        <div class="report-item"><span class="report-label">URL:</span><span class="report-value">${esc(d._meta.analyzedUrl)}</span></div>
        <div class="report-item"><span class="report-label">Тип:</span><span class="report-value">${esc(s.siteTypeLabel)} (${s.siteType})</span></div>
        <div class="report-item"><span class="report-label">Сложность:</span><span class="report-value">${s.complexity}/5 — ${esc(s.complexityLabel)}</span></div>
        <div class="report-item"><span class="report-label">JS:</span><span class="report-value">${s.jsRequired === 'yes' ? '❌' : s.jsRequired === 'partial' ? '⚠️' : '✅'} ${s.jsRequired}</span></div>
        <div class="report-item"><span class="report-label">Карточек:</span><span class="report-value">${s.videoCardsFound || 0}</span></div>
        <div class="report-item"><span class="report-label">Полей:</span><span class="report-value">${(s.fieldsFound || []).join(', ') || '—'}</span></div>
        <div class="report-item"><span class="report-label">Видео:</span><span class="report-value ${s.videoSourceFound ? '' : 'warning'}">${s.videoSourceFound ? '✅ ' + s.videoSourceMethods.join(',') : '❌'}</span></div>
        </div></div>`;
    }
    if (d.videoCards?.found) { const st = d.videoCards.structure;
        h += `<div class="report-section"><div class="report-section-header">🎬 Селекторы</div><div class="report-section-body">`;
        for (const [k, v] of Object.entries(st)) { if (v.css) h += `<div class="report-item"><span class="report-label">${k}:</span><span class="report-value"><span class="tag">${esc(v.css)}</span> ${v.example ? '→ ' + esc(String(v.example).substring(0, 50)) : ''}</span></div>`; }
        h += '</div></div>';
    }
    if (d.sortCat?.categories?.found) { h += `<div class="report-section"><div class="report-section-header">📁 Категории (${d.sortCat.categories.totalCount})</div><div class="report-section-body" style="max-height:200px;overflow-y:auto">`; d.sortCat.categories.list.forEach(c => { h += `<span class="tag" style="margin:2px">${esc(c.name)}</span>`; }); h += '</div></div>'; }
    return h;
}

// ================================================================
// UI
// ================================================================
function synHL(j) { j = j.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); return j.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, m => { let c = 'color:#ae81ff'; if (/^"/.test(m)) c = /:$/.test(m) ? 'color:#a6e22e' : 'color:#e6db74'; else if (/true|false/.test(m)) c = 'color:#66d9ef'; else if (/null/.test(m)) c = 'color:#f92672'; return `<span style="${c}">${m}</span>`; }); }

function showTab(n) { document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active')); document.querySelectorAll('.tab').forEach(e => e.classList.remove('active')); const t = $('tab-' + n); if (t) t.classList.add('active'); if (event?.target) event.target.classList.add('active'); }

function clip(text) { navigator.clipboard.writeText(text).then(() => setStatus('📋 OK', 'success')).catch(() => { const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t); setStatus('📋 OK', 'success'); }); }
function copyResults() { if (analysisResult) clip(JSON.stringify(analysisResult, null, 2)); }
function copyArchitecture() {
    if (!analysisResult) return;
    const a = { url: analysisResult._meta?.analyzedUrl, analyzedAt: analysisResult._meta?.analyzedAt, userAgent: analysisResult._meta?.userAgent,
        architecture: analysisResult.architecture, summary: analysisResult._summary,
        selectors: analysisResult.videoCards?.found ? analysisResult.videoCards.structure : null,
        cardSelector: analysisResult.videoCards?.cardSelector, cardXPath: analysisResult.videoCards?.cardXPath,
        sampleCards: analysisResult.videoCards?.sampleCards, pagination: analysisResult.pagination,
        search: analysisResult.search, sortCat: analysisResult.sortCat, queryParams: analysisResult.queryParams,
        videoPage: analysisResult.videoPage ? { urlPattern: analysisResult.videoPage.urlStructure, sources: analysisResult.videoPage.videoSources, related: analysisResult.videoPage.relatedVideos, obfuscation: analysisResult.videoPage.obfuscation } : null,
        encoding: analysisResult.encoding, transport: analysisResult._transportLog };
    clip(JSON.stringify(a, null, 2)); setStatus('🏗️ Архитектура скопирована!', 'success');
}

function onPC() { const s = $('proxySelect'), h = $('proxyHint'); if (!h || !s) return; const m = { auto: '🔄 Прямой→Worker→6 прокси', '': '🔗 Прямой', 'https://api.allorigins.win/raw?url=': 'allorigins', 'https://corsproxy.io/?': 'corsproxy', 'https://api.codetabs.com/v1/proxy?quest=': 'codetabs', 'https://thingproxy.freeboard.io/fetch/': 'thingproxy', 'https://cors-anywhere.herokuapp.com/': 'cors-anywhere', 'https://cors.bridged.cc/': 'cors.bridged' }; h.textContent = m[s.value] || ''; }

document.addEventListener('DOMContentLoaded', () => {
    const ui = $('targetUrl'); if (DEFAULT_TARGET_URL && ui && !ui.value) ui.value = DEFAULT_TARGET_URL;
    if (ui) ui.addEventListener('keypress', e => { if (e.key === 'Enter') runFullAnalysis(); });
    const ps = $('proxySelect'); if (ps) { ps.addEventListener('change', onPC); onPC(); }
    const wi = $('workerUrl'); if (wi) { const sv = localStorage.getItem('aWU'); if (sv) { wi.value = sv; updW(true); } wi.addEventListener('input', () => updW(!!wi.value.trim())); wi.addEventListener('change', () => { const v = wi.value.trim(); if (v) localStorage.setItem('aWU', v); else localStorage.removeItem('aWU'); }); }
    const ua = $('uaSelect'), uc = $('uaCustom'); if (ua && uc) ua.addEventListener('change', () => { uc.style.display = ua.value === 'custom' ? 'block' : 'none'; });
});
