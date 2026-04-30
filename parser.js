// ================================================================
// SITE STRUCTURE ANALYZER v7.0.0
// Unified S1-S28 · Interactive hints · Cumulative JSON
// CDN pattern detection · Per-section pagination · Dead strategies
// ================================================================

const DEFAULT_WORKER_URL = "https://zonaproxy.777b737.workers.dev";
let analysisResult = null, catalogData = null, videoPageData = null, transportLog = [];
// v7: cumulative analysis history
let analysisHistory = [];
let additionalAnalyses = {}; // key: type (categories, search, redirect), value: result

const logT = (m, t = 'info') => transportLog.push({ time: new Date().toLocaleTimeString(), message: m, type: t });
const $ = id => document.getElementById(id);
const setStatus = (m, t = 'loading') => { const e = $('status'); if (e) { e.textContent = m; e.className = 'status ' + t } };
const setProgress = (p, t, s) => { const c = $('progress-container'), b = $('progress-bar'), x = $('progress-text'); if (!c) return; c.style.display = 'block'; b.style.width = p + '%'; x.textContent = t || p + '%'; b.classList.remove('cors-error', 'warning', 'worker', 'video-mode'); if (s) b.classList.add(s) };
const baseOf = u => { try { return new URL(u).origin } catch { return '' } };
const resolve = (h, b) => { if (!h) return ''; try { return new URL(h, b).href } catch { return h } };
const hostOf = u => { try { return new URL(u).hostname } catch { return '' } };
const uniq = a => [...new Set(a.filter(Boolean))];
const esc = t => { if (!t) return ''; const d = document.createElement('div'); d.textContent = String(t); return d.innerHTML };
const getTestWord = () => ($('testWord')?.value.trim() || 'wife');
const isVideoMode = () => $('videoModeCheck')?.checked || false;
const UA = { desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120', mobile: 'Mozilla/5.0 (Linux; Android 13) Mobile Chrome/120', bot: 'Googlebot/2.1' };
function getUA() { const s = $('uaSelect'); return s ? UA[s.value] || UA.desktop : UA.desktop }

// ================================================================
// NAME GENERATOR
// ================================================================
function generateNameFromHost(host) {
    const domain = host.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
        .replace(/\.(com|xxx|net|win|me|club|top|ru|org|info|adult|porn|sex|tube|online|site)\s*$/i, '');
    return domain.length <= 5 ? domain : domain[0] + domain.substring(1, 5);
}

// ================================================================
// v7: CDN PATTERN DETECTION — g0-g9.wppsn.com → g*.wppsn.com
// ================================================================
function detectCdnPattern(domains) {
    const patterns = [];
    const groups = new Map();
    for (const d of domains) {
        const m = d.match(/^([a-z]+)(\d+)(\..*)/);
        if (m) {
            const key = m[1] + '*' + m[3];
            if (!groups.has(key)) groups.set(key, { prefix: m[1], suffix: m[3], nums: [] });
            groups.get(key).nums.push(parseInt(m[2]));
        }
    }
    for (const [pattern, data] of groups) {
        if (data.nums.length >= 2) {
            const min = Math.min(...data.nums), max = Math.max(...data.nums);
            const expanded = [];
            for (let i = 0; i <= Math.min(max + 2, max < 10 ? 9 : max + 5); i++) {
                expanded.push(data.prefix + i + data.suffix);
            }
            patterns.push({
                template: data.prefix + '{N}' + data.suffix,
                range: [0, expanded.length - 1],
                found: data.nums,
                expanded
            });
        }
    }
    return patterns;
}

// ================================================================
// MERGE INDICATOR
// ================================================================
function updMerge() {
    const el = $('mergeIndicator');
    if (!el) return;
    const parts = [];
    if (catalogData) parts.push('📦 Каталог');
    if (videoPageData) parts.push('🎬 Видео');
    if (additionalAnalyses.categories) parts.push('📂 Категории');
    if (additionalAnalyses.search) parts.push('🔍 Поиск');
    if (additionalAnalyses.redirect) parts.push('🔄 Redirect');
    if (parts.length > 1) {
        el.textContent = parts.join(' + ') + ' → полный Config';
        el.className = 'merge-indicator has-both';
        el.style.display = 'block';
    } else if (parts.length === 1) {
        el.textContent = parts[0] + ' ✓';
        el.className = 'merge-indicator has-catalog';
        el.style.display = 'block';
    } else el.style.display = 'none';
}

function genXP(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `//*[@id="${el.id}"]`;
    const p = []; let c = el;
    while (c && c.nodeType === 1) {
        let t = c.tagName.toLowerCase();
        if (c.className && typeof c.className === 'string') {
            const cl = c.className.trim().split(/\s+/)[0];
            if (cl && cl.length > 2) { p.unshift(`//${t}[contains(@class,"${cl}")]`); break }
        }
        let i = 1, s = c.previousElementSibling;
        while (s) { if (s.tagName === c.tagName) i++; s = s.previousElementSibling }
        p.unshift(`/${t}[${i}]`); c = c.parentElement;
    }
    return p.join('');
}

// ================================================================
// TRANSPORT
// ================================================================
const getW = () => { const i = $('workerUrl'); return i ? i.value.trim().replace(/\/$/, '') : '' };
const updW = h => { const b = $('workerStatusBadge'); if (b) { b.textContent = h ? '✦' : '○'; b.className = 'worker-badge ' + (h ? 'active' : 'inactive') } };
function updCI(s, d) {
    const el = $('corsIndicator'); if (!el) return;
    const m = { 'trying-direct': ['🔗', 'trying'], 'direct-ok': ['✅', 'direct-ok'], 'trying-worker': ['⚡', 'trying'], 'worker-ok': ['✅W', 'worker-ok'], 'cors-detected': ['🛡️CORS', 'cors-blocked'], 'trying-proxy': ['🔄' + (d || ''), 'cors-blocked'], 'proxy-ok': ['✅' + (d || ''), 'proxy-ok'], 'all-failed': ['❌', 'all-failed'], hidden: ['', ''] };
    const v = m[s] || m.hidden; el.textContent = v[0]; el.className = 'cors-indicator ' + v[1]; el.style.display = s === 'hidden' ? 'none' : 'block';
}
const proxies = () => [{ n: 'allorigins', u: 'https://api.allorigins.win/raw?url=' }, { n: 'corsproxy', u: 'https://corsproxy.io/?' }, { n: 'codetabs', u: 'https://api.codetabs.com/v1/proxy?quest=' }];
const isCE = e => { if (!e) return false; const m = (e.message || '').toLowerCase(); return m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed') || e.name === 'TypeError' };

async function fD(url) { const a = new AbortController, t = setTimeout(() => a.abort(), 10000); try { const r = await fetch(url, { signal: a.signal }); clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); const h = await r.text(); if (h.length < 50) throw new Error('Empty'); return h } catch (e) { clearTimeout(t); throw e } }
async function fW(url) { const w = getW(); if (!w) throw new Error('No W'); const a = new AbortController, t = setTimeout(() => a.abort(), 15000); try { const r = await fetch(w + '/?url=' + encodeURIComponent(url) + '&ua=' + encodeURIComponent(getUA()), { signal: a.signal }); clearTimeout(t); if (!r.ok) throw new Error('W' + r.status); const h = await r.text(); if (h.length < 50) throw new Error('Empty'); return h } catch (e) { clearTimeout(t); throw e } }
async function fP(url, pfx) { const a = new AbortController, t = setTimeout(() => a.abort(), 15000); try { const r = await fetch(pfx + encodeURIComponent(url), { signal: a.signal }); clearTimeout(t); if (!r.ok) throw new Error('HTTP ' + r.status); const h = await r.text(); if (h.length < 50) throw new Error('Empty'); return h } catch (e) { clearTimeout(t); throw e } }

async function fetchPage(url) {
    const mode = ($('proxySelect') || {}).value || 'auto', w = getW();
    if (mode === '' || mode === 'direct-test') return fD(url);
    if (mode === 'auto') {
        try { logT('Direct'); updCI('trying-direct'); const h = await fD(url); logT('✅', 'success'); updCI('direct-ok'); return h } catch (e) { logT(isCE(e) ? 'CORS' : e.message, 'warning') }
        if (w) { try { logT('Worker'); updCI('trying-worker'); const h = await fW(url); logT('✅W', 'success'); updCI('worker-ok'); return h } catch (e) { logT('W:' + e.message, 'fail') } }
        updCI('cors-detected');
        const px = proxies();
        for (let i = 0; i < px.length; i++) { try { logT(px[i].n); updCI('trying-proxy', px[i].n); const h = await fP(url, px[i].u); logT('✅' + px[i].n, 'success'); updCI('proxy-ok', px[i].n); return h } catch (e) { logT('❌' + px[i].n, 'fail') } }
        updCI('all-failed'); throw new Error('All blocked');
    }
    if (w) { try { return await fW(url) } catch (e) { logT('W:' + e.message, 'warning') } }
    return fP(url, mode);
}
const parseH = h => new DOMParser().parseFromString(h, 'text/html');

// ================================================================
// RESOLVE REDIRECT CHAIN
// ================================================================
async function resolveRedirectChain(url, maxHops) {
    const w = getW();
    if (!w) return { error: 'No worker configured', chain: [url], final: url, redirects: 0 };
    maxHops = maxHops || 8;
    try {
        const resolveUrl = w + '/resolve?url=' + encodeURIComponent(url) + '&max=' + maxHops;
        logT('Resolve: ' + url.substring(0, 80));
        const a = new AbortController, t = setTimeout(() => a.abort(), 20000);
        const r = await fetch(resolveUrl, { signal: a.signal });
        clearTimeout(t);
        if (r.ok) {
            const data = await r.json();
            logT('Resolved: ' + (data.redirects || 0) + ' hops', data.error ? 'fail' : 'success');
            return data;
        }
        throw new Error('Resolve HTTP ' + r.status);
    } catch (e) {
        logT('Resolve fallback: ' + e.message, 'warning');
        return { error: e.message, chain: [url], final: url, redirects: 0, fallback: true };
    }
}

// ================================================================
// DEBUG REPORT
// ================================================================
function buildDebugReport(html) {
    const patterns = [
        { name: 'source_tag', re: /<source/gi },
        { name: 'og_video', re: /og:video/gi },
        { name: 'mp4', re: /\.mp4/gi },
        { name: 'm3u8', re: /\.m3u8/gi },
        { name: 'video_url', re: /video_url/gi },
        { name: 'flowplayer', re: /flowplayer/gi },
        { name: 'html5player', re: /html5player/gi },
        { name: 'dataEncodings', re: /dataEncod/gi },
        { name: 'get_file', re: /get_file/gi },
        { name: 'kt_player', re: /kt_player/gi },
        { name: 'function_0', re: /function\/0/gi },
        { name: 'Plyr', re: /Plyr\.js|new\s+Plyr/gi },
        { name: 'Flashvars', re: /flashvars/gi },
        { name: 'JSON_LD', re: /application\/ld\+json/gi }
    ];
    const result = {};
    for (const p of patterns) { const matches = html.match(p.re); result[p.name] = matches ? matches.length : 0 }
    return result;
}

// ================================================================
// S-STRATEGY DETECTION v7 — with confidence, foundUrls, filtering
// ================================================================
function detectAllStrategies(html, allJS, base) {
    const cb = html + '\n' + allJS;
    const strategies = [];
    const debugReport = buildDebugReport(cb);

    function addS(id, name, block, desc, confidence, foundUrls, regex, method, details) {
        strategies.push({ id: 'S' + id, name, block, desc, active: true, confidence, foundUrls: foundUrls || [], regex: regex || null, extractionMethod: method || 'regex', details: details || null, priority: strategies.length + 1 });
    }

    // S1: video_url / video_alt_url
    const s1urls = [];
    const s1re = /video_url\s*[:=]\s*['"]([^'"]+)['"]/gi;
    const s1are = /video_alt_url\s*[:=]\s*['"]([^'"]+)['"]/gi;
    let m;
    while ((m = s1re.exec(cb)) !== null) { if (m[1].length > 10) s1urls.push(m[1]) }
    while ((m = s1are.exec(cb)) !== null) { if (m[1].length > 10) s1urls.push(m[1]) }
    if (s1urls.length) {
        // v7: decode function/0/ URLs inline
        const decoded = s1urls.map(u => {
            const fm = u.match(/\/function\/\d+\/(https?:\/\/.+)/);
            if (fm) return { encoded: u, decoded: fm[1] };
            if (u.match(/^function\/\d+\/(https?:\/\/.+)/)) return { encoded: u, decoded: u.match(/^function\/\d+\/(https?:\/\/.+)/)[1] };
            return null;
        }).filter(Boolean);
        const cleanUrls = s1urls.map(u => {
            const fm = u.match(/(?:\/)?function\/\d+\/(https?:\/\/.+)/);
            return fm ? fm[1] + ' [decoded]' : u;
        });
        addS(1, 'VIDEO_RULES', 1, 'video_url/video_alt_url/setVideoUrlHigh/file:mp4', 'confirmed', cleanUrls,
            ["video_url\\s*[:=]\\s*['\"]([^'\"]+)['\"]", "video_alt_url\\s*[:=]\\s*['\"]([^'\"]+)['\"]"], 'regex',
            decoded.length ? { decodedUrls: decoded } : null);
    }

    // S2: direct mp4
    const s2urls = [];
    const mp4re = /["'](https?:\/\/[^"'\s]+?\.mp4[^"'\s]*?)["']/gi;
    while ((m = mp4re.exec(cb)) !== null) {
        const u = m[1];
        if (u.indexOf('{') !== -1) continue;
        // v7: skip thumbnail preview mp4s
        if (/\/tmb\/\d+\/\d+\.mp4/.test(u)) continue;
        if (u.indexOf('preview') !== -1 || u.indexOf('thumb') !== -1) continue;
        s2urls.push(u);
    }
    if (s2urls.length) addS(2, 'direct_mp4', 1, 'Direct https://...mp4 URLs in page', 'confirmed', uniq(s2urls).slice(0, 20), ["[\"'](https?://[^\"'\\s]+?\\.mp4[^\"'\\s]*?)[\"']"], 'regex');

    // S3: og:video
    if (debugReport.og_video > 0) {
        const ogUrls = [];
        const ogRe = /og:video[^>]*content="([^"]+)"/gi;
        while ((m = ogRe.exec(html)) !== null) ogUrls.push(m[1]);
        addS(3, 'og_video', 1, '<meta property="og:video">', ogUrls.length ? 'confirmed' : 'detected', ogUrls, ['og:video'], 'dom-meta');
    }

    // S4: HLS m3u8
    if (debugReport.m3u8 > 0) {
        const hlsUrls = [];
        const hlsRe = /["'](https?:\/\/[^"'\s]+?\.m3u8[^"'\s]*?)["']/gi;
        while ((m = hlsRe.exec(cb)) !== null) hlsUrls.push(m[1]);
        addS(4, 'HLS_m3u8', 1, '.m3u8 playlist URL', hlsUrls.length ? 'confirmed' : 'detected', hlsUrls, ['.m3u8'], 'regex');
    }

    // S5: get_file
    const s5urls = [];
    const gfRe = /(https?:\/\/[^\s"']+\/get_file\/[^\s"']+)/gi;
    while ((m = gfRe.exec(cb)) !== null) s5urls.push(m[1]);
    if (s5urls.length) addS(5, 'get_file', 1, '/get_file/{id}/{hash}/ pattern', 'confirmed', uniq(s5urls).slice(0, 10), ["(https?://[^\\s\"']+/get_file/[^\\s\"']+)"], 'regex');

    // S6: <source size>
    if (/<source[^>]+size="/.test(cb)) addS(6, 'source_size', 1, '<source src size="480">', 'detected', [], null, 'dom');

    // S7: <source label/title>
    if (/<source[^>]+(?:label|title)="/.test(cb)) addS(7, 'source_label', 1, '<source src label="480p">', 'detected', [], null, 'dom');

    // S8: DOMParser source
    if (/<video\s[^>]*source[^>]*src/i.test(cb)) addS(8, 'DOMParser_source', 2, 'DOMParser video source fallback', 'detected', [], null, 'dom');

    // S9: dataEncodings
    if (debugReport.dataEncodings > 0) {
        const deUrls = [];
        for (const vn of ['dataEncodings', 'sources', 'media_sources']) {
            const idx = cb.indexOf(vn); if (idx === -1) continue;
            const as = cb.indexOf('[', idx); if (as === -1 || as - idx > 50) continue;
            try {
                let depth = 0, ae = -1;
                for (let i = as; i < Math.min(cb.length, as + 10000); i++) { if (cb[i] === '[') depth++; else if (cb[i] === ']') { depth--; if (depth === 0) { ae = i; break } } }
                if (ae === -1) continue;
                JSON.parse(cb.substring(as, ae + 1)).forEach(item => {
                    const u = item.filename || item.file || item.src || item.url || '';
                    if (u && u.length > 10) deUrls.push((u.indexOf('//') === 0 ? 'https:' : '') + u.replace(/\\\//g, '/'));
                });
            } catch { }
        }
        addS(9, 'dataEncodings', 2, 'dataEncodings/sources JSON array', 'confirmed', uniq(deUrls).slice(0, 10), null, 'json-parse', { variables: ['dataEncodings'] });
    }

    // S10: html5player
    if (/html5player\.setVideoUrl/i.test(cb)) addS(10, 'html5player', 2, 'html5player.setVideoUrl()', 'detected', [], null, 'regex');

    // S11: flowplayer — v7: filter false positives via debugReport
    if (/flowplayer/i.test(cb) && debugReport.flowplayer > 2) addS(11, 'flowplayer', 2, 'Flowplayer playlist/clip config', 'detected', [], null, 'json-parse');

    // S12: KVS multi url — v7: filter video_url_text false positives
    const s12urls = [];
    const s12re = /video_url_(\w+)\s*[:=]\s*['"]([^'"]+)['"]/gi;
    while ((m = s12re.exec(cb)) !== null) {
        const qual = m[1], url = m[2];
        // v7 fix: skip _text fields (labels, not URLs)
        if (qual === 'text') continue;
        if (url.length < 15 || (!url.includes('/') && !url.includes('.'))) continue;
        s12urls.push(resolve(url, base) + ' [' + qual + ']');
    }
    if (s12urls.length) addS(12, 'KVS_multi_url', 2, 'video_url_720p, video_url_480p etc', 'confirmed', s12urls, ["video_url_(\\w+)\\s*[:=]\\s*['\"]([^'\"]+)['\"]"], 'regex', { qualities: s12urls });

    // S13-S16
    if (/data-(?:config|video|sources|player)=/i.test(cb)) addS(13, 'data_config', 2, 'data-config/data-video attribute', 'detected', [], null, 'dom');
    if (/data-setup=/i.test(cb) && /videojs|video-js/i.test(cb)) addS(14, 'videojs', 2, 'Video.js data-setup', 'detected', [], null, 'dom');
    if (/new\s+Plyr|Plyr\.setup|data-plyr/i.test(cb)) addS(15, 'Plyr', 2, 'Plyr player', 'detected', [], null, 'regex');
    if (/jwplayer\s*\([^)]*\)\s*\.\s*setup/i.test(cb)) addS(16, 'JW_Player_setup', 2, 'JW Player setup()', 'detected', [], null, 'regex');

    // S17: Flashvars
    if (/flashvars\s*[:=]\s*\{/i.test(cb)) {
        const fvUrls = [];
        const fvM = cb.match(/flashvars\s*[:=]\s*\{([^}]+)\}/i);
        if (fvM) {
            const vuM = fvM[1].match(/(?:video_url|file|src)\s*[:=]\s*['"]([^'"]+)['"]/gi);
            if (vuM) vuM.forEach(v => { const mm = v.match(/['"]([^'"]+)['"]/); if (mm) fvUrls.push(mm[1]) });
        }
        addS(17, 'Flashvars', 2, 'flashvars object with video URLs', fvUrls.length ? 'confirmed' : 'detected', fvUrls, ["flashvars\\s*[:=]\\s*\\{"], 'regex');
    }

    // S18: JSON-LD
    if (debugReport.JSON_LD > 0) {
        const ldUrls = [];
        const ldM = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
        if (ldM) ldM.forEach(block => {
            try {
                const content = block.replace(/<[^>]+>/g, '');
                const ld = JSON.parse(content);
                if (ld.contentUrl) ldUrls.push(ld.contentUrl);
                if (ld.embedUrl) ldUrls.push(ld.embedUrl);
                if (ld.url) ldUrls.push(ld.url);
                if (ld.video?.contentUrl) ldUrls.push(ld.video.contentUrl);
                if (ld.video?.embedUrl) ldUrls.push(ld.video.embedUrl);
            } catch { }
        });
        addS(18, 'JSON_LD', 3, 'application/ld+json schema.org', ldUrls.length ? 'confirmed' : 'detected', ldUrls, null, 'json-ld-parse');
    }

    // S19-S28
    if (/\.mpd['"\s?]/i.test(cb)) addS(19, 'DASH_mpd', 3, '.mpd DASH manifest', 'detected', [], null, 'regex');
    if (/cloudflarestream\.com/i.test(cb)) addS(20, 'CF_Stream', 3, 'Cloudflare Stream', 'detected', [], null, 'regex');

    // S21: redirect — v7: filter non-video URLs
    const s21urls = [];
    const locRe = /window\.location\s*=\s*['"]([^'"]+)['"]/gi;
    while ((m = locRe.exec(cb)) !== null) {
        const u = m[1];
        if (/\.mp4|\.m3u8|\/video\/|\/embed\/|\/watch\//i.test(u)) s21urls.push(resolve(u, base));
    }
    if (s21urls.length) addS(21, 'redirect', 3, 'window.location redirect to video', 'confirmed', s21urls, null, 'redirect-follow');

    if (/\.ts['"\s?]/i.test(cb) && !/\.tsu|\.tsx|\.tsl/i.test(cb)) addS(22, 'ts_segments', 3, '.ts video segments', 'detected', [], null, 'regex');
    if (/postMessage\s*\(\s*['"]https?:/i.test(cb)) addS(23, 'PostMessage', 3, 'PostMessage video URL', 'detected', [], null, 'regex');
    if (/(?:token|jwt|auth)\s*[:=]\s*['"][A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./i.test(cb)) addS(24, 'JWT_decode', 3, 'JWT token decode', 'detected', [], null, 'regex');

    // S25: JS object
    const s25re = /var\s+\w+\s*=\s*\{[^}]*(?:src|file|url)\s*[:=]\s*['"]([^'"]+\.(?:mp4|m3u8)[^'"]*)/gi;
    const s25urls = [];
    while ((m = s25re.exec(cb)) !== null) {
        let u = m[1];
        const fm = u.match(/(?:\/)?function\/\d+\/(https?:\/\/.+)/);
        if (fm) { s25urls.push(fm[1] + ' [decoded]'); } else { s25urls.push(u); }
    }
    if (s25urls.length) addS(25, 'JS_object', 3, 'var x = {src/file/url: "...mp4"}', 'confirmed', s25urls, ["var\\s+\\w+\\s*=\\s*\\{[^}]*(?:src|file|url)\\s*[:=]\\s*['\"]([^'\"]+)"], 'regex');

    if (/MediaSource\s*\(/i.test(cb)) addS(26, 'MediaSource', 4, 'MediaSource API (headless needed)', 'detected', [], null, 'regex');
    if (/video\[data-src\]|data-lazy-src|data-video-src/i.test(cb)) addS(27, 'Lazy_video', 4, 'Lazy-loaded video src', 'detected', [], null, 'dom');
    if (/\/api\/[^'"]*video|endpoint.*video/i.test(cb)) addS(28, 'API_endpoint', 4, 'REST API video endpoint', 'detected', [], null, 'regex');

    // Build active map and order
    const activeMap = {};
    for (let i = 1; i <= 28; i++) activeMap['S' + i] = false;
    strategies.forEach(s => { activeMap[s.id] = true });

    const order = strategies.map(s => s.id);
    const blocks = uniq(strategies.map(s => s.block)).sort();
    const minBlock = blocks.length ? Math.min(...blocks) : 0;

    // v7: dead strategies with evidence
    const deadStrategies = [];
    const deadMap = {
        S1: 'video_url', S5: 'get_file', S9: 'dataEncodings', S10: 'html5player',
        S11: 'flowplayer', S13: 'kt_player', S17: 'Flashvars', S18: 'JSON_LD'
    };
    for (const [sid, reportKey] of Object.entries(deadMap)) {
        if (!activeMap[sid] && debugReport[reportKey] === 0) {
            deadStrategies.push({ id: sid, evidence: reportKey + ':0 in debugReport' });
        }
    }

    return {
        strategies,
        activeMap,
        strategyOrder: order,
        strategySummary: {
            total: strategies.length,
            confirmed: strategies.filter(s => s.confidence === 'confirmed').length,
            detected: strategies.filter(s => s.confidence === 'detected').length,
            blocks, recommendedBlock: minBlock,
            allFoundUrls: strategies.reduce((sum, s) => sum + s.foundUrls.length, 0)
        },
        deadStrategies,
        debugReport
    };
}

// ================================================================
// CARD DETECTION v7 — extended selectors for [class*="tit"], [class*="dur"]
// ================================================================
const RANKED_CARD_SELECTORS = [
    '.video-block', '.video-item', 'div.thumb_main', '.thumb',
    '.thumb-item', '.item', 'article.video', '.video-thumb', '.video',
    '.video-card', '.video_block', '.clip', '.gallery-item', 'article.post',
    '.card', '[data-video-id]', '[data-id]',
    '.mozaique .thumb-block', '.list-videos .video-item', 'div.thumb'
];

function aCards(doc, base) {
    const r = { found: false, container: null, link: null, title: null, thumb: null, thumbAttr: null, duration: null,
        totalFound: 0, linkPattern: null, rankedSelectors: [], sampleCards: [] };

    let cards = [], uS = '';
    for (const s of RANKED_CARD_SELECTORS) {
        try {
            const f = doc.querySelectorAll(s);
            const count = f.length;
            const hasLink = count >= 2 && Array.from(f).some(e => e.querySelector('a[href]'));
            const hasImg = count >= 2 && Array.from(f).some(e => e.querySelector('img'));
            if (count >= 2) r.rankedSelectors.push({ selector: s, count, hasLink, hasImg, usable: hasLink && hasImg });
            if (!cards.length && hasLink && hasImg) { cards = Array.from(f); uS = s }
        } catch { }
    }

    // Fallback: video link parents
    if (!cards.length) {
        const videoLinkPats = ['/video/', '/videos/', '/watch/', '/view/', '/embed/', '/v/'];
        const anchors = Array.from(doc.querySelectorAll('a[href]')).filter(a => {
            const h = a.getAttribute('href') || '';
            return videoLinkPats.some(p => h.includes(p)) || /\/\d{4,}\//.test(h);
        });
        if (anchors.length >= 3) {
            const parents = new Map();
            anchors.forEach(a => {
                let p = a.parentElement;
                for (let d = 0; d < 5 && p; d++) {
                    const key = p.tagName + (p.className ? '.' + p.className.trim().split(/\s+/)[0] : '');
                    if (!parents.has(key)) parents.set(key, { el: p, count: 0, depth: d });
                    parents.get(key).count++; p = p.parentElement;
                }
            });
            let bestParent = null, bestScore = 0;
            for (const [key, data] of parents) {
                if (data.count >= 3) { const score = data.count * 10 - data.depth; if (score > bestScore) { bestScore = score; bestParent = data } }
            }
            if (bestParent) {
                const pp = bestParent.el, tag = pp.tagName.toLowerCase(), cls = pp.className ? '.' + pp.className.trim().split(/\s+/)[0] : '';
                uS = tag + cls;
                const container = pp.parentElement;
                if (container) {
                    const siblings = container.querySelectorAll(':scope > ' + tag + (cls || ''));
                    if (siblings.length >= 2) { cards = Array.from(siblings); uS = tag + cls }
                }
            }
        }
    }

    if (!cards.length) return r;
    r.found = true; r.container = uS; r.totalFound = cards.length;

    // v7: extended title selectors including [class*="tit"]
    const tS = ['.title', '.name', '.video-title', 'a[title]', '[class*="title"]', '[class*="tit"]', '[class*="nam"]', 'h3', 'h4', 'h2', 'strong', 'b'];
    // v7: extended duration selectors including [class*="dur"]
    const dS = ['.duration', '.time', '[class*="duration"]', '[class*="time"]', '[class*="dur"]', 'span.length'];
    const imgA = ['data-src', 'data-original', 'data-lazy-src', 'data-thumb', 'data-poster', 'src'];
    const linkPats = ['/video/', '/videos/', '/watch/', '/view/', '/v/'];

    let linkSel = null, titleSel = null, thumbSel = null, thumbAttr = null, durSel = null;

    for (let i = 0; i < Math.min(8, cards.length); i++) {
        const card = cards[i], cd = {};

        // Link
        const linkEls = [...card.querySelectorAll('a[href]')]; let linkEl = null;
        for (const a of linkEls) { const h = a.getAttribute('href') || ''; if (linkPats.some(p => h.includes(p)) || /\/\d{3,}/.test(h)) { linkEl = a; break } }
        if (!linkEl) linkEl = linkEls[0];
        if (linkEl) {
            cd.link = resolve(linkEl.getAttribute('href'), base);
            if (i === 0 && !linkSel) {
                const h = linkEl.getAttribute('href') || '';
                if (linkPats.some(p => h.includes(p))) { const pat = linkPats.find(p => h.includes(p)); linkSel = `a[href*="${pat}"]` }
                else linkSel = 'a[href]';
            }
        }

        // Title
        let titleFound = false;
        for (const ts of tS) {
            if (titleFound) break;
            try {
                const el = card.querySelector(ts);
                if (el) {
                    const t = ts === 'a[title]' ? (el.getAttribute('title') || '') : el.textContent.trim();
                    if (t && t.length > 2 && t.length < 300) { cd.title = t.substring(0, 80); if (i === 0 && !titleSel) titleSel = ts; titleFound = true }
                }
            } catch { }
        }
        if (!titleFound && linkEl) {
            const lt = linkEl.getAttribute('title') || '';
            if (lt.length > 2) { cd.title = lt.substring(0, 80); if (i === 0 && !titleSel) titleSel = 'a[title]'; titleFound = true }
        }
        if (!titleFound) {
            const img = card.querySelector('img[alt]');
            if (img) { const alt = img.getAttribute('alt') || ''; if (alt.length > 3) { cd.title = alt.substring(0, 80); if (i === 0 && !titleSel) titleSel = 'img[alt]'; titleFound = true } }
        }

        // Thumbnail
        card.querySelectorAll('img').forEach(img => {
            if (cd.thumbnail) return;
            for (const at of imgA) {
                const sv = img.getAttribute(at);
                if (sv && !sv.startsWith('data:') && sv.length > 10 && !sv.includes('spacer') && !sv.includes('blank') && !sv.includes('flag_icon')) {
                    cd.thumbnail = resolve(sv, base); if (i === 0 && !thumbSel) { thumbSel = 'img'; thumbAttr = at } break;
                }
            }
        });

        // Duration
        for (const ds of dS) {
            try {
                const el = card.querySelector(ds);
                if (el) {
                    const t = el.textContent.trim();
                    if (/\d{1,3}:\d{2}/.test(t)) { const mm = t.match(/\d{1,3}:\d{2}(?::\d{2})?/); if (mm) { cd.duration = mm[0]; if (i === 0 && !durSel) durSel = ds; break } }
                }
            } catch { }
        }
        if (!cd.duration) {
            for (const el of card.querySelectorAll('span,div,small,em,p')) {
                const t = el.textContent.trim();
                if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(t)) {
                    cd.duration = t;
                    if (i === 0 && !durSel) durSel = el.tagName.toLowerCase() + (el.className ? '.' + el.className.trim().split(/\s+/)[0] : '');
                    break;
                }
            }
        }

        // Views
        const viewEl = card.querySelector('.views,[class*="view"],[class*="watch"]');
        if (viewEl) { const vm = viewEl.textContent.match(/([\d,.]+\s*[KkMm]?)/); if (vm) cd.views = vm[0].trim() }

        if (cd.link || cd.title || cd.thumbnail) r.sampleCards.push(cd);
    }

    r.link = linkSel ? `${uS} ${linkSel}` : `${uS} a[href]`;
    r.title = titleSel ? `${uS} ${titleSel}` : null;
    r.thumb = thumbSel ? `${uS} ${thumbSel}` : `${uS} img`;
    r.thumbAttr = thumbAttr || 'src';
    r.duration = durSel ? `${uS} ${durSel}` : null;

    if (r.sampleCards.length) {
        try { const u = new URL(r.sampleCards[0].link); r.linkPattern = u.pathname.replace(/\/\d+\//g, '/{id}/').replace(/\/[a-z0-9_-]{8,}\/?$/i, '/{slug}/') } catch { }
    }

    // v7: validate cards are real video cards (not language switchers etc)
    r.validationWarnings = [];
    if (r.sampleCards.length && r.sampleCards.every(c => !c.link || c.link.includes('void(0)') || c.link.includes('javascript:'))) {
        r.validationWarnings.push('All card links are javascript:void — likely NOT video cards (language switcher?)');
        r.found = false;
    }
    if (r.sampleCards.length && r.sampleCards.every(c => !c.duration)) {
        r.validationWarnings.push('No durations found — cards may not be video cards');
    }

    return r;
}

// ================================================================
// PROTECTION ANALYSIS
// ================================================================
function aProt(doc, html, base) {
    const r = { cloudflare: false, cloudflareTurnstile: false, ddosGuard: false, drm: false, drmDetails: [],
        ageGate: null, refererProtected: false, requiredHeaders: {}, cookies: [] };
    const lc = html.toLowerCase();
    const src = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const cb = lc + src.toLowerCase();

    if (lc.includes('challenges.cloudflare.com')) { r.cloudflare = true; r.cloudflareTurnstile = cb.includes('turnstile') || cb.includes('cf-turnstile') }
    if (lc.includes('ddos-guard')) r.ddosGuard = true;
    [{ n: 'Widevine', p: ['widevine'] }, { n: 'PlayReady', p: ['playready'] }, { n: 'FairPlay', p: ['fairplay'] },
    { n: 'EME', p: ['requestmedialkeysystemaccess', 'encrypted-media'] }
    ].forEach(d => { d.p.forEach(p => { if (cb.includes(p)) { r.drm = true; r.drmDetails.push(d.n) } }) });
    r.drmDetails = uniq(r.drmDetails);
    if (cb.includes('document.referrer') || /referer.*check|check.*referer/i.test(cb)) r.refererProtected = true;

    const ageCN = ['age_verified', 'disclaimer', 'over18', 'agegate', 'is_adult', 'mature', 'age_confirm'];
    let ageType = null, ageDet = {};
    for (const cn of ageCN) {
        if (cb.includes(cn)) {
            ageType = 'cookie-flag';
            const vm = cb.match(new RegExp(cn + '\\s*[=:]\\s*["\']?([^"\'\\s;,}{]+)', 'i'));
            ageDet = { detected: true, type: 'cookie-flag', impact: 'low', cookieName: cn, cookieValue: vm ? vm[1] : '1', note: `Cookie: ${cn}=${vm ? vm[1] : '1'}` }; break;
        }
    }
    if (!ageType) {
        for (const form of doc.querySelectorAll('form')) {
            const act = (form.getAttribute('action') || '').toLowerCase();
            if (act.includes('age') || act.includes('verify') || act.includes('disclaimer')) {
                ageType = 'post-form';
                ageDet = { detected: true, type: 'post-form', impact: 'medium', note: 'POST age verification' }; break;
            }
        }
    }
    if (ageType) r.ageGate = ageDet;

    r.requiredHeaders = {};
    if (r.ageGate?.cookieName) r.requiredHeaders.Cookie = r.ageGate.cookieName + '=' + (r.ageGate.cookieValue || '1');
    if (r.refererProtected) r.requiredHeaders.Referer = (base || '') + '/';
    r.requiredHeaders['User-Agent'] = getUA();
    return r;
}

// ================================================================
// KVS ENGINE DETECTION
// ================================================================
function detectKvsEngine(html, allJS) {
    const markers = {
        getFile: /\/get_file\/\d+\//i.test(html + allJS),
        kvsPlayer: /kvs[_-]?player/i.test(allJS),
        flashvars: /flashvars\s*\[/i.test(allJS),
        videoUrl: /video_url\s*[:=]/i.test(allJS),
        videoAlt: /video_alt_url\d?\s*[:=]/i.test(allJS),
        licenseCode: /license_code/i.test(allJS),
        ktPlayer: /kt_player/i.test(allJS)
    };
    const score = Object.values(markers).filter(Boolean).length;
    return {
        isKvs: score >= 2, confidence: Math.min(score / 5, 1), markers,
        note: score >= 3 ? 'KVS (Kernel Video Sharing) engine' : score >= 2 ? 'Likely KVS-based' : 'Not KVS'
    };
}

// ================================================================
// KT_PLAYER / LICENSE DECODE
// ================================================================
function detectKtPlayerScript(doc, extScripts) {
    for (const src of extScripts) if (/kt_player|kt-player|ktplayer/i.test(src)) return src;
    for (const src of extScripts) if (/\/player\/[^"']+\.js/i.test(src)) return src;
    const allJS = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const m = allJS.match(/["']((?:https?:)?\/\/[^"']*kt_player[^"']*\.js[^"']*)/i) || allJS.match(/["'](\/player\/[^"']+\.js)/i);
    return m ? m[1] : null;
}

function extractLicenseCode(html, allJS) {
    const combined = html + '\n' + allJS;
    const patterns = [/license_code\s*[:=]\s*['"]([^'"]+)['"]/, /kt_player\s*\([^)]*,\s*['"]([^'"]{10,})['"]\s*[,)]/, /var\s+license\s*=\s*['"]([^'"]+)['"]/];
    for (const p of patterns) { const m = combined.match(p); if (m && m[1] && m[1].length >= 8) return m[1] }
    return null;
}

function analyzeKtDecodeFunction(ktCode) {
    const r = { found: false, chunkSize: null, modulo: null, direction: null, tailHandling: null, rawSnippet: null, algorithm: null, functionMarker: null };
    if (!ktCode || ktCode.length < 100) return r;
    const fm = ktCode.match(/\/function\/(\d)\//);
    if (fm) r.functionMarker = parseInt(fm[1]);
    const candidates = [];
    const fnRe = /function\s*\w*\s*\([^)]{1,40}\)\s*\{/g;
    let m;
    while ((m = fnRe.exec(ktCode)) !== null) {
        const start = m.index;
        let depth = 0, end = -1;
        for (let i = start + m[0].length - 1; i < Math.min(ktCode.length, start + 8000); i++) {
            if (ktCode[i] === '{') depth++; else if (ktCode[i] === '}') { depth--; if (depth === 0) { end = i; break } }
        }
        if (end === -1) continue;
        const body = ktCode.substring(start, end + 1);
        if (/charCodeAt|fromCharCode/.test(body) && /\.substr\s*\(/.test(body) && /%\s*\d+|%\s*\w+\.length/.test(body) && body.length < 4000) candidates.push(body);
    }
    if (!candidates.length) return r;
    candidates.sort((a, b) => a.length - b.length);
    const block = candidates[0];
    r.found = true; r.rawSnippet = block.substring(0, 600);
    const chunks = [...block.matchAll(/\.substr\s*\(\s*[^,]+,\s*(\d)\s*\)/g)];
    r.chunkSize = chunks.length ? parseInt(chunks[chunks.length - 1][1]) : 1;
    const modM = block.match(/%\s*(\d+)/);
    r.modulo = modM ? parseInt(modM[1]) : null;
    r.direction = /length[^;]{0,20}--|i--/.test(block) ? 'reverse' : 'forward';
    r.tailHandling = /\.slice\(|\.substring\(/.test(block) ? 'slice-remainder' : 'conditional-skip';
    r.algorithm = `license_code.substr(i,${r.chunkSize}) → parseInt → % ${r.modulo || '?'} → shift(${r.direction})`;
    return r;
}

function tryKtDecode(url, licenseCode) {
    if (!url || !licenseCode) return null;
    const funcMatch = url.match(/\/function\/(\d)\/(.*)/);
    if (!funcMatch) return null;
    const funcType = parseInt(funcMatch[1]), encoded = funcMatch[2];
    if (!encoded || encoded.length < 10) return null;
    if (encoded.startsWith('http') && (encoded.includes('/get_file/') || encoded.includes('.mp4') || encoded.includes('.m3u8'))) return encoded;
    try {
        if (funcType === 0) return ktDecodeMethod0(encoded, licenseCode);
        if (funcType === 1) return ktDecodeMethod1(encoded, licenseCode);
    } catch { return null }
    return null;
}

function ktDecodeMethod0(encoded, licenseCode) {
    const codes = [];
    for (let i = 0; i < licenseCode.length; i++) { const num = parseInt(licenseCode[i]); if (!isNaN(num)) codes.push(num % 9) }
    if (!codes.length) return null;
    let decoded = '';
    for (let i = 0; i < encoded.length; i++) decoded += String.fromCharCode(encoded.charCodeAt(i) - codes[i % codes.length]);
    if (decoded.startsWith('http') && (decoded.includes('/get_file/') || decoded.includes('.mp4'))) return decoded;
    const codes2 = [];
    for (let i = 0; i + 1 < licenseCode.length; i += 2) { const num = parseInt(licenseCode.substr(i, 2)); if (!isNaN(num)) codes2.push(num % 9) }
    if (!codes2.length) return null;
    let decoded2 = '';
    for (let i = 0; i < encoded.length; i++) decoded2 += String.fromCharCode(encoded.charCodeAt(i) - codes2[i % codes2.length]);
    if (decoded2.startsWith('http') && (decoded2.includes('/get_file/') || decoded2.includes('.mp4'))) return decoded2;
    return null;
}

function ktDecodeMethod1(encoded, licenseCode) {
    const codes = [];
    for (let i = 0; i < licenseCode.length; i++) { const num = parseInt(licenseCode[i]); if (!isNaN(num)) codes.push(num % 9) }
    if (!codes.length) return null;
    let decoded = '', ci = codes.length - 1;
    for (let i = encoded.length - 1; i >= 0; i--) { decoded = String.fromCharCode(encoded.charCodeAt(i) - codes[ci]) + decoded; ci--; if (ci < 0) ci = codes.length - 1 }
    if (decoded.startsWith('http') && (decoded.includes('/get_file/') || decoded.includes('.mp4'))) return decoded;
    return null;
}

// ================================================================
// SEARCH / NAVIGATION / BUILD_URL
// ================================================================
function detectSearchPattern(doc, html, base) {
    const r = { paramName: null, pattern: null, formAction: null, method: 'GET' };
    const forms = doc.querySelectorAll('form');
    for (const f of forms) {
        const inputs = f.querySelectorAll('input[type="text"],input[type="search"],input[name]');
        for (const inp of inputs) {
            const nm = (inp.getAttribute('name') || '').toLowerCase();
            if (['q', 'query', 'search', 's', 'k', 'keyword', 'find'].includes(nm)) {
                r.paramName = nm; r.formAction = f.getAttribute('action') || '/';
                r.method = (f.getAttribute('method') || 'GET').toUpperCase();
                const action = resolve(r.formAction, base);
                r.pattern = action + (action.includes('?') ? '&' : '?') + nm + '={query}'; return r;
            }
        }
    }
    const allJS = html + Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    for (const pat of [/[?&](search)=[^&"']+/gi, /[?&](k)=[^&"']+/gi, /[?&](q)=[^&"']+/gi, /[?&](s)=[^&"']+/gi]) {
        const m = pat.exec(allJS); if (m) { r.paramName = m[1].toLowerCase(); r.pattern = base + '/?' + r.paramName + '={query}'; return r }
    }
    if (!r.paramName) { r.paramName = 'q'; r.pattern = base + '/?q={query}' }
    return r;
}

function detectBuildUrlPatterns(doc, html, base, searchPattern, navigation) {
    const patterns = {};
    patterns.search = searchPattern?.pattern || base + '/?q={query}';
    const catLink = doc.querySelector('a[href*="/category/"],a[href*="/categories/"],a[href*="?c="]');
    if (catLink) {
        const h = catLink.getAttribute('href') || '';
        if (h.includes('?c=')) patterns.category = base + '/?c={slug}';
        else if (h.includes('/categories/')) patterns.category = base + '/categories/{slug}';
        else patterns.category = base + '/category/{slug}';
    } else patterns.category = base + '/?c={slug}';
    if (navigation?.channels?.urlPattern) patterns.channel = base + navigation.channels.urlPattern;
    const pgPatterns = [
        { re: /[?&]page=\d+/, tpl: '?page={N}' },
        { re: /\/page\/\d+/, tpl: '/page/{N}' },
        { re: /\/\d+\.html/, tpl: '/{N}.html' },
        { re: /[?&]from=\d+/, tpl: '?from={N}' }
    ];
    const allContent = html + Array.from(doc.querySelectorAll('a[href]')).map(a => a.getAttribute('href')).join(' ');
    for (const pg of pgPatterns) { if (pg.re.test(allContent)) { patterns.pagination = pg.tpl; break } }
    if (!patterns.pagination) patterns.pagination = '?page={N}';
    patterns.main = new URL(doc.baseURI || base).pathname || '/';
    return patterns;
}

function detectMainPagePath(doc, base, url) {
    const path = new URL(url).pathname, candidates = [path];
    const feedPats = ['/latest-updates', '/newest', '/recent', '/new', '/videos', '/all', '/popular', '/best', '/most-popular'];
    doc.querySelectorAll('a[href]').forEach(a => {
        const h = a.getAttribute('href') || '';
        for (const fp of feedPats) if (h.includes(fp)) { candidates.push(new URL(resolve(h, base)).pathname); break }
    });
    return uniq(candidates).slice(0, 5);
}

function parseJsNav(doc, html, base) {
    const all = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n'), cb = all + '\n' + html;
    const r = { categories: { fromJs: [], fromHtml: [], merged: [] }, channels: { fromJs: [], fromHtml: [], merged: [], urlPattern: null }, sorting: { fromJs: [] } };

    const jC = new Map();
    let cm; const cP = /[?&]c=([A-Za-z0-9_-]+(?:-\d+)?)/g;
    while ((cm = cP.exec(cb)) !== null) { const s = cm[1]; if (!jC.has(s) && s.length > 1) jC.set(s, { title: s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), slug: s }) }
    r.categories.fromJs = [...jC.values()];

    for (const sel of ['a[href*="/categories/"]', 'a[href*="/category/"]', 'a[href*="?c="]']) {
        try {
            const lnk = doc.querySelectorAll(sel);
            if (lnk.length >= 3) {
                lnk.forEach(a => {
                    const href = a.getAttribute('href'), nm = a.textContent.trim();
                    if (href && nm && nm.length > 1 && nm.length < 100) {
                        let sl = '';
                        const cM = href.match(/[?&]c=([^&]+)/), pM = href.match(/\/categor(?:y|ies)\/([^/?]+)/);
                        sl = cM ? cM[1] : pM ? pM[1] : href.split('/').filter(Boolean).pop() || '';
                        r.categories.fromHtml.push({ title: nm, slug: sl });
                    }
                }); break;
            }
        } catch { }
    }

    const mm = new Map();
    r.categories.fromJs.forEach(c => mm.set(c.slug, c));
    r.categories.fromHtml.forEach(c => { if (!mm.has(c.slug)) mm.set(c.slug, c) });
    r.categories.merged = [...mm.values()];

    // Channels
    for (const sel of ['a[href*="/channels/"]', 'a[href*="/channel/"]']) {
        try {
            doc.querySelectorAll(sel).forEach(a => {
                const href = a.getAttribute('href'), nm = a.textContent.trim();
                if (href && nm) { const sl = href.split('/').filter(Boolean).pop() || ''; r.channels.fromHtml.push({ title: nm, slug: sl }) }
            }); break;
        } catch { }
    }
    r.channels.merged = r.channels.fromHtml;
    const chLink = doc.querySelector('a[href*="/channels/"],a[href*="/channel/"]');
    r.channels.urlPattern = chLink ? ((chLink.getAttribute('href') || '').includes('/channels/') ? '/channels/{slug}' : '/channel/{slug}') : null;

    // Sorting
    const jsS = new Map();
    const svP = /[?&]sort=([a-z0-9_-]+)/gi;
    while ((cm = svP.exec(cb)) !== null) { const v = cm[1]; if (!jsS.has(v)) jsS.set(v, { label: v.replace(/[-_]/g, ' '), value: v }) }
    r.sorting.fromJs = [...jsS.values()];

    return r;
}

// ================================================================
// PLAYER ANALYSIS
// ================================================================
const JS_CFG = [
    { type: 'kt_player', fields: [{ re: /video_url\s*[:=]\s*['"]([^'"]+)['"]/, labelRe: /video_url_text\s*[:=]\s*['"]([^'"]+)['"]/, fb: '480p' }, { re: /video_alt_url\s*[:=]\s*['"]([^'"]+)['"]/, labelRe: /video_alt_url_text\s*[:=]\s*['"]([^'"]+)['"]/, fb: '720p' }] },
    { type: 'xvideos', fields: [{ re: /setVideoUrlHigh\s*\(\s*['"]([^'"]+)['"]\)/, fb: '720p' }, { re: /setVideoUrlLow\s*\(\s*['"]([^'"]+)['"]\)/, fb: '480p' }, { re: /setVideoHLS\s*\(\s*['"]([^'"]+)['"]\)/, fb: 'HLS' }] },
    { type: 'jwplayer', fields: [{ re: /file\s*:\s*['"]([^'"]+\.(?:mp4|m3u8)[^'"]*)['"]/, fb: 'auto' }] }
];

function analyzePlayer(doc, allJS, base) {
    const r = { sources: [], jsConfigs: [], jsonEncodings: [], qualityMap: {}, videoUrlTemplates: [], player: null };

    // <video source>
    doc.querySelectorAll('video source, source').forEach(s => {
        const src = s.getAttribute('src') || s.getAttribute('data-src'); if (!src) return;
        const size = s.getAttribute('size'), label = s.getAttribute('label'), title = s.getAttribute('title');
        const qa = size || label || title; if (qa === 'preview') return;
        const ql = qa ? (/^\d+$/.test(qa) ? qa + 'p' : qa) : null;
        const url = resolve(src, base);
        if (ql && !r.qualityMap[ql]) r.qualityMap[ql] = { url, source: '<source>', method: size ? 'size-attr' : 'label-attr', domain: hostOf(url) };
        r.sources.push({ src: url, size, label, title });
    });

    // JS configs
    for (const cfg of JS_CFG) {
        const found = [];
        for (const f of cfg.fields) {
            const m = allJS.match(f.re); if (m) {
                let label = f.fb;
                if (f.labelRe) { const lm = allJS.match(f.labelRe); if (lm) label = lm[1] }
                const url = resolve(m[1].replace(/\\\//g, '/'), base);
                found.push({ quality: label, url, urlEncoded: null, decoded: false });
                if (!r.qualityMap[label]) r.qualityMap[label] = { url, source: 'js-config', method: cfg.type, domain: hostOf(url) };
            }
        }
        if (found.length) r.jsConfigs.push({ type: cfg.type, fields: found, regex: cfg.fields[0].re.source });
    }

    // JSON encodings (dataEncodings etc)
    for (const vn of ['dataEncodings', 'sources', 'media_sources', 'video_sources']) {
        const idx = allJS.indexOf(vn); if (idx === -1) continue;
        const as = allJS.indexOf('[', idx); if (as === -1 || as - idx > 50) continue;
        try {
            let depth = 0, ae = -1;
            for (let i = as; i < Math.min(allJS.length, as + 10000); i++) { if (allJS[i] === '[') depth++; else if (allJS[i] === ']') { depth--; if (depth === 0) { ae = i; break } } }
            if (ae === -1) continue;
            JSON.parse(allJS.substring(as, ae + 1)).forEach(item => {
                const u = item.filename || item.file || item.src || item.url || '';
                const q = item.quality || item.label || item.res || item.height || '';
                if (!u) return;
                const url = (u.indexOf('//') === 0 ? 'https:' : '') + u.replace(/\\\//g, '/');
                const key = String(q).toLowerCase() === 'auto' ? 'auto' : (q ? (/^\d+$/.test(q) ? q + 'p' : q) : 'auto');
                r.jsonEncodings.push({ variable: vn, quality: key });
                if (!r.qualityMap[key]) r.qualityMap[key] = { url, source: 'json-encoding', method: vn, domain: hostOf(url) };
            });
        } catch { }
    }

    // HLS fallback
    const hlsM = allJS.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
    if (hlsM && !r.qualityMap.auto) r.qualityMap.auto = { url: hlsM[1], source: 'js-regex', method: 'm3u8', domain: hostOf(hlsM[1]) };

    // mp4 brute fallback
    if (!Object.keys(r.qualityMap).length) {
        const mp4R = /(https?:\/\/[^\s"']+\.mp4[^\s"']*)/g; let mm, c = 0;
        while ((mm = mp4R.exec(allJS)) && c < 5) {
            const u = mm[1];
            if (u.includes('preview') || u.includes('thumb') || /\/tmb\/\d+\/\d+\.mp4/.test(u)) continue;
            const qm2 = u.match(/_(\d+)\.mp4/); const lb = qm2 ? qm2[1] + 'p' : ('src' + c);
            if (!r.qualityMap[lb]) { r.qualityMap[lb] = { url: u, source: 'js-regex', method: 'mp4-brute', domain: hostOf(u) }; c++ }
        }
    }

    // URL templates
    for (const [q, info] of Object.entries(r.qualityMap)) {
        try {
            const u = new URL(info.url);
            let tpl = u.pathname.replace(/\/\d{4,}\//g, '/{id}/').replace(/\/[a-f0-9]{16,}\//gi, '/{hash}/').replace(/_\d{3,4}\.mp4/, '_{quality}.mp4');
            r.videoUrlTemplates.push({ template: u.origin + tpl, domain: info.domain, variables: tpl.match(/\{[^}]+\}/g) || [] });
        } catch { }
    }
    const seen = new Set();
    r.videoUrlTemplates = r.videoUrlTemplates.filter(t => { if (seen.has(t.template)) return false; seen.add(t.template); return true });

    // KT decode
    if (r.jsConfigs.some(c => c.type === 'kt_player')) {
        const licenseCode = extractLicenseCode(allJS, allJS);
        if (licenseCode) {
            r.ktDecode = { licenseCode };
            let encryptionUsed = false;
            for (const [q, info] of Object.entries(r.qualityMap)) {
                if (info.url && info.url.includes('/function/')) {
                    encryptionUsed = true;
                    const decoded = tryKtDecode(info.url, licenseCode);
                    if (decoded) { info.urlEncoded = info.url; info.url = decoded; info.decoded = true; info.domain = hostOf(decoded) }
                }
            }
            for (const cfg of r.jsConfigs) {
                if (cfg.type !== 'kt_player') continue;
                for (const f of cfg.fields) {
                    if (f.url && f.url.includes('/function/')) {
                        encryptionUsed = true;
                        const decoded = tryKtDecode(f.url, licenseCode);
                        if (decoded) { f.urlEncoded = f.url; f.url = decoded; f.decoded = true }
                    }
                }
            }
            r.ktDecode.encryptionUsed = encryptionUsed;
        }
    }

    // Redirect chain detection
    const allVideoSrcs = [...r.sources.map(v => v.src), ...Object.values(r.qualityMap).map(v => v.url)].filter(Boolean);
    r.redirectChain = detectRedirectPattern(allVideoSrcs, hostOf(base));
    r.kvsEngine = detectKvsEngine(allJS, allJS);

    // Player name
    const PLAYER_SIGS = [{ name: 'uppod', pats: ['uppod'] }, { name: 'jwplayer', pats: ['jwplayer'] }, { name: 'videojs', pats: ['videojs', 'video-js'] }, { name: 'flowplayer', pats: ['flowplayer'] }, { name: 'plyr', pats: ['new Plyr', 'Plyr.setup'] }];
    const lcJS = allJS.toLowerCase();
    for (const p of PLAYER_SIGS) for (const pat of p.pats) if (lcJS.includes(pat.toLowerCase())) { r.player = p.name; break }

    return r;
}

function detectRedirectPattern(videoUrls, siteHost) {
    const result = { hasRedirect: false, patterns: [], requiresFollow: false, getFilePattern: false };
    for (const vu of videoUrls) {
        const u = typeof vu === 'string' ? vu : (vu.src || vu.url || '');
        if (!u) continue;
        if (/\/get_file\/\d+\/[a-f0-9]+\//i.test(u)) {
            result.hasRedirect = true; result.getFilePattern = true;
            result.patterns.push({ type: 'kvs_get_file', url: u, description: '/get_file/{id}/{hash}/ → 302 → CDN', workerMode: 'follow' });
        }
        // v7: distinguish signed_redirect vs signed_cdn
        if (/[?&](sign|token|hash)=/.test(u)) {
            try {
                const videoHost = new URL(u).hostname;
                const isCdn = /(cdn|edge|stream|media|video|mobile)/i.test(videoHost);
                if (!isCdn && videoHost === siteHost) {
                    result.hasRedirect = true;
                    result.patterns.push({ type: 'signed_redirect', url: u, description: 'Signed URL → 302 → CDN', workerMode: 'follow' });
                }
                // CDN URLs with signatures → no redirect needed
            } catch { }
        }
        try {
            const videoHost = new URL(u, 'https://' + siteHost).hostname;
            if (videoHost !== siteHost && !/cdn|stream|media|edge|video/i.test(videoHost))
                result.patterns.push({ type: 'different_host', url: u, videoHost, description: 'Video URL on different host' });
        } catch { }
    }
    result.requiresFollow = result.getFilePattern || result.patterns.some(p => p.type === 'signed_redirect');
    return result;
}

// ================================================================
// WORKER VERDICT v7 — no contradictions with PROTECTION
// ================================================================
function assessWorkerNecessity(prot, player, redirectChain, kvsEngine) {
    const reasons = [];
    let required = false;
    if (prot?.cloudflare) { reasons.push({ reason: 'Cloudflare bypass', type: prot.cloudflareTurnstile ? 'critical' : 'cors' }); required = true }
    if (prot?.ddosGuard) { reasons.push({ reason: 'DDoS-Guard bypass', type: 'cors' }); required = true }
    if (prot?.ageGate?.type === 'cookie-flag' || prot?.ageGate?.type === 'post-form') { reasons.push({ reason: 'Age gate cookies', type: 'cookies' }); required = true }
    // v7: only add referer reason if actually detected
    if (prot?.refererProtected) { reasons.push({ reason: 'Referer header required', type: 'headers' }); required = true }
    // v7: only add redirect if really requires follow (not CDN signed URLs)
    if (redirectChain?.requiresFollow) { reasons.push({ reason: 'Follow 302 redirects', type: 'redirect' }); required = true }
    if (kvsEngine?.isKvs) { reasons.push({ reason: 'KVS session-bound URLs', type: 'resolve-page' }); required = true }
    if (prot?.drm) { reasons.push({ reason: 'DRM protected', type: 'impossible' }) }

    let mode = 'none';
    if (reasons.some(r => r.type === 'impossible')) mode = 'impossible';
    else if (reasons.some(r => r.type === 'resolve-page')) mode = 'resolve-page';
    else if (reasons.some(r => r.type === 'redirect')) mode = 'follow-redirect';
    else if (reasons.some(r => r.type === 'critical')) mode = 'headless';
    else if (required) mode = 'cors-proxy';

    return { required, mode, reasons, summary: required ? `Worker needed: ${mode}` : 'Direct fetch possible' };
}

// ================================================================
// CLEAN URL RULES
// ================================================================
function detectCleanUrlRules(html, allJS) {
    const cb = html + '\n' + allJS;
    const rules = [];
    if (cb.includes('\\/')) rules.push('unescape-backslash');
    if (/src=["']\/\/[^"']+/.test(cb)) rules.push('add-protocol');
    if (/src=["']\/[^/"']/.test(cb)) rules.push('prepend-host');
    if (/\/function\/\d+\//.test(cb)) rules.push('strip-function-prefix');
    if (/[?&]rnd=\d+/.test(cb) || /[?&]br=\d+/.test(cb)) rules.push('strip-cache-params');
    return rules;
}

// ================================================================
// CDN WHITELIST v7 — with patterns
// ================================================================
function buildWhitelist(base, player, cards, cdnPatterns) {
    const domains = new Map();
    domains.set(hostOf(base), { domain: hostOf(base), role: 'site', required: true });
    for (const [q, info] of Object.entries(player?.qualityMap || {})) {
        const d = info.domain;
        if (d && !domains.has(d)) domains.set(d, { domain: d, role: 'video CDN (' + q + ')', required: true });
    }
    (cards?.sampleCards || []).forEach(c => {
        const d = hostOf(c.thumbnail || '');
        if (d && d !== hostOf(base) && !domains.has(d)) domains.set(d, { domain: d, role: 'thumb CDN', required: false });
    });

    const all = [...domains.values()];
    const required = all.filter(d => d.required);
    const code = 'const ALLOWED_TARGETS = [\n' + required.map(d => `  "${d.domain}",  // ${d.role}`).join('\n') + '\n];';
    return { required, all, code, cdnPatterns: cdnPatterns || [] };
}

function isVideoScript(src) {
    if (!src) return false;
    if (/jquery|react|vue|angular|bootstrap|analytics|tracking|ads|cdn|polyfill|webpack|chunk/i.test(src)) return false;
    return /video|clip|media|stream|embed|config|player/i.test(src);
}

// ================================================================
// CATALOG ANALYSIS
// ================================================================
async function runCatalogAnalysis() {
    const ui = $('targetUrl'), url = ui?.value.trim();
    if (!url) { setStatus('❌ URL!', 'error'); return }
    try { new URL(url) } catch { setStatus('❌ Bad URL', 'error'); return }
    const base = baseOf(url), btn = $('btnAnalyze');
    if (btn) { btn.disabled = true; btn.textContent = '⏳' }
    $('results').style.display = 'none'; updCI('hidden'); updW(!!getW()); transportLog = [];
    const result = { _meta: { analyzedUrl: url, baseUrl: base, analyzedAt: new Date().toISOString(), mode: 'catalog', testWord: getTestWord(), tool: 'v7.0.0' } };

    try {
        setStatus('📥', 'loading'); setProgress(10, '📡');
        let html;
        try { html = await fetchPage(url) } catch (e) {
            setProgress(10, '❌', 'cors-error'); setStatus('❌ ' + e.message, 'error');
            result._error = { type: isCE(e) ? 'CORS' : 'FETCH', message: e.message };
            catalogData = result; analysisResult = buildFinalJSON(); displayResults(analysisResult); return;
        }
        const doc = parseH(html); setProgress(20, 'DOM');
        const fw = []; // frameworks
        const src = html + Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
        [['jQuery', ['jquery', 'jQuery']], ['React', ['data-reactroot', 'ReactDOM']], ['Vue.js', ['__vue__']]].forEach(([n, ps]) => { for (const p of ps) if (src.includes(p)) { fw.push(n); break } });

        setProgress(30, 'Prot'); result.protection = aProt(doc, html, base); result.encoding = { charset: (doc.querySelector('meta[charset]')?.getAttribute('charset') || 'N/A').toUpperCase() };
        setProgress(40, 'Cards'); result.videoCards = aCards(doc, base);
        setProgress(50, 'Nav'); result.navigation = parseJsNav(doc, html, base);
        setProgress(55, 'BuildUrl'); result.buildUrlPatterns = detectBuildUrlPatterns(doc, html, base, result.searchPattern, result.navigation);
        setProgress(60, 'Search'); result.searchPattern = detectSearchPattern(doc, html, base);
        setProgress(65, 'MainPage'); result.mainPagePaths = detectMainPagePath(doc, base, url);
        setProgress(68, 'CleanUrl'); result.cleanUrlRules = detectCleanUrlRules(html, Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n'));
        setProgress(70, 'Arch');
        const jsReq = (() => { const root = doc.querySelector('#app,#root,#__next'); if (root && root.children.length <= 3) return 'yes'; if (doc.querySelectorAll('*').length < 80) return 'yes'; if (result.videoCards.found) return 'no'; return 'no' })();
        result.architecture = { jsRequired: jsReq, frameworks: uniq(fw), recommendation: { method: jsReq === 'yes' ? 'Headless' : 'CSS+XPath', tools: jsReq === 'yes' ? 'Puppeteer' : 'Cheerio', transport: result.protection.cloudflare ? 'Worker' : 'Proxy/direct' } };
        result._transportLog = transportLog;
        catalogData = result; videoPageData = null; additionalAnalyses = {};
        analysisHistory.push({ type: 'catalog', url, time: new Date().toISOString() });
        analysisResult = buildFinalJSON(); displayResults(analysisResult);
        setProgress(100, '✅'); setStatus('✅ Каталог! Для видео → 🎬', 'success');
    } catch (e) { setStatus('❌ ' + e.message, 'error') }
    finally { if (btn) { btn.disabled = false; btn.textContent = isVideoMode() ? '🎬 Анализ видео' : '🚀 Анализ каталога' } updMerge() }
}

// ================================================================
// VIDEO PAGE ANALYSIS
// ================================================================
async function runVideoAnalysis() {
    const ui = $('targetUrl'), url = ui?.value.trim();
    if (!url) { setStatus('❌ URL!', 'error'); return }
    const base = catalogData ? catalogData._meta.baseUrl : baseOf(url);
    const btn = $('btnAnalyze');
    if (btn) { btn.disabled = true; btn.textContent = '🎬⏳' }
    updCI('hidden'); transportLog = [];
    const vd = { analyzed: false, url };

    try {
        setStatus('🎬 Видео...', 'loading'); setProgress(15, '🎬', 'video-mode');
        const html = await fetchPage(url);
        const doc = parseH(html); vd.analyzed = true; vd.title = doc.title;
        const allInline = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
        const allContent = html + '\n' + allInline;

        setProgress(30, '🎬 Strategies...');
        const stratResult = detectAllStrategies(html, allInline, base);
        vd.strategies = stratResult.strategies;
        vd.activeStrategies = stratResult.activeMap;
        vd.strategyOrder = stratResult.strategyOrder;
        vd.strategySummary = stratResult.strategySummary;
        vd.deadStrategies = stratResult.deadStrategies;
        vd.debugReport = stratResult.debugReport;

        setProgress(45, '🎬 Player...');
        vd.playerStructure = analyzePlayer(doc, allContent, base);

        setProgress(55, '🎬 ExtJS...');
        const extSrcs = Array.from(doc.querySelectorAll('script[src]')).map(s => s.getAttribute('src')).filter(Boolean);
        vd.externalScripts = [];
        const videoScripts = extSrcs.filter(isVideoScript).slice(0, 3);
        for (const vs of videoScripts) {
            const full = resolve(vs, base);
            try {
                logT('ExtJS:' + vs);
                const jsCode = await fetchPage(full);
                const info = { src: vs, fetched: true, size: jsCode.length, strategiesFound: 0 };
                const extP = analyzePlayer(doc, jsCode, base);
                if (Object.keys(extP.qualityMap).length) {
                    info.strategiesFound = Object.keys(extP.qualityMap).length;
                    Object.assign(vd.playerStructure.qualityMap, extP.qualityMap);
                    vd.playerStructure.jsConfigs.push(...extP.jsConfigs);
                    if (extP.kvsEngine?.isKvs && !vd.playerStructure.kvsEngine?.isKvs) vd.playerStructure.kvsEngine = extP.kvsEngine;
                }
                vd.externalScripts.push(info);
            } catch (e) { vd.externalScripts.push({ src: vs, fetched: false, error: e.message }) }
        }

        // KT Player analysis
        setProgress(60, '🎬 KT...');
        if (vd.playerStructure?.ktDecode || vd.playerStructure?.jsConfigs?.some(c => c.type === 'kt_player')) {
            const ktSrc = detectKtPlayerScript(doc, extSrcs);
            if (ktSrc) {
                try {
                    logT('KT: ' + ktSrc);
                    const ktCode = await fetchPage(resolve(ktSrc, base));
                    const analysis = analyzeKtDecodeFunction(ktCode);
                    if (!vd.playerStructure.ktDecode) vd.playerStructure.ktDecode = {};
                    vd.playerStructure.ktDecode.analysis = analysis;
                    vd.playerStructure.ktDecode.ktPlayerJsUrl = ktSrc;
                    vd.playerStructure.ktDecode.ktPlayerJsSize = ktCode.length;
                    logT('KT: ' + (analysis.found ? '✅ found' : '❌ not found'), analysis.found ? 'success' : 'fail');
                } catch (e) { logT('KT: ' + e.message, 'fail') }
            }
        }

        // CDN resolution
        setProgress(70, '🎬 CDN...');
        if (vd.playerStructure?.redirectChain?.requiresFollow) {
            vd.redirectResolution = [];
            const w = getW();
            if (w) {
                try {
                    logT('Resolve-page: ' + url.substring(0, 60));
                    const rpUrl = w + '/resolve-page?url=' + encodeURIComponent(url) + '&max=8';
                    const a = new AbortController, t = setTimeout(() => a.abort(), 25000);
                    const r = await fetch(rpUrl, { signal: a.signal }); clearTimeout(t);
                    if (r.ok) {
                        const data = await r.json();
                        logT('Resolve-page: ' + (data.redirects || 0) + ' hops', data.error ? 'fail' : 'success');
                        vd.redirectResolution.push({
                            original: data.videoUrl || url, final: data.final, chain: data.chain,
                            redirectCount: data.redirects || 0, contentType: data.contentType,
                            contentLength: data.contentLength, resumable: data.resumable
                        });
                    }
                } catch (e) { logT('Resolve-page: ' + e.message, 'fail') }
            }
        }

        setProgress(80, '🎬 Protection...');
        vd.protection = aProt(doc, html, base);
        vd.cleanUrlRules = detectCleanUrlRules(html, allInline);
        vd.workerVerdict = assessWorkerNecessity(vd.protection, vd.playerStructure, vd.playerStructure?.redirectChain, vd.playerStructure?.kvsEngine);

        setProgress(85, '🎬 Whitelist...');
        // v7: CDN patterns
        const allDomains = [...Object.values(vd.playerStructure?.qualityMap || {}).map(v => v.domain), ...(catalogData?.videoCards?.sampleCards || []).map(c => hostOf(c.thumbnail || ''))].filter(Boolean);
        const cdnPatterns = detectCdnPattern(uniq(allDomains));
        vd.workerWhitelist = buildWhitelist(base, vd.playerStructure, catalogData?.videoCards, cdnPatterns);

        // Add resolved CDN domains
        if (vd.redirectResolution?.length) {
            for (const rr of vd.redirectResolution) {
                if (rr.final) { const d = hostOf(rr.final); if (d && !vd.workerWhitelist.required.some(w => w.domain === d)) vd.workerWhitelist.required.push({ domain: d, role: 'CDN (resolved)', required: true }) }
                if (rr.chain) for (const cu of rr.chain) { const d = hostOf(cu); if (d && !vd.workerWhitelist.required.some(w => w.domain === d)) vd.workerWhitelist.required.push({ domain: d, role: 'CDN (chain)', required: true }) }
            }
            vd.workerWhitelist.code = 'const ALLOWED_TARGETS = [\n' + vd.workerWhitelist.required.map(d => `  "${d.domain}",  // ${d.role}`).join('\n') + '\n];';
        }

        setProgress(90, '🎬 Done');
    } catch (e) { vd.error = e.message }

    vd._transportLog = transportLog; videoPageData = vd;
    analysisHistory.push({ type: 'video', url, time: new Date().toISOString() });
    analysisResult = buildFinalJSON(); displayResults(analysisResult);
    setProgress(100, '✅'); setStatus(catalogData ? '✅ Каталог + Видео' : '✅ Видео', 'success');
    if (btn) { btn.disabled = false; btn.textContent = '🎬 Анализ видео' }
    updMerge();
}

// ================================================================
// REDIRECT ANALYSIS (manual CDN URL)
// ================================================================
async function runRedirectAnalysis() {
    const redirectUrl = prompt('CDN URL (финальная ссылка после редиректа):', '');
    if (!redirectUrl || !redirectUrl.startsWith('http')) { setStatus('❌ URL http...', 'error'); return }
    const btn = $('btnAnalyze');
    if (btn) { btn.disabled = true; btn.textContent = '🔄⏳' }
    setStatus('🔄 Redirect...', 'loading'); setProgress(10, '🔄', 'video-mode'); transportLog = [];

    try {
        const w = getW(); if (!w) { setStatus('❌ Worker', 'error'); return }
        setProgress(30, '🔄 Resolving...');
        const data = await resolveRedirectChain(redirectUrl, 8);

        setProgress(60, '🔄 Analyzing...');
        let urlInfo = {};
        try { const u = new URL(data.final || redirectUrl); urlInfo = { hostname: u.hostname, pathname: u.pathname, params: Object.fromEntries(u.searchParams.entries()) } } catch { }
        const cdnInfo = {
            domain: urlInfo.hostname, resumable: data.resumable || false,
            contentType: data.contentType || '', contentLength: data.contentLength || '',
            size: data.contentLength ? ((parseInt(data.contentLength) / 1048576).toFixed(1) + ' MB') : null,
            quality: (urlInfo.pathname || '').match(/_(\d+p)\./)?.[1] || null,
            videoId: (urlInfo.pathname || '').match(/\/(\d{4,})\//)?.[1] || null,
            urlTemplate: urlInfo.hostname + (urlInfo.pathname || '').replace(/\/\d{4,}\//g, '/{id}/').replace(/[a-f0-9]{20,}/g, '{hash}'),
            note: 'CDN URL analyzed from manual redirect input'
        };

        setProgress(80, '🔄 Whitelist...');
        if (!videoPageData) videoPageData = { analyzed: true, url: redirectUrl, workerWhitelist: { required: [], all: [], code: '' } };
        if (!videoPageData.redirectResolution) videoPageData.redirectResolution = [];
        videoPageData.redirectResolution.push({
            original: redirectUrl, final: data.final || redirectUrl, chain: data.chain || [redirectUrl],
            redirectCount: data.redirects || 0, contentType: data.contentType, contentLength: data.contentLength, resumable: data.resumable
        });

        // Add CDN to whitelist
        const domainsToAdd = new Set([cdnInfo.domain]);
        if (data.chain) data.chain.forEach(cu => { try { domainsToAdd.add(new URL(cu).hostname) } catch { } });
        if (videoPageData.workerWhitelist) {
            for (const d of domainsToAdd) {
                if (d && !videoPageData.workerWhitelist.required.some(w => w.domain === d))
                    videoPageData.workerWhitelist.required.push({ domain: d, role: 'CDN (redirect)', required: true });
            }
            videoPageData.workerWhitelist.code = 'const ALLOWED_TARGETS = [\n' + videoPageData.workerWhitelist.required.map(d => `  "${d.domain}",  // ${d.role}`).join('\n') + '\n];';
        }

        additionalAnalyses.redirect = cdnInfo;
        analysisHistory.push({ type: 'redirect', url: redirectUrl, time: new Date().toISOString() });
        analysisResult = buildFinalJSON();
        if (analysisResult) analysisResult.CDN_REDIRECT = cdnInfo;
        displayResults(analysisResult); setProgress(100, '✅'); setStatus('✅ CDN: ' + cdnInfo.domain, 'success');
    } catch (e) { setStatus('❌ ' + e.message, 'error') }
    if (btn) { btn.disabled = false; btn.textContent = isVideoMode() ? '🎬 Анализ видео' : '🚀 Анализ каталога' }
    updMerge();
}

// ================================================================
// v7: ADDITIONAL PAGE ANALYSIS (categories, search, etc.)
// ================================================================
async function analyzeAdditionalPage(type, url) {
    if (!url) {
        url = prompt(type === 'categories' ? 'URL страницы категорий:' : type === 'search' ? 'URL результатов поиска:' : 'URL:', '');
        if (!url || !url.startsWith('http')) return;
    }
    setStatus('📥 ' + type + '...', 'loading'); setProgress(20, type);
    try {
        const html = await fetchPage(url);
        const doc = parseH(html);
        const base = catalogData?._meta?.baseUrl || baseOf(url);

        if (type === 'categories') {
            const nav = parseJsNav(doc, html, base);
            if (nav.categories.merged.length > (catalogData?.navigation?.categories?.merged?.length || 0)) {
                if (catalogData?.navigation) catalogData.navigation.categories = nav.categories;
                additionalAnalyses.categories = { url, count: nav.categories.merged.length };
                setStatus('✅ ' + nav.categories.merged.length + ' категорий найдено!', 'success');
            } else {
                // Try collecting all links as potential categories
                const catLinks = [];
                doc.querySelectorAll('a[href]').forEach(a => {
                    const href = a.getAttribute('href') || '', text = a.textContent.trim();
                    if (text && text.length > 1 && text.length < 60 && href.length > 5 && !href.includes('javascript') && !href.includes('#')) {
                        catLinks.push({ title: text, slug: href.split('/').filter(Boolean).pop() || '', url: resolve(href, base) });
                    }
                });
                if (catLinks.length > 5) {
                    if (catalogData?.navigation) catalogData.navigation.categories.merged = catLinks;
                    additionalAnalyses.categories = { url, count: catLinks.length, method: 'all-links' };
                    setStatus('✅ ' + catLinks.length + ' ссылок (нужна ручная фильтрация)', 'success');
                } else setStatus('❌ Категории не найдены', 'error');
            }
        }
        if (type === 'search') {
            const cards = aCards(doc, base);
            additionalAnalyses.search = { url, cardsFound: cards.totalFound, pattern: url };
            // Try to detect real search pattern from URL
            try {
                const u = new URL(url);
                const params = Object.fromEntries(u.searchParams.entries());
                for (const [k, v] of Object.entries(params)) {
                    if (['q', 'query', 'search', 's', 'k'].includes(k)) {
                        if (catalogData) catalogData.searchPattern = { paramName: k, pattern: u.origin + u.pathname + '?' + k + '={query}', method: 'GET' };
                        break;
                    }
                }
                // Slug-based search detection
                if (u.pathname.includes('/search/')) {
                    additionalAnalyses.search.slugBased = true;
                    additionalAnalyses.search.note = 'Slug-based search detected: ' + u.pathname;
                }
            } catch { }
            setStatus('✅ Поиск: ' + cards.totalFound + ' карточек', 'success');
        }

        analysisHistory.push({ type, url, time: new Date().toISOString() });
        analysisResult = buildFinalJSON(); displayResults(analysisResult);
    } catch (e) { setStatus('❌ ' + e.message, 'error') }
    setProgress(100, '✅'); updMerge();
}

// ================================================================
// ROUTER
// ================================================================
async function runFullAnalysis() {
    const pm = ($('proxySelect') || {}).value;
    if (pm === 'direct-test') return runDirectTest();
    if (isVideoMode()) return runVideoAnalysis();
    return runCatalogAnalysis();
}

async function runDirectTest() {
    const url = $('targetUrl')?.value.trim();
    if (!url) return setStatus('❌ URL!', 'error');
    setStatus('🧪', 'loading'); setProgress(10, '🧪');
    const checks = [];
    try {
        const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
        if (r.ok) { const html = await r.text(); checks.push({ icon: '✅', label: 'Direct fetch', hint: html.length + ' bytes' }) }
        else checks.push({ icon: '❌', label: 'Direct fetch', hint: 'HTTP ' + r.status });
    } catch (e) { checks.push({ icon: '❌', label: 'Direct fetch', hint: e.message }) }
    analysisResult = { _meta: { url, mode: 'direct-test' }, directTest: { checks } };
    let h = '<div class="ab"><h3>🧪 Direct Test</h3><div class="acg">';
    checks.forEach(c => { h += `<div class="aci"><span class="aci-i">${c.icon}</span><span class="aci-l">${esc(c.label)}</span><span class="aci-v">${esc(c.hint)}</span></div>` });
    h += '</div></div>';
    $('results').style.display = 'block'; $('archReport').innerHTML = h;
    $('jsonFormatted').innerHTML = synHL(JSON.stringify(analysisResult, null, 2));
    $('jsonRaw').value = JSON.stringify(analysisResult, null, 2);
    showTab('arch'); setProgress(100, '✅'); setStatus('🧪 Done', 'success');
    $('btnAnalyze').disabled = false; $('btnAnalyze').textContent = '🚀 Анализ каталога';
}

// ================================================================
// BUILD FINAL JSON v7 — cumulative from all analyses
// ================================================================
function buildFinalJSON() {
    const r = {};
    const base = catalogData?._meta?.baseUrl || (videoPageData ? baseOf(videoPageData.url) : '');

    r.HOST = base;
    r.NAME = generateNameFromHost(base);
    r.SITE_NAME = base.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*/, '');

    r._meta = { analyzedUrl: catalogData?._meta?.analyzedUrl || videoPageData?.url, baseUrl: base,
        analyzedAt: new Date().toISOString(), mode: (catalogData && videoPageData) ? 'catalog+video' : catalogData ? 'catalog' : 'video',
        testWord: getTestWord(), tool: 'v7.0.0', videoPageUrl: videoPageData?.url || null };

    r.templateIntegration = {
        menuJson: `{ "title": "${r.SITE_NAME}", "playlist_url": "${r.NAME}" }`,
        domainMap: `'${r.SITE_NAME}': '${r.NAME}'`,
        workerWhitelist: `'${r.SITE_NAME}',`
    };

    // Cards
    if (catalogData?.videoCards) r.CARD = catalogData.videoCards;

    // URLs
    r.BUILD_URL = catalogData?.buildUrlPatterns || {};
    r.SEARCH = catalogData?.searchPattern || {};
    if (additionalAnalyses.search) { r.SEARCH._additional = additionalAnalyses.search }
    r.CATEGORIES = catalogData?.navigation?.categories?.merged?.map(c => ({ title: c.title, slug: c.slug })) || [];
    if (additionalAnalyses.categories) { r.CATEGORIES._meta = additionalAnalyses.categories }
    r.CHANNELS = catalogData?.navigation?.channels?.merged?.map(c => ({ title: c.title, slug: c.slug })) || [];
    r.SORT_OPTIONS = catalogData?.navigation?.sorting?.fromJs || [];

    r.URL_SCHEME = { base,
        search: { paramName: r.SEARCH.paramName || 'q', pattern: r.SEARCH.pattern || base + '/?q={query}', example: base + '/?q=' + getTestWord() },
        category: { paramName: 'c', pattern: r.BUILD_URL?.category || base + '/?c={slug}' },
        channel: { pattern: catalogData?.navigation?.channels?.urlPattern ? base + catalogData.navigation.channels.urlPattern : null },
        sorting: { options: r.SORT_OPTIONS, pattern: r.BUILD_URL?.sorting || base + '/?sort={value}' },
        pagination: { pattern: r.BUILD_URL?.pagination || '?page={N}' }
    };

    // Video strategies
    if (videoPageData?.strategies) {
        r.STRATEGIES = videoPageData.strategies;
        r.ACTIVE_STRATEGIES = videoPageData.activeStrategies;
        r.strategyOrder = videoPageData.strategyOrder;
        r.strategySummary = videoPageData.strategySummary;
        if (videoPageData.deadStrategies?.length) r.DEAD_STRATEGIES = videoPageData.deadStrategies;
    }

    // KT Decode
    if (videoPageData?.playerStructure?.ktDecode) {
        r.KT_DECODE = { ...videoPageData.playerStructure.ktDecode };
    }

    // Debug report
    if (videoPageData?.debugReport) r.DEBUG_REPORT = videoPageData.debugReport;

    // Clean URL
    r.CLEAN_URL_RULES = videoPageData?.cleanUrlRules || catalogData?.cleanUrlRules || [];

    // Redirect
    if (videoPageData?.playerStructure?.redirectChain?.requiresFollow) {
        r.REDIRECT = { requiresFollow: true, getFilePattern: videoPageData.playerStructure.redirectChain.getFilePattern,
            patterns: videoPageData.playerStructure.redirectChain.patterns };
        if (videoPageData.redirectResolution?.length) {
            r.REDIRECT.resolved = videoPageData.redirectResolution.map(rr => ({
                original: rr.original?.substring(0, 100), final: rr.final?.substring(0, 100),
                chain: rr.chain, redirectCount: rr.redirectCount, contentType: rr.contentType,
                contentLength: rr.contentLength, resumable: rr.resumable
            }));
        }
    }

    // KVS
    r.KVS_ENGINE = videoPageData?.playerStructure?.kvsEngine || { isKvs: false, confidence: 0, markers: {}, note: 'Not KVS' };

    // Protection
    const prot = catalogData?.protection || videoPageData?.protection;
    if (prot) r.PROTECTION = prot;

    // Worker
    if (videoPageData?.workerVerdict) r.WORKER_VERDICT = videoPageData.workerVerdict;
    if (videoPageData?.workerWhitelist) r.WORKER_WHITELIST = videoPageData.workerWhitelist;

    // CDN Redirect
    if (additionalAnalyses.redirect) r.CDN_REDIRECT = additionalAnalyses.redirect;

    // Architecture
    r.ARCHITECTURE = catalogData?.architecture || { jsRequired: 'unknown', frameworks: [], recommendation: {} };
    r.ENCODING = catalogData?.encoding || {};
    r.MAIN_PAGE_PATHS = catalogData?.mainPagePaths || [];

    // External scripts
    if (videoPageData?.externalScripts?.length) r.EXTERNAL_SCRIPTS = videoPageData.externalScripts;

    // Transport log
    r._transportLog = transportLog;

    // Analysis history
    if (analysisHistory.length) r._analysisHistory = analysisHistory;

    return r;
}

// ================================================================
// ARCHITECTURE RENDER v7 — with interactive hints
// ================================================================
function genArch(d) {
    if (d.directTest) return '';
    let h = '';

    // Analysis History
    if (analysisHistory.length > 1) {
        h += '<div class="history-block"><h4>📋 История анализов</h4>';
        analysisHistory.forEach(a => {
            const icon = a.type === 'catalog' ? '📦' : a.type === 'video' ? '🎬' : a.type === 'redirect' ? '🔄' : '📄';
            h += `<div class="history-item"><span class="hi-icon">${icon}</span><span class="hi-url">${esc((a.url || '').substring(0, 60))}</span><span class="hi-type">${esc(a.type)}</span></div>`;
        });
        h += '</div>';
    }

    // ── CARDS ──
    const cards = d.CARD;
    if (cards?.found) {
        h += `<div class="ab"><h3>🎯 Карточки (${cards.totalFound})</h3><table class="st"><tr><th>Поле</th><th>Селектор</th></tr>`;
        h += `<tr><td><strong>container</strong></td><td><code>${esc(cards.container)}</code></td></tr>`;
        h += `<tr><td><strong>link</strong></td><td><code>${esc(cards.link || 'a[href]')}</code></td></tr>`;
        h += `<tr><td><strong>title</strong></td><td><code>${esc(cards.title || '—')}</code></td></tr>`;
        h += `<tr><td><strong>thumb</strong></td><td><code>${esc(cards.thumb || 'img')}</code> [${esc(cards.thumbAttr || 'src')}]</td></tr>`;
        h += `<tr><td><strong>duration</strong></td><td><code>${esc(cards.duration || '—')}</code></td></tr>`;
        h += '</table>';
        if (cards.sampleCards?.length) {
            h += '<div style="margin-top:8px">';
            cards.sampleCards.slice(0, 3).forEach((c, i) => {
                h += `<div class="sample-card"><strong>#${i + 1}</strong> `;
                if (c.title) h += `<span class="sc-field">title:</span>${esc(c.title)} `;
                if (c.duration) h += `<span class="sc-field">dur:</span>${esc(c.duration)} `;
                if (c.link) h += `<br><span class="sc-field">link:</span><code>${esc(c.link.substring(0, 80))}</code>`;
                h += '</div>';
            });
            h += '</div>';
        }
        // Validation warnings
        if (cards.validationWarnings?.length) {
            h += '<div class="hint-block error"><h4 class="err">⚠️ Проблемы с карточками</h4>';
            cards.validationWarnings.forEach(w => { h += `<p>${esc(w)}</p>` });
            h += '<div class="hint-actions"><button class="hint-btn warn" onclick="promptAlternativeUrl(\'cards\')">🔄 Попробовать другой URL</button></div></div>';
        }
        h += '</div>';
    } else {
        // INTERACTIVE HINT: Cards not found
        h += '<div class="hint-block error"><h4 class="err">❌ Карточки не найдены</h4>';
        h += '<p>На текущей странице не найдены видео-карточки. Возможные причины: страница выбора языка, главная без видео, JS-рендеринг.</p>';
        h += '<div class="hint-actions">';
        h += '<input class="hint-input" id="altUrlCards" placeholder="/videos/ или /most-popular/ или /latest-updates/">';
        h += '<button class="hint-btn primary" onclick="tryAlternativeCards()">📦 Попробовать</button>';
        h += '</div></div>';
    }

    // ── CATEGORIES ──
    const cats = d.CATEGORIES || [];
    if (cats.length > 0) {
        h += `<div class="ab"><h3>📂 Категории (${cats.length})</h3><div class="us-cat-grid">`;
        cats.slice(0, 30).forEach(c => { h += `<div class="us-cat-item"><span class="cat-name">${esc(c.title)}</span><span class="cat-slug">${esc(c.slug)}</span></div>` });
        if (cats.length > 30) h += `<div class="us-cat-item"><span class="cat-name">... +${cats.length - 30}</span></div>`;
        h += '</div></div>';
    } else {
        // INTERACTIVE HINT: Categories empty
        h += '<div class="hint-block"><h4 class="warn">📂 Категории не найдены</h4>';
        h += '<p>Категории могут быть на отдельной странице или рендерятся через JavaScript.</p>';
        h += '<div class="hint-actions">';
        h += '<input class="hint-input" id="catPageUrl" placeholder="https://site.com/categories/">';
        h += `<button class="hint-btn primary" onclick="analyzeAdditionalPage('categories', document.getElementById('catPageUrl').value)">📂 Загрузить</button>`;
        h += '</div></div>';
    }

    // ── SEARCH ──
    if (d.SEARCH?.pattern) {
        h += `<div class="ab"><h3>🔍 Поиск</h3><div class="arg">`;
        h += `<span class="arl">Параметр:</span><span class="arv"><code>${esc(d.SEARCH.paramName)}</code></span>`;
        h += `<span class="arl">Паттерн:</span><span class="arv"><code>${esc(d.SEARCH.pattern)}</code></span>`;
        if (d.SEARCH.formAction) h += `<span class="arl">Form action:</span><span class="arv"><code>${esc(d.SEARCH.formAction)}</code></span>`;
        h += '</div>';
        if (additionalAnalyses.search?.slugBased) {
            h += `<div class="hint-block success"><h4 class="ok">🔍 Slug-based поиск обнаружен</h4><p>${esc(additionalAnalyses.search.note)}</p></div>`;
        }
        // Hint: verify search
        h += '<div class="hint-actions" style="margin-top:6px">';
        h += '<input class="hint-input" id="searchTestUrl" placeholder="URL результатов поиска для проверки">';
        h += `<button class="hint-btn secondary" onclick="analyzeAdditionalPage('search', document.getElementById('searchTestUrl').value)">🔍 Проверить</button>`;
        h += '</div></div>';
    }

    // ── STRATEGIES ──
    if (d.STRATEGIES?.length) {
        h += `<div class="ab"><h3 style="color:#0df">📊 S-Strategies (${d.strategySummary?.total || 0}, Block ${d.strategySummary?.recommendedBlock || '?'})</h3>`;
        h += '<div class="acg">';
        d.STRATEGIES.forEach(s => {
            const blockColor = s.block === 1 ? '#0f8' : s.block === 2 ? '#fd4' : s.block === 3 ? '#fa0' : '#f44';
            const conf = s.confidence === 'confirmed' ? '✅' : '🔍';
            h += `<div class="aci"><span class="aci-i" style="color:${blockColor}">${s.id}</span><span class="aci-l">${conf} ${esc(s.name)}</span><span class="aci-v ok">${s.foundUrls?.length || 0} urls</span></div>`;
        });
        h += '</div>';
        if (d.DEAD_STRATEGIES?.length) {
            h += '<div style="margin-top:8px;font-size:10px;color:#666"><strong>Dead strategies:</strong> ';
            d.DEAD_STRATEGIES.forEach(ds => { h += `<span style="margin-right:8px">${esc(ds.id)} (${esc(ds.evidence)})</span>` });
            h += '</div>';
        }
        h += '</div>';
    }

    // ── DEBUG REPORT ──
    if (d.DEBUG_REPORT) {
        h += '<div class="ab"><h3>🔍 Debug Report</h3><div class="acg">';
        for (const [name, count] of Object.entries(d.DEBUG_REPORT)) {
            h += `<div class="aci"><span class="aci-i">${count > 0 ? '✅' : '—'}</span><span class="aci-l">${esc(name)}</span><span class="aci-v ${count > 0 ? 'ok' : 'n'}">${count}</span></div>`;
        }
        h += '</div></div>';
    }

    // ── KVS ──
    if (d.KVS_ENGINE?.isKvs) {
        h += '<div class="kvs-block"><h4>🏭 KVS Engine</h4>';
        h += `<div style="font-size:11px;color:#0f8">${esc(d.KVS_ENGINE.note)} (${Math.round(d.KVS_ENGINE.confidence * 100)}%)</div>`;
        h += '<div class="kvs-markers">';
        for (const [k, v] of Object.entries(d.KVS_ENGINE.markers || {})) h += `<span class="kvs-marker ${v ? 'on' : 'off'}">${v ? '✓' : '✗'} ${esc(k)}</span>`;
        h += '</div></div>';
    }

    // ── KT DECODE ──
    if (d.KT_DECODE?.licenseCode) {
        h += `<div class="ab"><h3 class="rt">🔑 kt_player</h3><div class="arg">`;
        h += `<span class="arl">license_code:</span><span class="arv"><code>${esc(d.KT_DECODE.licenseCode)}</code></span>`;
        h += `<span class="arl">Encryption:</span><span class="arv">${d.KT_DECODE.encryptionUsed ? '✅ function/N/' : '❌ plain URLs'}</span>`;
        if (d.KT_DECODE.analysis?.found) h += `<span class="arl">Algorithm:</span><span class="arv"><code>${esc(d.KT_DECODE.analysis.algorithm)}</code></span>`;
        if (d.KT_DECODE.ktPlayerJsUrl) h += `<span class="arl">JS:</span><span class="arv"><code>${esc(d.KT_DECODE.ktPlayerJsUrl)}</code></span>`;
        h += '</div></div>';
    }

    // ── REDIRECT ──
    if (d.REDIRECT?.requiresFollow) {
        h += '<div class="redir-block"><h3>🔄 Redirect Chain</h3>';
        h += '<div class="redir-info">';
        h += `<span class="ri-l">get_file:</span><span class="ri-v">${d.REDIRECT.getFilePattern ? '✅' : '—'}</span>`;
        h += '</div>';
        if (d.REDIRECT.resolved?.length) {
            d.REDIRECT.resolved.forEach(rr => {
                h += '<div style="background:#0a1a0a;padding:6px 8px;border-radius:4px;margin:4px 0;font-size:10px">';
                h += `<span style="color:#0f8">✅ ${rr.redirectCount || 0} hops</span> ${rr.resumable ? '📥' : '⚠️'}`;
                h += `<br><code style="color:#0f8;font-size:9px">${esc((rr.final || '').substring(0, 100))}</code></div>`;
            });
        }
        // INTERACTIVE HINT: CDN not resolved
        if (!d.REDIRECT.resolved?.length || d.REDIRECT.resolved.every(r => r.redirectCount === 0)) {
            h += '<div class="hint-block"><h4 class="warn">🔄 CDN не разрешён</h4>';
            h += '<p>Redirect chain не дошёл до финального CDN URL. Используйте кнопку 🔄 и вставьте финальную CDN ссылку из браузера (Network tab → скопировать URL видео после 302).</p>';
            h += '<div class="hint-actions"><button class="hint-btn warn" onclick="runRedirectAnalysis()">🔄 Анализ CDN URL</button></div></div>';
        }
        h += '</div>';
    }

    // ── CDN REDIRECT ──
    if (d.CDN_REDIRECT) {
        h += '<div class="ab"><h3 style="color:#0df">🔗 CDN Redirect</h3><div class="arg">';
        h += `<span class="arl">Domain:</span><span class="arv"><code>${esc(d.CDN_REDIRECT.domain)}</code></span>`;
        h += `<span class="arl">Resumable:</span><span class="arv">${d.CDN_REDIRECT.resumable ? '✅' : '❌'}</span>`;
        if (d.CDN_REDIRECT.size) h += `<span class="arl">Size:</span><span class="arv">${esc(d.CDN_REDIRECT.size)}</span>`;
        if (d.CDN_REDIRECT.urlTemplate) h += `<span class="arl">Template:</span><span class="arv"><code>${esc(d.CDN_REDIRECT.urlTemplate)}</code></span>`;
        h += '</div></div>';
    }

    // ── WORKER VERDICT ──
    if (d.WORKER_VERDICT) {
        const wv = d.WORKER_VERDICT;
        const vColor = wv.required ? (wv.mode === 'impossible' ? '#f44' : '#fa0') : '#0f8';
        h += `<div class="ab"><h3 style="color:${vColor}">⚡ Worker: ${esc(wv.summary)}</h3>`;
        if (wv.reasons?.length) {
            h += '<div class="acg">';
            wv.reasons.forEach(r => { h += `<div class="aci"><span class="aci-i">${r.type === 'impossible' ? '❌' : '⚠️'}</span><span class="aci-l">${esc(r.reason)}</span><span class="aci-v warn">${esc(r.type)}</span></div>` });
            h += '</div>';
        }
        h += '</div>';
    }

    // ── WHITELIST ──
    if (d.WORKER_WHITELIST?.required?.length) {
        h += '<div class="wl-block"><h3>📡 Worker Whitelist</h3>';
        d.WORKER_WHITELIST.required.forEach(dm => { h += `<div class="wl-domain"><code>${esc(dm.domain)}</code><span class="role">${esc(dm.role)}</span></div>` });
        if (d.WORKER_WHITELIST.cdnPatterns?.length) {
            h += '<div style="margin-top:6px;font-size:10px;color:#fa0"><strong>CDN Patterns:</strong> ';
            d.WORKER_WHITELIST.cdnPatterns.forEach(p => { h += `<code>${esc(p.template)}</code> [${p.found.join(',')}] ` });
            h += '</div>';
        }
        h += `<div class="wl-code" onclick="copyWhitelist()" title="Click=copy">${esc(d.WORKER_WHITELIST.code)}</div></div>`;
    }

    // ── PROTECTION ──
    if (d.PROTECTION?.ageGate?.detected) {
        const ag = d.PROTECTION.ageGate;
        h += `<div class="age-g"><h4>🔞 Age Gate <span class="gt-badge ${ag.type}">${esc(ag.type)}</span></h4><p>${esc(ag.note || '')}</p>`;
        if (ag.cookieName) h += `<div class="age-detail">Cookie: <code>${esc(ag.cookieName)}=${esc(ag.cookieValue || '1')}</code></div>`;
        h += '</div>';
    }

    // ── TEMPLATE INTEGRATION ──
    if (d.templateIntegration) {
        h += '<div class="ab"><h3 style="color:#f80">🧩 Template Integration</h3><div class="arg">';
        h += `<span class="arl">NAME:</span><span class="arv"><code>${esc(d.NAME)}</code> <em style="color:#888;font-size:9px">(auto, verify manually)</em></span>`;
        h += `<span class="arl">menu.json:</span><span class="arv"><code>${esc(d.templateIntegration.menuJson)}</code></span>`;
        h += `<span class="arl">domainMap:</span><span class="arv"><code>${esc(d.templateIntegration.domainMap)}</code></span>`;
        h += '</div></div>';
    }

    // ── MAIN PAGE + BUILD_URL ──
    if (d.MAIN_PAGE_PATHS?.length || Object.keys(d.BUILD_URL || {}).length) {
        h += '<div class="ab"><h3>🗺️ URL Patterns</h3><div class="arg">';
        if (d.MAIN_PAGE_PATHS?.length) h += `<span class="arl">Main:</span><span class="arv">${d.MAIN_PAGE_PATHS.map(p => '<code>' + esc(p) + '</code>').join(' ')}</span>`;
        for (const [k, v] of Object.entries(d.BUILD_URL || {})) h += `<span class="arl">${esc(k)}:</span><span class="arv"><code>${esc(v)}</code></span>`;
        h += '</div></div>';
    }

    // ── SUMMARY ──
    const checks = [];
    if (d.CARD) checks.push({ i: '📄', l: 'Cards', v: d.CARD.found ? d.CARD.totalFound + ' (' + d.CARD.container + ')' : '❌', c: d.CARD.found ? 'ok' : 'fail' });
    checks.push({ i: '📂', l: 'Categories', v: (d.CATEGORIES?.length || 0) + (additionalAnalyses.categories ? ' ✓' : ''), c: d.CATEGORIES?.length ? 'ok' : 'n' });
    checks.push({ i: '📺', l: 'Channels', v: d.CHANNELS?.length || 0, c: d.CHANNELS?.length ? 'ok' : 'n' });
    if (d.SEARCH) checks.push({ i: '🔍', l: 'Search', v: d.SEARCH.paramName || '—', c: d.SEARCH.paramName ? 'ok' : 'n' });
    if (d.STRATEGIES?.length) checks.push({ i: '📊', l: 'Strategies', v: d.strategySummary?.total + ' (B' + d.strategySummary?.recommendedBlock + ')', c: 'ok' });
    if (d.WORKER_VERDICT) checks.push({ i: '⚡', l: 'Worker', v: d.WORKER_VERDICT.mode, c: d.WORKER_VERDICT.required ? 'warn' : 'ok' });
    if (d.WORKER_WHITELIST) checks.push({ i: '📡', l: 'Whitelist', v: d.WORKER_WHITELIST.required.length + ' domains', c: 'ok' });

    h += '<div class="ab"><h3>✅ Summary</h3><div class="acg">';
    checks.forEach(c => { h += `<div class="aci"><span class="aci-i">${c.i}</span><span class="aci-l">${esc(c.l)}</span><span class="aci-v ${c.c}">${c.v}</span></div>` });
    h += '</div></div>';

    return h;
}

// ================================================================
// HELPER: try alternative URL for cards
// ================================================================
function tryAlternativeCards() {
    let altUrl = $('altUrlCards')?.value.trim();
    if (!altUrl) return;
    const base = catalogData?._meta?.baseUrl || '';
    if (!altUrl.startsWith('http')) altUrl = base + (altUrl.startsWith('/') ? '' : '/') + altUrl;
    $('targetUrl').value = altUrl;
    runCatalogAnalysis();
}

function promptAlternativeUrl(type) {
    const url = prompt('Введите альтернативный URL:');
    if (url) { $('targetUrl').value = url; runCatalogAnalysis() }
}

// ================================================================
// DISPLAY + UI
// ================================================================
function displayResults(d) {
    $('results').style.display = 'block';
    const j = JSON.stringify(d, null, 2);
    $('jsonFormatted').innerHTML = synHL(j);
    $('jsonRaw').value = j;
    $('archReport').innerHTML = genArch(d);
    $('btnCopyJson').disabled = false;
    $('btnCopyWhitelist').disabled = !d.WORKER_WHITELIST;
}

function synHL(j) {
    return j.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, m => {
            let c = 'color:#ae81ff';
            if (/^"/.test(m)) c = /:$/.test(m) ? 'color:#a6e22e' : 'color:#e6db74';
            else if (/true|false/.test(m)) c = 'color:#66d9ef';
            else if (/null/.test(m)) c = 'color:#f92672';
            return `<span style="${c}">${m}</span>`;
        });
}

function showTab(n) {
    document.querySelectorAll('.tab-content').forEach(e => e.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(e => e.classList.remove('active'));
    const t = $('tab-' + n); if (t) t.classList.add('active');
    event?.target?.classList.add('active');
}

function clip(t) {
    navigator.clipboard.writeText(t).then(() => setStatus('📋 OK', 'success')).catch(() => {
        const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select();
        document.execCommand('copy'); document.body.removeChild(a); setStatus('📋 OK', 'success');
    });
}

function copyResults() { if (analysisResult) clip(JSON.stringify(analysisResult, null, 2)) }
function copyWhitelist() { if (analysisResult?.WORKER_WHITELIST?.code) { clip(analysisResult.WORKER_WHITELIST.code); setStatus('📡 Whitelist!', 'success') } else setStatus('No data', 'error') }

document.addEventListener('DOMContentLoaded', () => {
    const ui = $('targetUrl'); if (ui) ui.addEventListener('keypress', e => { if (e.key === 'Enter') runFullAnalysis() });
    const wi = $('workerUrl');
    if (wi) {
        const sv = localStorage.getItem('aWU');
        if (sv) wi.value = sv; else if (!wi.value) wi.value = DEFAULT_WORKER_URL;
        updW(!!wi.value.trim());
        wi.addEventListener('input', () => updW(!!wi.value.trim()));
        wi.addEventListener('change', () => { const v = wi.value.trim(); if (v) localStorage.setItem('aWU', v); else localStorage.removeItem('aWU') });
    }
    const ck = $('videoModeCheck'), lb = $('videoModeLabel'), btn = $('btnAnalyze');
    if (ck && lb && btn) {
        ck.addEventListener('change', () => {
            lb.classList.toggle('active', ck.checked);
            btn.textContent = ck.checked ? '🎬 Анализ видео' : '🚀 Анализ каталога';
            btn.classList.toggle('video-mode', ck.checked);
        });
    }
    updMerge();
});
