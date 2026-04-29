// ================================================================
// SITE STRUCTURE ANALYZER v6.0.0
// Unified S1-S28 strategies · Priority ordering · Mirror detection
// Full JSON output · No Config tab · foundUrls per strategy
// ================================================================
const DEFAULT_WORKER_URL="https://zonaproxy.777b737.workers.dev";
let analysisResult=null,catalogData=null,videoPageData=null,transportLog=[];
const logT=(m,t='info')=>transportLog.push({time:new Date().toLocaleTimeString(),message:m,type:t});
const $=id=>document.getElementById(id);
const setStatus=(m,t='loading')=>{const e=$('status');if(e){e.textContent=m;e.className='status '+t}};
const setProgress=(p,t,s)=>{const c=$('progress-container'),b=$('progress-bar'),x=$('progress-text');if(!c)return;c.style.display='block';b.style.width=p+'%';x.textContent=t||p+'%';b.classList.remove('cors-error','warning','worker','video-mode');if(s)b.classList.add(s)};
const baseOf=u=>{try{return new URL(u).origin}catch{return''}};
const resolve=(h,b)=>{if(!h)return'';try{return new URL(h,b).href}catch{return h}};
const hostOf=u=>{try{return new URL(u).hostname}catch{return''}};
const uniq=a=>[...new Set(a.filter(Boolean))];
const esc=t=>{if(!t)return'';const d=document.createElement('div');d.textContent=String(t);return d.innerHTML};
const getTestWord=()=>($('testWord')?.value.trim()||'wife');
const isVideoMode=()=>$('videoModeCheck')?.checked||false;
const UA={desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',mobile:'Mozilla/5.0 (Linux; Android 13) Mobile Chrome/120',bot:'Googlebot/2.1'};
function getUA(){const s=$('uaSelect');return s?UA[s.value]||UA.desktop:UA.desktop}

// ================================================================
// NAME GENERATOR
// ================================================================
function generateNameFromHost(host) {
    const domain = host.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
        .replace(/\.(com|xxx|net|win|me|club|top|ru|org|info|adult|porn|sex|tube|online|site)\s*$/i, '');
    return domain.length <= 5 ? domain : domain[0] + domain.substring(1, 5);
}

function updMerge(){const el=$('mergeIndicator');if(!el)return;if(catalogData&&videoPageData){el.textContent='📦 Каталог + 🎬 Видео → полный JSON';el.className='merge-indicator has-both';el.style.display='block'}else if(catalogData){el.textContent='📦 Каталог ✓ → для видео включите 🎬';el.className='merge-indicator has-catalog';el.style.display='block'}else el.style.display='none'}

function genXP(el){if(!el||el.nodeType!==1)return'';if(el.id)return`//*[@id="${el.id}"]`;const p=[];let c=el;while(c&&c.nodeType===1){let t=c.tagName.toLowerCase();if(c.className&&typeof c.className==='string'){const cl=c.className.trim().split(/\s+/)[0];if(cl&&cl.length>2){p.unshift(`//${t}[contains(@class,"${cl}")]`);break}}let i=1,s=c.previousElementSibling;while(s){if(s.tagName===c.tagName)i++;s=s.previousElementSibling}p.unshift(`/${t}[${i}]`);c=c.parentElement}return p.join('')}

// ================================================================
// TRANSPORT
// ================================================================
const getW=()=>{const i=$('workerUrl');return i?i.value.trim().replace(/\/$/,''):''};
const updW=h=>{const b=$('workerStatusBadge');if(b){b.textContent=h?'✦':'○';b.className='worker-badge '+(h?'active':'inactive')}};
function updCI(s,d){const el=$('corsIndicator');if(!el)return;const m={'trying-direct':['🔗','trying'],'direct-ok':['✅','direct-ok'],'trying-worker':['⚡','trying'],'worker-ok':['✅W','worker-ok'],'cors-detected':['🛡️CORS','cors-blocked'],'trying-proxy':['🔄'+(d||''),'cors-blocked'],'proxy-ok':['✅'+(d||''),'proxy-ok'],'all-failed':['❌','all-failed'],hidden:['','']};const v=m[s]||m.hidden;el.textContent=v[0];el.className='cors-indicator '+v[1];el.style.display=s==='hidden'?'none':'block'}
const proxies=()=>[{n:'allorigins',u:'https://api.allorigins.win/raw?url='},{n:'corsproxy',u:'https://corsproxy.io/?'},{n:'codetabs',u:'https://api.codetabs.com/v1/proxy?quest='}];
const isCE=e=>{if(!e)return false;const m=(e.message||'').toLowerCase();return m.includes('failed to fetch')||m.includes('networkerror')||m.includes('load failed')||e.name==='TypeError'};

async function fD(url){const a=new AbortController,t=setTimeout(()=>a.abort(),10000);try{const r=await fetch(url,{signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('HTTP '+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}
async function fW(url){const w=getW();if(!w)throw new Error('No W');const a=new AbortController,t=setTimeout(()=>a.abort(),15000);try{const r=await fetch(w+'/?url='+encodeURIComponent(url)+'&ua='+encodeURIComponent(getUA()),{signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('W'+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}
async function fP(url,pfx){const a=new AbortController,t=setTimeout(()=>a.abort(),15000);try{const r=await fetch(pfx+encodeURIComponent(url),{signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('HTTP '+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}

async function fetchPage(url){const mode=($('proxySelect')||{}).value||'auto',w=getW();if(mode===''||mode==='direct-test')return fD(url);if(mode==='auto'){try{logT('Direct');updCI('trying-direct');const h=await fD(url);logT('✅','success');updCI('direct-ok');return h}catch(e){logT(isCE(e)?'CORS':e.message,'warning')}if(w){try{logT('Worker');updCI('trying-worker');const h=await fW(url);logT('✅W','success');updCI('worker-ok');return h}catch(e){logT('W:'+e.message,'fail')}}updCI('cors-detected');const px=proxies();for(let i=0;i<px.length;i++){try{logT(px[i].n);updCI('trying-proxy',px[i].n);const h=await fP(url,px[i].u);logT('✅'+px[i].n,'success');updCI('proxy-ok',px[i].n);return h}catch(e){logT('❌'+px[i].n,'fail')}}updCI('all-failed');throw new Error('All blocked')}if(w){try{return await fW(url)}catch(e){logT('W:'+e.message,'warning')}}return fP(url,mode)}
const parseH=h=>new DOMParser().parseFromString(h,'text/html');

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
            logT('Resolved: ' + (data.redirects || 0) + ' hops → ' + (data.final || '').substring(0, 60), data.error ? 'fail' : 'success');
            return data;
        }
        throw new Error('Resolve HTTP ' + r.status);
    } catch (e) {
        logT('Resolve fallback: ' + e.message, 'warning');
        return { error: e.message, chain: [url], final: url, redirects: 0, fallback: true };
    }
}

// ================================================================
// STRATEGY DEFINITIONS — S1-S28 complete
// ================================================================
const STRATEGY_DEFS = [
    { id: 'S1',  name: 'VIDEO_RULES',       block: 1, desc: 'video_url/video_alt_url/setVideoUrlHigh/file:mp4' },
    { id: 'S2',  name: 'direct_mp4',        block: 1, desc: 'Direct https://...mp4 URLs in page' },
    { id: 'S3',  name: 'og_video',           block: 1, desc: '<meta property="og:video">' },
    { id: 'S4',  name: 'HLS_m3u8',          block: 1, desc: '.m3u8 playlist URL' },
    { id: 'S5',  name: 'get_file',           block: 1, desc: '/get_file/{id}/{hash}/ pattern' },
    { id: 'S6',  name: 'source_size',        block: 1, desc: '<source src size=""> tags' },
    { id: 'S7',  name: 'source_label',       block: 1, desc: '<source label=""> or title="" tags' },
    { id: 'S8',  name: 'DOMParser_source',   block: 2, desc: '<video><source src> via DOMParser' },
    { id: 'S9',  name: 'dataEncodings',      block: 2, desc: 'dataEncodings/sources JSON array' },
    { id: 'S10', name: 'html5player',        block: 2, desc: 'html5player.setVideoUrl calls' },
    { id: 'S11', name: 'flowplayer',         block: 2, desc: 'Flowplayer playlist/clip config' },
    { id: 'S12', name: 'KVS_multi_url',      block: 2, desc: 'video_url_720p, video_url_480p etc' },
    { id: 'S13', name: 'data_config',        block: 2, desc: 'data-config/data-video/data-sources attr' },
    { id: 'S14', name: 'videojs',            block: 2, desc: 'Video.js data-setup config' },
    { id: 'S15', name: 'Plyr',              block: 2, desc: 'Plyr.js player setup' },
    { id: 'S16', name: 'JW_Player_setup',    block: 2, desc: 'jwplayer().setup({file:...})' },
    { id: 'S17', name: 'Flashvars',          block: 2, desc: 'flashvars object with video URLs' },
    { id: 'S18', name: 'JSON_LD',            block: 3, desc: 'application/ld+json schema.org' },
    { id: 'S19', name: 'DASH_mpd',           block: 3, desc: 'DASH .mpd manifest' },
    { id: 'S20', name: 'CF_Stream',          block: 3, desc: 'Cloudflare Stream embed' },
    { id: 'S21', name: 'redirect',           block: 3, desc: 'window.location redirect pattern' },
    { id: 'S22', name: 'ts_segments',        block: 3, desc: '.ts segment files' },
    { id: 'S23', name: 'PostMessage',        block: 3, desc: 'postMessage video URL passing' },
    { id: 'S24', name: 'JWT_decode',         block: 3, desc: 'JWT token with video info' },
    { id: 'S25', name: 'JS_object',          block: 3, desc: 'var x = {src/file/url: "...mp4"}' },
    { id: 'S26', name: 'MediaSource',        block: 4, desc: 'MediaSource API (needs headless)' },
    { id: 'S27', name: 'Lazy_video',         block: 4, desc: 'data-src/data-lazy-src video elements' },
    { id: 'S28', name: 'API_endpoint',       block: 4, desc: '/api/...video endpoint calls' }
];

// ================================================================
// UNIFIED STRATEGY DETECTION — returns full strategy objects
// with regex patterns, found URLs, confidence
// ================================================================
function detectAllStrategies(html, allJS, doc, base) {
    const cb = html + '\n' + allJS;
    const results = [];

    function addStrategy(id, opts) {
        const def = STRATEGY_DEFS.find(d => d.id === id);
        if (!def) return;
        results.push({
            id: def.id,
            name: def.name,
            block: def.block,
            desc: def.desc,
            active: true,
            confidence: opts.confidence || 'detected',
            foundUrls: opts.foundUrls || [],
            regex: opts.regex || null,
            extractionMethod: opts.extractionMethod || null,
            details: opts.details || null
        });
    }

    // ── S1: VIDEO_RULES (video_url, setVideoUrlHigh, file:mp4) ──
    {
        const urls = [], regexes = [];
        const pats = [
            { re: /video_url\s*[:=]\s*['"]([^'"]+)['"]/gi, rx: "video_url\\s*[:=]\\s*['\"]([^'\"]+)['\"]" },
            { re: /video_alt_url\s*[:=]\s*['"]([^'"]+)['"]/gi, rx: "video_alt_url\\s*[:=]\\s*['\"]([^'\"]+)['\"]" },
            { re: /setVideoUrlHigh\s*\(\s*['"]([^'"]+)['"]\)/gi, rx: "setVideoUrlHigh\\(['\"]([^'\"]+)['\"]\\)" },
            { re: /setVideoUrlLow\s*\(\s*['"]([^'"]+)['"]\)/gi, rx: "setVideoUrlLow\\(['\"]([^'\"]+)['\"]\\)" },
            { re: /setVideoHLS\s*\(\s*['"]([^'"]+)['"]\)/gi, rx: "setVideoHLS\\(['\"]([^'\"]+)['\"]\\)" },
            { re: /file\s*:\s*['"]([^'"]+\.(?:mp4|m3u8)[^'"]*)['"]/gi, rx: "file\\s*:\\s*['\"]([^'\"]+\\.(?:mp4|m3u8)[^'\"]*)['\"]" }
        ];
        for (const p of pats) {
            let m; p.re.lastIndex = 0;
            while ((m = p.re.exec(cb)) !== null) {
                const u = resolve(m[1].replace(/\\\//g, '/'), base);
                if (u && u.startsWith('http')) { urls.push(u); regexes.push(p.rx); }
            }
        }
        if (urls.length) addStrategy('S1', { confidence: 'confirmed', foundUrls: uniq(urls), regex: uniq(regexes), extractionMethod: 'regex' });
    }

    // ── S2: direct_mp4 ──
    {
        const urls = [];
        const re = /["'](https?:(?:\\\/|\/)[^"'\s]+?\.mp4[^"'\s]*?)["']/gi;
        let m; while ((m = re.exec(cb)) !== null) {
            const u = m[1].replace(/\\\//g, '/');
            if (u.startsWith('http') && !u.includes('{') && !u.includes('preview') && !u.includes('thumb')) urls.push(u);
        }
        if (urls.length) addStrategy('S2', { confidence: 'confirmed', foundUrls: uniq(urls).slice(0, 20), regex: ["[\"'](https?://[^\"'\\s]+?\\.mp4[^\"'\\s]*?)[\"']"], extractionMethod: 'regex' });
    }

    // ── S3: og:video ──
    {
        const urls = [];
        const metas = doc.querySelectorAll('meta[property="og:video"],meta[property="og:video:url"]');
        metas.forEach(el => { const u = el.getAttribute('content'); if (u && (u.includes('.mp4') || u.includes('.m3u8'))) urls.push(resolve(u, base)); });
        if (urls.length) addStrategy('S3', { confidence: 'confirmed', foundUrls: uniq(urls), regex: ['<meta property="og:video" content="([^"]+)">'], extractionMethod: 'dom-meta' });
        else if (/og:video/.test(cb)) addStrategy('S3', { confidence: 'detected', regex: ['og:video'], extractionMethod: 'dom-meta' });
    }

    // ── S4: HLS m3u8 ──
    {
        const urls = [];
        const re = /['"]?(https?:\/\/[^\s"']+\.m3u8[^\s"']*?)['"]?/gi;
        let m; while ((m = re.exec(cb)) !== null) urls.push(m[1]);
        if (urls.length) addStrategy('S4', { confidence: 'confirmed', foundUrls: uniq(urls).slice(0, 10), regex: ["(https?://[^\\s\"']+\\.m3u8[^\\s\"']*?)"], extractionMethod: 'regex' });
        else if (/\.m3u8/.test(cb)) addStrategy('S4', { confidence: 'detected', regex: ['.m3u8'], extractionMethod: 'regex' });
    }

    // ── S5: get_file ──
    {
        const urls = [];
        const re = /(https?:\/\/[^\s"']+\/get_file\/[^\s"']+)/gi;
        let m; while ((m = re.exec(cb)) !== null) urls.push(m[1].replace(/\\\//g, '/'));
        if (urls.length) addStrategy('S5', { confidence: 'confirmed', foundUrls: uniq(urls).slice(0, 10), regex: ["(https?://[^\\s\"']+/get_file/[^\\s\"']+)"], extractionMethod: 'regex' });
        else if (/\/get_file\/\d+\//.test(cb)) addStrategy('S5', { confidence: 'detected', regex: ['/get_file/\\d+/'], extractionMethod: 'regex' });
    }

    // ── S6: source with size attr ──
    {
        const urls = [];
        const sources = doc.querySelectorAll('source[src][size],source[data-src][size]');
        sources.forEach(s => {
            const src = s.getAttribute('src') || s.getAttribute('data-src');
            const size = s.getAttribute('size');
            if (src && size && size !== 'preview') urls.push({ url: resolve(src, base), quality: size });
        });
        // Also regex for broken HTML
        const re1 = /<source[^>]+src="([^"]+)"[^>]+size="([^"]+)"/gi;
        const re2 = /<source[^>]+size="([^"]+)"[^>]+src="([^"]+)"/gi;
        let m;
        while ((m = re1.exec(html)) !== null) if (m[2] !== 'preview') urls.push({ url: resolve(m[1], base), quality: m[2] });
        while ((m = re2.exec(html)) !== null) if (m[1] !== 'preview') urls.push({ url: resolve(m[2], base), quality: m[1] });
        if (urls.length) addStrategy('S6', {
            confidence: 'confirmed',
            foundUrls: urls.map(u => u.url + ' [' + u.quality + ']'),
            regex: ['<source[^>]+src="([^"]+)"[^>]+size="([^"]+)"', '<source[^>]+size="([^"]+)"[^>]+src="([^"]+)"'],
            extractionMethod: 'dom+regex',
            details: { qualities: urls.map(u => ({ url: u.url, quality: u.quality })) }
        });
    }

    // ── S7: source with label/title attr ──
    {
        const urls = [];
        const sources = doc.querySelectorAll('source[src][label],source[src][title],source[data-src][label],source[data-src][title]');
        sources.forEach(s => {
            const src = s.getAttribute('src') || s.getAttribute('data-src');
            const label = s.getAttribute('label') || s.getAttribute('title');
            if (src && label && label !== 'preview') urls.push({ url: resolve(src, base), quality: label });
        });
        const re1 = /<source[^>]+src="([^"]+)"[^>]+(?:label|title)="([^"]+)"/gi;
        const re2 = /<source[^>]+(?:label|title)="([^"]+)"[^>]+src="([^"]+)"/gi;
        let m;
        while ((m = re1.exec(html)) !== null) if (m[2] !== 'preview') urls.push({ url: resolve(m[1], base), quality: m[2] });
        while ((m = re2.exec(html)) !== null) if (m[1] !== 'preview') urls.push({ url: resolve(m[2], base), quality: m[1] });
        if (urls.length) addStrategy('S7', {
            confidence: 'confirmed',
            foundUrls: urls.map(u => u.url + ' [' + u.quality + ']'),
            regex: ['<source[^>]+src="([^"]+)"[^>]+(?:label|title)="([^"]+)"'],
            extractionMethod: 'dom+regex',
            details: { qualities: urls.map(u => ({ url: u.url, quality: u.quality })) }
        });
    }

    // ── S8: DOMParser <video><source> ──
    {
        const urls = [];
        doc.querySelectorAll('video source[src]').forEach(s => {
            const src = s.getAttribute('src');
            if (src && (src.includes('.mp4') || src.includes('.m3u8'))) urls.push(resolve(src, base));
        });
        if (urls.length) addStrategy('S8', { confidence: 'confirmed', foundUrls: uniq(urls), extractionMethod: 'dom-querySelectorAll', regex: ['video source[src]'] });
        else if (/<video\s[^>]*source[^>]*src/i.test(cb)) addStrategy('S8', { confidence: 'detected', extractionMethod: 'dom-querySelectorAll' });
    }

    // ── S9: dataEncodings / sources JSON ──
    {
        const urls = [], variables = [];
        for (const vn of ['dataEncodings', 'sources', 'media_sources', 'video_sources', 'files']) {
            const idx = allJS.indexOf(vn); if (idx === -1) continue;
            const as = allJS.indexOf('[', idx); if (as === -1 || as - idx > 80) continue;
            try {
                let depth = 0, ae = -1;
                for (let i = as; i < Math.min(allJS.length, as + 10000); i++) {
                    if (allJS[i] === '[') depth++; else if (allJS[i] === ']') { depth--; if (depth === 0) { ae = i; break; } }
                }
                if (ae === -1) continue;
                const arr = JSON.parse(allJS.substring(as, ae + 1).replace(/\\\//g, '/'));
                arr.forEach(item => {
                    const u = item.filename || item.file || item.src || item.url || '';
                    if (u) { urls.push((u.startsWith('//') ? 'https:' : '') + u.replace(/\\\//g, '/')); variables.push(vn); }
                });
            } catch {}
        }
        if (urls.length) addStrategy('S9', { confidence: 'confirmed', foundUrls: uniq(urls).slice(0, 20), extractionMethod: 'json-parse', details: { variables: uniq(variables) } });
        else if (/dataEncodings|"sources"\s*:\s*\[/.test(cb)) addStrategy('S9', { confidence: 'detected', extractionMethod: 'json-parse' });
    }

    // ── S10: html5player.setVideoUrl ──
    {
        const urls = [];
        const re = /html5player\.setVideoUrl(High|Low|HLS)?\s*\(\s*['"]([^'"]+)['"]\)/gi;
        let m; while ((m = re.exec(cb)) !== null) urls.push(resolve(m[2].replace(/\\\//g, '/'), base));
        if (urls.length) addStrategy('S10', { confidence: 'confirmed', foundUrls: uniq(urls), regex: ["html5player\\.setVideoUrl\\w*\\(['\"]([^'\"]+)['\"]\\)"], extractionMethod: 'regex' });
        else if (/html5player\.setVideoUrl/i.test(cb)) addStrategy('S10', { confidence: 'detected' });
    }

    // ── S11: Flowplayer ──
    {
        const urls = [];
        const fpPlaylist = cb.match(/playlist\s*:\s*\[(\{[\s\S]+?\})\]/i);
        const fpClip = cb.match(/clip\s*:\s*\{[^}]*url\s*:\s*['"]([^'"]+)['"]/i);
        if (fpPlaylist) {
            try {
                JSON.parse('[' + fpPlaylist[1] + ']').forEach(clip => {
                    (clip.sources || []).forEach(s => { const u = s.src || s.file || s.url; if (u) urls.push(resolve(u, base)); });
                    if (clip.url) urls.push(resolve(clip.url, base));
                });
            } catch {}
        }
        if (fpClip) urls.push(resolve(fpClip[1], base));
        if (urls.length) addStrategy('S11', { confidence: 'confirmed', foundUrls: uniq(urls), extractionMethod: 'json-parse', regex: ["playlist\\s*:\\s*\\[", "clip\\s*:\\s*\\{[^}]*url"] });
        else if (/flowplayer/i.test(cb)) addStrategy('S11', { confidence: 'detected', extractionMethod: 'json-parse' });
    }

    // ── S12: KVS multi URL (video_url_720p etc) ──
    {
        const urls = [];
        const re = /video_url_(\w+)\s*[:=]\s*['"]([^'"]+)['"]/gi;
        let m; while ((m = re.exec(cb)) !== null) urls.push({ quality: m[1], url: resolve(m[2].replace(/\\\//g, '/'), base) });
        if (urls.length) addStrategy('S12', {
            confidence: 'confirmed',
            foundUrls: urls.map(u => u.url + ' [' + u.quality + ']'),
            regex: ["video_url_(\\w+)\\s*[:=]\\s*['\"]([^'\"]+)['\"]"],
            extractionMethod: 'regex',
            details: { qualities: urls }
        });
        else if (/video_url_\w+\s*[:=]/i.test(cb)) addStrategy('S12', { confidence: 'detected' });
    }

    // ── S13: data-config/data-video/data-sources ──
    {
        const urls = [];
        doc.querySelectorAll('[data-config],[data-video],[data-sources],[data-player]').forEach(el => {
            for (const attr of ['data-config', 'data-video', 'data-sources', 'data-player']) {
                const val = el.getAttribute(attr);
                if (!val) continue;
                try {
                    const obj = JSON.parse(val);
                    const u = obj.file || obj.src || obj.url || obj.source || '';
                    if (u) urls.push(resolve(u, base));
                    if (obj.sources) obj.sources.forEach(s => { const su = s.file || s.src || s.url; if (su) urls.push(resolve(su, base)); });
                } catch {
                    if (val.includes('.mp4') || val.includes('.m3u8')) urls.push(resolve(val, base));
                }
            }
        });
        if (urls.length) addStrategy('S13', { confidence: 'confirmed', foundUrls: uniq(urls), extractionMethod: 'dom-data-attr' });
        else if (/data-(?:config|video|sources|player)=/i.test(cb)) addStrategy('S13', { confidence: 'detected', extractionMethod: 'dom-data-attr' });
    }

    // ── S14: Video.js data-setup ──
    {
        const urls = [];
        doc.querySelectorAll('[data-setup]').forEach(el => {
            try {
                const obj = JSON.parse(el.getAttribute('data-setup'));
                if (obj.sources) obj.sources.forEach(s => { if (s.src) urls.push(resolve(s.src, base)); });
            } catch {}
        });
        if (urls.length) addStrategy('S14', { confidence: 'confirmed', foundUrls: uniq(urls), extractionMethod: 'dom-data-setup' });
        else if (/data-setup=/i.test(cb) && /videojs|video-js/i.test(cb)) addStrategy('S14', { confidence: 'detected' });
    }

    // ── S15: Plyr ──
    {
        const detected = /new\s+Plyr|Plyr\.setup|data-plyr/i.test(cb);
        if (detected) addStrategy('S15', { confidence: 'detected', extractionMethod: 'plyr-api', details: { setup: /new\s+Plyr/.test(cb) ? 'constructor' : 'data-attr' } });
    }

    // ── S16: JW Player setup ──
    {
        const urls = [];
        const re = /jwplayer\s*\([^)]*\)\s*\.\s*setup\s*\(\s*\{([\s\S]*?)\}\s*\)/gi;
        let m; while ((m = re.exec(cb)) !== null) {
            const fileM = m[1].match(/file\s*:\s*['"]([^'"]+)['"]/);
            if (fileM) urls.push(resolve(fileM[1].replace(/\\\//g, '/'), base));
            const sourcesM = m[1].match(/sources\s*:\s*\[([\s\S]*?)\]/);
            if (sourcesM) {
                try { JSON.parse('[' + sourcesM[1] + ']').forEach(s => { if (s.file) urls.push(resolve(s.file, base)); }); } catch {}
            }
        }
        if (urls.length) addStrategy('S16', { confidence: 'confirmed', foundUrls: uniq(urls), extractionMethod: 'json-parse', regex: ["jwplayer\\([^)]*\\)\\.setup\\("] });
        else if (/jwplayer\s*\([^)]*\)\s*\.\s*setup/i.test(cb)) addStrategy('S16', { confidence: 'detected' });
    }

    // ── S17: Flashvars ──
    {
        const urls = [];
        const fvM = cb.match(/flashvars\s*[:=]\s*\{([^}]+)\}/i);
        if (fvM) {
            const urlM = fvM[1].match(/(?:video_url|file|src)\s*[:=]\s*['"]([^'"]+)['"]/gi);
            if (urlM) urlM.forEach(m2 => { const um = m2.match(/['"]([^'"]+)['"]/); if (um) urls.push(resolve(um[1], base)); });
        }
        if (urls.length) addStrategy('S17', { confidence: 'confirmed', foundUrls: uniq(urls), extractionMethod: 'regex', regex: ["flashvars\\s*[:=]\\s*\\{"] });
        else if (/flashvars\s*[:=]\s*\{/i.test(cb)) addStrategy('S17', { confidence: 'detected' });
    }

    // ── S18: JSON-LD ──
    {
        const urls = [];
        doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
            try {
                const ld = JSON.parse(s.textContent);
                const check = obj => {
                    if (obj.contentUrl) urls.push(resolve(obj.contentUrl, base));
                    if (obj.embedUrl) urls.push(resolve(obj.embedUrl, base));
                    if (obj.url && /\.mp4|\.m3u8/.test(obj.url)) urls.push(resolve(obj.url, base));
                    if (obj.video) check(obj.video);
                };
                check(ld);
            } catch {}
        });
        if (urls.length) addStrategy('S18', { confidence: 'confirmed', foundUrls: uniq(urls), extractionMethod: 'json-ld-parse' });
        else if (/application\/ld\+json/i.test(html)) addStrategy('S18', { confidence: 'detected', extractionMethod: 'json-ld-parse' });
    }

    // ── S19: DASH mpd ──
    {
        const urls = [];
        const re = /['"]?(https?:\/\/[^\s"']+\.mpd[^\s"']*?)['"]?/gi;
        let m; while ((m = re.exec(cb)) !== null) urls.push(m[1]);
        if (urls.length) addStrategy('S19', { confidence: 'confirmed', foundUrls: uniq(urls), extractionMethod: 'regex' });
        else if (/\.mpd['"\s?]/i.test(cb)) addStrategy('S19', { confidence: 'detected' });
    }

    // ── S20: Cloudflare Stream ──
    if (/cloudflarestream\.com/i.test(cb)) {
        const urls = [];
        const re = /(https?:\/\/[^\s"']*cloudflarestream\.com[^\s"']*)/gi;
        let m; while ((m = re.exec(cb)) !== null) urls.push(m[1]);
        addStrategy('S20', { confidence: urls.length ? 'confirmed' : 'detected', foundUrls: uniq(urls), extractionMethod: 'cf-stream' });
    }

    // ── S21: redirect ──
    if (/window\.location\s*=\s*['"]/i.test(cb)) {
        const urls = [];
        const re = /window\.location\s*=\s*['"]([^'"]+)['"]/gi;
        let m; while ((m = re.exec(cb)) !== null) urls.push(resolve(m[1], base));
        addStrategy('S21', { confidence: urls.length ? 'confirmed' : 'detected', foundUrls: uniq(urls), extractionMethod: 'redirect-follow' });
    }

    // ── S22: ts segments ──
    if (/\.ts['"\s?]/i.test(cb) && !/\.tsu|\.tsx|\.tsl/i.test(cb)) {
        const urls = [];
        const re = /['"]?(https?:\/\/[^\s"']+\.ts)['"]?/gi;
        let m; while ((m = re.exec(cb)) !== null) if (!m[1].includes('.tsx') && !m[1].includes('.tsl')) urls.push(m[1]);
        addStrategy('S22', { confidence: urls.length ? 'confirmed' : 'detected', foundUrls: uniq(urls).slice(0, 10), extractionMethod: 'regex' });
    }

    // ── S23: PostMessage ──
    if (/postMessage\s*\(\s*['"]/i.test(cb)) {
        addStrategy('S23', { confidence: 'detected', extractionMethod: 'postmessage-listener', details: { note: 'Requires iframe message interception' } });
    }

    // ── S24: JWT decode ──
    {
        const jwtRe = /(?:token|jwt|auth)\s*[:=]\s*['"]([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)['"]/gi;
        const tokens = [];
        let m; while ((m = jwtRe.exec(cb)) !== null) tokens.push(m[1]);
        if (tokens.length) addStrategy('S24', { confidence: 'detected', extractionMethod: 'jwt-decode', details: { tokens: tokens.slice(0, 3) } });
    }

    // ── S25: JS object with src/file/url ──
    {
        const urls = [];
        const re = /var\s+\w+\s*=\s*\{[^}]*(?:src|file|url)\s*[:=]\s*['"]([^'"]+\.(?:mp4|m3u8))[^}]*\}/gi;
        let m; while ((m = re.exec(cb)) !== null) urls.push(resolve(m[1].replace(/\\\//g, '/'), base));
        if (urls.length) addStrategy('S25', { confidence: 'confirmed', foundUrls: uniq(urls), extractionMethod: 'regex', regex: ["var\\s+\\w+\\s*=\\s*\\{[^}]*(?:src|file|url)\\s*[:=]\\s*['\"]([^'\"]+)"] });
        else if (/var\s+\w+\s*=\s*\{[^}]*(?:src|file|url)\s*[:=]\s*['"][^'"]+\.(?:mp4|m3u8)/i.test(cb)) addStrategy('S25', { confidence: 'detected' });
    }

    // ── S26: MediaSource ──
    if (/MediaSource\s*\(/i.test(cb)) {
        addStrategy('S26', { confidence: 'detected', extractionMethod: 'mediasource-api', details: { note: 'Requires headless browser with MediaSource interception' } });
    }

    // ── S27: Lazy video ──
    {
        const urls = [];
        doc.querySelectorAll('video[data-src],video[data-lazy-src],video[data-video-src]').forEach(v => {
            const u = v.getAttribute('data-src') || v.getAttribute('data-lazy-src') || v.getAttribute('data-video-src');
            if (u) urls.push(resolve(u, base));
        });
        if (urls.length) addStrategy('S27', { confidence: 'confirmed', foundUrls: uniq(urls), extractionMethod: 'dom-data-attr' });
        else if (/video\[data-src\]|<video[^>]+data-(?:src|lazy-src|video-src)/i.test(cb)) addStrategy('S27', { confidence: 'detected' });
    }

    // ── S28: API endpoint ──
    {
        const urls = [];
        const re = /['"](\/?api\/[^'"]*video[^'"]*)['"]/gi;
        let m; while ((m = re.exec(cb)) !== null) urls.push(resolve(m[1], base));
        if (urls.length) addStrategy('S28', { confidence: 'detected', foundUrls: uniq(urls).slice(0, 10), extractionMethod: 'api-fetch', details: { note: 'Requires API call, may need auth' } });
        else if (/\/api\/[^'"]*video|endpoint.*video/i.test(cb)) addStrategy('S28', { confidence: 'detected' });
    }

    // Sort by: confirmed first, then by block number
    results.sort((a, b) => {
        const confOrder = { confirmed: 0, detected: 1, inferred: 2 };
        const ca = confOrder[a.confidence] ?? 9, cb2 = confOrder[b.confidence] ?? 9;
        if (ca !== cb2) return ca - cb2;
        return a.block - b.block;
    });

    // Assign priority based on sort order
    results.forEach((s, i) => { s.priority = i + 1; });

    return results;
}

// ================================================================
// MIRROR DETECTION — search HTML for alternative domains
// ================================================================
function detectMirrors(html, doc, base) {
    const currentHost = hostOf(base);
    const currentDomain = currentHost.replace(/^www\./, '');
    const mirrors = new Set();

    // Pattern 1: links to same-looking domains with numbers
    const domainBase = currentDomain.replace(/\d+/, '');
    if (domainBase !== currentDomain) {
        // Site already has numbers, look for variants
        const numMatch = currentDomain.match(/(\d+)/);
        if (numMatch) {
            const num = parseInt(numMatch[1]);
            for (let i = Math.max(1, num - 3); i <= num + 5; i++) {
                if (i === num) continue;
                mirrors.add(currentDomain.replace(/\d+/, String(i)));
            }
        }
    }

    // Pattern 2: explicit mirror/alternative links in HTML
    const mirrorPats = [
        /(?:mirror|alt|alternative|зеркало|backup)\s*[:=]?\s*(?:href=)?\s*['"]?(https?:\/\/[^"'\s<>]+)/gi,
        /(?:also\s+(?:available|known)\s+(?:at|as))\s*[:=]?\s*['"]?(https?:\/\/[^"'\s<>]+)/gi
    ];
    for (const pat of mirrorPats) {
        let m; while ((m = pat.exec(html)) !== null) {
            try { const h = new URL(m[1]).hostname; if (h !== currentHost) mirrors.add(h); } catch {}
        }
    }

    // Pattern 3: same content structure on different TLDs
    const baseName = currentDomain.split('.')[0];
    const tlds = ['com', 'xxx', 'net', 'org', 'me', 'club', 'top', 'win', 'site', 'online', 'info'];
    const currentTld = currentDomain.split('.').slice(1).join('.');

    // Look for links to domains with same base name but different TLD
    const allHrefs = [];
    doc.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href'); if (h && h.startsWith('http')) allHrefs.push(h); });
    const scriptSrcs = Array.from(doc.querySelectorAll('script[src]')).map(s => s.getAttribute('src')).filter(Boolean);

    [...allHrefs, ...scriptSrcs].forEach(href => {
        try {
            const h = new URL(href).hostname.replace(/^www\./, '');
            if (h === currentDomain) return;
            const hBase = h.split('.')[0];
            // Same base name, different TLD = likely mirror
            if (hBase === baseName && h !== currentDomain) mirrors.add(h);
            // Similar name (edit distance 1-2)
            if (hBase.length > 3 && Math.abs(hBase.length - baseName.length) <= 2) {
                let diff = 0;
                for (let i = 0; i < Math.min(hBase.length, baseName.length); i++) {
                    if (hBase[i] !== baseName[i]) diff++;
                }
                if (diff <= 2 && diff > 0) mirrors.add(h);
            }
        } catch {}
    });

    // Remove CDN domains and known services
    const cdnPats = /cdn|cloudflare|cloudfront|akamai|fastly|jquery|google|facebook|twitter|analytics|fonts|gstatic/i;
    const result = [...mirrors].filter(m => !cdnPats.test(m) && m !== currentHost && m !== currentDomain);

    return {
        currentDomain,
        mirrors: result,
        totalFound: result.length,
        searchedPatterns: ['numeric-variants', 'explicit-links', 'same-basename-diff-tld', 'similar-name']
    };
}

// ================================================================
// DEBUG REPORT — 14 patterns
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
    for (const p of patterns) { const m = html.match(p.re); result[p.name] = m ? m.length : 0; }
    return result;
}

// ================================================================
// cleanUrl RULES DETECTION
// ================================================================
function detectCleanUrlRules(html, allJS) {
    const cb = html + '\n' + allJS;
    const rules = [];
    if (cb.includes('\\/')) rules.push('unescape-backslash');
    if (/src=["']\/\/[^"']+/.test(cb)) rules.push('add-protocol');
    if (/src=["']\/[^/"']/.test(cb)) rules.push('prepend-host');
    if (cb.includes('/THUMBNUM/')) rules.push('replace-THUMBNUM');
    if (/\/function\/\d+\//.test(cb)) rules.push('strip-function-prefix');
    if (/['"][A-Za-z0-9+/]{30,}={0,2}['"]/.test(cb) && /atob|base64|decode/i.test(cb)) rules.push('base64-decode');
    if (/[?&]rnd=\d+/.test(cb) || /[?&]br=\d+/.test(cb) || /[?&]_=\d+/.test(cb)) rules.push('strip-cache-params');
    return rules;
}

// ================================================================
// ANALYZERS — DOM, Frameworks, Encoding
// ================================================================
function aDom(doc) {
    return {
        totalElements: doc.querySelectorAll('*').length,
        scripts: doc.querySelectorAll('script').length,
        images: doc.querySelectorAll('img').length,
        links: doc.querySelectorAll('a[href]').length,
        externalScripts: Array.from(doc.querySelectorAll('script[src]')).map(s => s.getAttribute('src')).filter(Boolean)
    };
}

function aFW(doc, html) {
    const f = [], src = html + Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    [['React', ['data-reactroot', 'ReactDOM']], ['Next.js', ['__NEXT_DATA__']], ['Vue.js', ['__vue__', 'data-v-']],
     ['jQuery', ['jquery', 'jQuery']], ['Cloudflare', ['challenges.cloudflare.com']], ['DDoS-Guard', ['ddos-guard']],
     ['JW Player', ['jwplayer']], ['Video.js', ['videojs']], ['HLS.js', ['hls.js', 'Hls.']],
     ['Flowplayer', ['flowplayer']], ['Plyr', ['new Plyr', 'Plyr.setup']]
    ].forEach(([n, ps]) => { for (const p of ps) if (src.includes(p)) { f.push(n); break } });
    return uniq(f);
}

function aEnc(doc) {
    const mc = doc.querySelector('meta[charset]');
    return { charset: mc ? mc.getAttribute('charset').toUpperCase() : 'N/A' };
}

// ================================================================
// PROTECTION ANALYSIS
// ================================================================
function aProt(doc, html, base) {
    const r = { cloudflare: false, cloudflareTurnstile: false, ddosGuard: false, recaptcha: false,
        drm: false, drmDetails: [], authRequired: false, refererProtected: false, ageGate: null,
        cookies: [], requiredHeaders: {} };
    const lc = html.toLowerCase();
    const src = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const cb = lc + src.toLowerCase();

    if (lc.includes('challenges.cloudflare.com')) { r.cloudflare = true; r.cloudflareTurnstile = cb.includes('turnstile') || cb.includes('cf-turnstile'); }
    if (lc.includes('ddos-guard')) r.ddosGuard = true;
    if (cb.includes('recaptcha') || cb.includes('hcaptcha')) r.recaptcha = true;
    [{ n: 'Widevine', p: ['widevine'] }, { n: 'PlayReady', p: ['playready'] }, { n: 'FairPlay', p: ['fairplay'] },
     { n: 'EME', p: ['requestmedialkeysystemaccess', 'encrypted-media'] }
    ].forEach(d => { d.p.forEach(p => { if (cb.includes(p)) { r.drm = true; r.drmDetails.push(d.n) } }) });
    r.drmDetails = uniq(r.drmDetails);
    if (doc.querySelectorAll('form[action*="login"],form[action*="signin"],form[action*="auth"]').length) r.authRequired = true;
    if (cb.includes('document.referrer') || /referer.*check|check.*referer/i.test(cb)) r.refererProtected = true;
    const cp = /(?:document\.cookie\s*=\s*['"`])([^'"`=;]+)/gi; let cm;
    while ((cm = cp.exec(src))) r.cookies.push(cm[1]);
    r.cookies = uniq(r.cookies).slice(0, 10);

    const ageCN = ['age_verified', 'disclaimer', 'over18', 'agegate', 'is_adult', 'mature', 'age_confirm'];
    let ageType = null, ageDet = {};
    for (const form of doc.querySelectorAll('form')) {
        const act = (form.getAttribute('action') || '').toLowerCase(), meth = (form.getAttribute('method') || '').toUpperCase();
        if ((act.includes('age') || act.includes('verify') || act.includes('disclaimer')) && meth === 'POST') {
            ageType = 'post-form'; ageDet = { action: form.getAttribute('action'), method: 'POST', note: 'POST-подтверждение' }; break;
        }
    }
    if (!ageType) for (const cn of ageCN) {
        if (cb.includes(cn)) {
            ageType = 'cookie-flag';
            const vm = cb.match(new RegExp(cn + '\\s*[=:]\\s*["\']?([^"\'\\s;,}{]+)', 'i'));
            ageDet = { cookieName: cn, cookieValue: vm ? vm[1] : '1', note: `Cookie: ${cn}=${vm ? vm[1] : '1'}` }; break;
        }
    }
    if (!ageType) { for (const s of ['#age-verify', '#age-gate', '.age-verify', '.age-gate', '#disclaimer']) try { if (doc.querySelector(s)) { ageType = 'js-overlay'; ageDet = { selector: s, note: 'Overlay' }; break } } catch {} }
    if (!ageType && /(?:мне\s*(?:уже\s*)?18|i\s*am\s*(?:over\s*)?18|18\+)/i.test(doc.body?.textContent || '')) { ageType = 'js-overlay'; ageDet = { note: '18+ text' } }
    if (ageType) r.ageGate = { detected: true, type: ageType, impact: ageType === 'js-overlay' ? 'none' : ageType === 'cookie-flag' ? 'low' : 'medium', ...ageDet };

    r.requiredHeaders = {};
    if (r.ageGate?.cookieName) r.requiredHeaders.Cookie = r.ageGate.cookieName + '=' + (r.ageGate.cookieValue || '1');
    if (r.refererProtected) r.requiredHeaders.Referer = (base || '') + '/';
    r.requiredHeaders['User-Agent'] = getUA();
    return r;
}

// ================================================================
// CARD DETECTION v3
// ================================================================
const RANKED_CARD_SELECTORS = [
    '.video-block', '.video-item', 'div.thumb_main', '.thumb',
    '.thumb-item', '.item', 'article.video', '.video-thumb', '.video',
    '.video-card', '.video_block', '.clip', '.gallery-item', 'article.post',
    '.card', '[data-video-id]', '[data-id]',
    '.mozaique .thumb-block', '.list-videos .video-item', 'div.thumb'
];

function aCards(doc, base) {
    const r = { found: false, cardSelector: null, cardXPath: null, totalCardsFound: 0,
        cardSelectors: { container: null, link: null, title: null, thumbnail: null, thumbnailAttr: null, duration: null },
        sampleCards: [], rankedSelectors: [] };

    let cards = [], uS = '';
    for (const s of RANKED_CARD_SELECTORS) {
        try {
            const f = doc.querySelectorAll(s);
            const count = f.length;
            const hasLink = count >= 2 && Array.from(f).some(e => e.querySelector('a[href]'));
            const hasImg = count >= 2 && Array.from(f).some(e => e.querySelector('img'));
            if (count >= 2) r.rankedSelectors.push({ selector: s, count, hasLink, hasImg, usable: hasLink && hasImg });
            if (!cards.length && hasLink && hasImg) { cards = Array.from(f); uS = s; }
        } catch {}
    }

    if (!cards.length) {
        const videoLinkPats = ['/video/', '/videos/', '/watch/', '/view/', '/embed/', '/v/'];
        const anchors = Array.from(doc.querySelectorAll('a[href]')).filter(a => {
            const h = a.getAttribute('href') || '';
            return videoLinkPats.some(p => h.includes(p)) || /\/\d{4,}\//.test(h);
        });
        if (anchors.length >= 3) {
            const parents = new Map();
            anchors.forEach(a => { let p = a.parentElement; for (let d = 0; d < 5 && p; d++) { const key = p.tagName + (p.className ? '.' + p.className.trim().split(/\s+/)[0] : ''); if (!parents.has(key)) parents.set(key, { el: p, count: 0, depth: d }); parents.get(key).count++; p = p.parentElement } });
            let bestParent = null, bestScore = 0;
            for (const [key, data] of parents) { if (data.count >= 3) { const score = data.count * 10 - data.depth; if (score > bestScore) { bestScore = score; bestParent = data } } }
            if (bestParent) {
                const pp = bestParent.el, tag = pp.tagName.toLowerCase(), cls = pp.className ? '.' + pp.className.trim().split(/\s+/)[0] : '';
                uS = tag + cls;
                const container = pp.parentElement;
                if (container) { const siblings = container.querySelectorAll(':scope > ' + tag + (cls || '')); if (siblings.length >= 2) { cards = Array.from(siblings); uS = tag + cls } else { cards = anchors.map(a => a.closest('div,li,article,section') || a.parentElement).filter(Boolean); cards = [...new Set(cards)]; uS = 'auto-parent' } }
            }
        }
    }

    if (!cards.length) {
        const cands = [];
        doc.querySelectorAll('div,li,article').forEach(el => {
            const imgs = el.querySelectorAll(':scope img,:scope>a>img,:scope>div>img,:scope>a>div>img');
            const links = el.querySelectorAll(':scope a[href]');
            if (imgs.length >= 1 && links.length >= 1 && links.length < 8 && el.children.length < 20) {
                if (el.textContent.length < 2000) cands.push(el);
            }
        });
        if (cands.length >= 3) {
            const groups = new Map();
            cands.forEach(el => { const key = el.tagName + (el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(el) });
            let bestKey = '', bestLen = 0;
            for (const [k, els] of groups) if (els.length > bestLen) { bestLen = els.length; bestKey = k }
            if (bestLen >= 3) { cards = groups.get(bestKey); uS = bestKey } else { cards = cands.slice(0, 20); uS = 'auto-brute' }
        }
    }

    if (!cards.length) return r;
    r.found = true; r.cardSelector = uS; r.totalCardsFound = cards.length; r.cardXPath = genXP(cards[0]);

    const tS = ['.title', '.name', '.video-title', 'a[title]', '[class*="title"]', 'h3', 'h4', 'h2', 'strong', 'b'];
    const dS = ['.duration', '.time', '[class*="duration"]', '[class*="time"]', 'span.length'];
    const imgA = ['data-src', 'data-original', 'data-lazy-src', 'data-thumb', 'data-poster', 'src'];
    const linkPats = ['/video/', '/videos/', '/watch/', '/view/', '/v/'];
    let linkSel = null, titleSel = null, thumbSel = null, thumbAttr = null, durSel = null;

    for (let i = 0; i < Math.min(8, cards.length); i++) {
        const card = cards[i], cd = {};
        const linkEls = [...card.querySelectorAll('a[href]')]; let linkEl = null;
        for (const a of linkEls) { const h = a.getAttribute('href') || ''; if (linkPats.some(p => h.includes(p)) || /\/\d{3,}/.test(h)) { linkEl = a; break } }
        if (!linkEl) linkEl = linkEls[0];
        if (linkEl) {
            cd.link = resolve(linkEl.getAttribute('href'), base);
            if (i === 0 && !linkSel) { const h = linkEl.getAttribute('href') || ''; if (linkPats.some(p => h.includes(p))) { const pat = linkPats.find(p => h.includes(p)); linkSel = `a[href*="${pat}"]` } else linkSel = 'a[href]' }
        }
        let titleFound = false;
        for (const ts of tS) if (!titleFound) try { const el = card.querySelector(ts); if (el) { const t = ts === 'a[title]' ? (el.getAttribute('title') || '') : el.textContent.trim(); if (t && t.length > 2 && t.length < 300) { cd.title = t; if (i === 0 && !titleSel) titleSel = ts; titleFound = true } } } catch {}
        if (!titleFound && linkEl) { const lt = linkEl.getAttribute('title') || ''; if (lt.length > 2) { cd.title = lt; if (i === 0 && !titleSel) titleSel = 'a[title]'; titleFound = true } }
        if (!titleFound) { const img = card.querySelector('img[alt]'); if (img) { const alt = img.getAttribute('alt') || ''; if (alt.length > 3) { cd.title = alt; if (i === 0 && !titleSel) titleSel = 'img[alt]'; titleFound = true } } }
        if (!titleFound && linkEl) { const lt = linkEl.textContent.trim(); if (lt.length > 3 && lt.length < 200) { cd.title = lt; if (i === 0 && !titleSel) titleSel = 'a'; titleFound = true } }
        card.querySelectorAll('img').forEach(img => { if (cd.thumbnail) return; for (const at of imgA) { const sv = img.getAttribute(at); if (sv && !sv.startsWith('data:') && sv.length > 10 && !sv.includes('spacer') && !sv.includes('blank')) { cd.thumbnail = resolve(sv, base); if (i === 0 && !thumbSel) { thumbSel = 'img'; thumbAttr = at } break } } });
        for (const ds of dS) try { const el = card.querySelector(ds); if (el) { let t = el.textContent.trim(); if (/\d{1,3}:\d{2}/.test(t)) { const m = t.match(/\d{1,3}:\d{2}(?::\d{2})?/); if (m) { cd.duration = m[0]; if (i === 0 && !durSel) durSel = ds; break } } } } catch {}
        if (!cd.duration) { for (const el of card.querySelectorAll('span,div,small,em,p')) { const t = el.textContent.trim(); if (/^\d{1,3}:\d{2}(:\d{2})?$/.test(t)) { cd.duration = t; if (i === 0 && !durSel) durSel = el.tagName.toLowerCase() + (el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''); break } } }
        for (const qs of ['.quality', '.hd', '[class*="quality"]']) try { const el = card.querySelector(qs); if (el) { const t = el.textContent.trim(); if (/\b(HD|4K|1080|720)\b/i.test(t)) { cd.quality = t; break } } } catch {}
        const viewEl = card.querySelector('.views,[class*="view"],[class*="watch"]');
        if (viewEl) { const vm = viewEl.textContent.match(/([\d,.]+\s*[KkMm]?)/); if (vm) cd.views = vm[0].trim() }
        if (cd.link || cd.title || cd.thumbnail) r.sampleCards.push(cd);
    }

    r.cardSelectors = { container: uS, link: linkSel ? `${uS} ${linkSel}` : null, title: titleSel ? `${uS} ${titleSel}` : null,
        thumbnail: thumbSel ? `${uS} ${thumbSel}` : null, thumbnailAttr: thumbAttr, duration: durSel ? `${uS} ${durSel}` : null };
    if (r.sampleCards.length) try { const u = new URL(r.sampleCards[0].link); r.linkPattern = u.pathname.replace(/\/\d+\//g, '/{id}/').replace(/\/[a-z0-9_-]{8,}\/?$/i, '/{slug}/') } catch {}
    return r;
}

// ================================================================
// MAIN PAGE PATH / SEARCH / JS NAV
// ================================================================
function detectMainPagePath(doc, base, url) {
    const path = new URL(url).pathname, candidates = [path];
    const feedPats = ['/latest-updates', '/newest', '/recent', '/new', '/videos', '/all', '/popular', '/best'];
    doc.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href') || ''; for (const fp of feedPats) if (h.includes(fp)) { candidates.push(new URL(resolve(h, base)).pathname); break } });
    doc.querySelectorAll('nav a[href],header a[href],.menu a[href],[class*="nav"] a[href]').forEach(a => { const h = a.getAttribute('href') || ''; for (const fp of feedPats) if (h.includes(fp)) { const p = new URL(resolve(h, base)).pathname; if (!candidates.includes(p)) candidates.push(p) } });
    return uniq(candidates).slice(0, 5);
}

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
    doc.querySelectorAll('a[href*="search"],a[href*="query"],a[href*="?q="],a[href*="?k="],a[href*="?s="]').forEach(a => {
        if (r.paramName) return; const h = a.getAttribute('href') || ''; const pm = h.match(/[?&](q|k|s|search|query)=/i);
        if (pm) { r.paramName = pm[1].toLowerCase(); r.pattern = base + '/?' + r.paramName + '={query}' }
    });
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
    for (const pg of pgPatterns) { if (pg.re.test(allContent)) { patterns.pagination = pg.tpl; break; } }
    if (!patterns.pagination) patterns.pagination = '?page={N}';
    const sortLinks = allContent.match(/[?&]sort=([a-z0-9_-]+)/gi);
    if (sortLinks) patterns.sorting = base + '/?sort={value}';
    return patterns;
}

function parseJsNav(doc, html, base) {
    const all = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n'), cb = all + '\n' + html;
    const r = { categories: { fromJs: [], fromHtml: [], merged: [] }, channels: { fromJs: [], fromHtml: [], merged: [], urlPattern: null }, sorting: { fromJs: [] }, urlScheme: {} };
    const jC = new Map();
    [/new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*[?&]c=([A-Za-z0-9_-]+(?:-\d+)?)/g, /new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*"[&?]c=([A-Za-z0-9_-]+(?:-\d+)?)"/g].forEach(pat => { let m; while ((m = pat.exec(cb)) !== null) { const n = m[1].trim(), s = m[2]; if (n && s && !jC.has(s)) jC.set(s, { name: n, slug: s, url: base + '/?c=' + s }) } pat.lastIndex = 0 });
    let cm; const cP = /[?&]c=([A-Za-z0-9_-]+(?:-\d+)?)/g;
    while ((cm = cP.exec(cb)) !== null) { const s = cm[1]; if (!jC.has(s) && s.length > 1) jC.set(s, { name: s.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), slug: s, url: base + '/?c=' + s }) }
    r.categories.fromJs = [...jC.values()];
    for (const sel of ['a[href*="/c/"]', 'a[href*="?c="]', 'a[href*="/categories/"]', 'a[href*="/category/"]']) try {
        const lnk = doc.querySelectorAll(sel);
        if (lnk.length >= 3) { lnk.forEach(a => { const href = a.getAttribute('href'), nm = a.textContent.trim(); if (href && nm) { let sl = ''; const cM = href.match(/[?&]c=([^&]+)/), pM = href.match(/\/c(?:ategor(?:y|ies))?\/([^/?]+)/); sl = cM ? cM[1] : pM ? pM[1] : href.split('/').filter(Boolean).pop() || ''; r.categories.fromHtml.push({ name: nm, slug: sl, url: resolve(href, base) }) } }); break }
    } catch {}
    const mm = new Map(); r.categories.fromJs.forEach(c => mm.set(c.slug, c)); r.categories.fromHtml.forEach(c => { if (!mm.has(c.slug)) mm.set(c.slug, c) });
    r.categories.merged = [...mm.values()]; r.categories.totalCount = r.categories.merged.length; r.categories.source = r.categories.fromJs.length > r.categories.fromHtml.length ? 'JavaScript' : 'HTML';

    const chM = new Map();
    [/new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*\/channels?\/([A-Za-z0-9_-]+)/g, /new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*\/pornstars?\/([A-Za-z0-9_-]+)/g].forEach(pat => { let m; while ((m = pat.exec(cb)) !== null) { const n = m[1].trim(), s = m[2]; if (n && s && !chM.has(s)) chM.set(s, { name: n, slug: s }) } pat.lastIndex = 0 });
    r.channels.fromJs = [...chM.values()];
    for (const sel of ['a[href*="/channels/"]', 'a[href*="/channel/"]', 'a[href*="/pornstar"]']) try {
        doc.querySelectorAll(sel).forEach(a => { const href = a.getAttribute('href'), nm = a.textContent.trim(); if (href && nm) { const sl = href.split('/').filter(Boolean).pop() || ''; if (!chM.has(sl)) r.channels.fromHtml.push({ name: nm, slug: sl, url: resolve(href, base) }) } }); break
    } catch {}
    const chMerge = new Map(); r.channels.fromJs.forEach(c => chMerge.set(c.slug, c)); r.channels.fromHtml.forEach(c => { if (!chMerge.has(c.slug)) chMerge.set(c.slug, c) });
    r.channels.merged = [...chMerge.values()]; r.channels.totalCount = r.channels.merged.length;
    const chLink = doc.querySelector('a[href*="/channels/"],a[href*="/channel/"]');
    r.channels.urlPattern = chLink ? ((chLink.getAttribute('href') || '').includes('/channels/') ? '/channels/{slug}' : '/channel/{slug}') : null;
    const jsS = new Map(); const svP = /[?&]sort=([a-z0-9_-]+)/gi;
    while ((cm = svP.exec(cb)) !== null) { const v = cm[1]; if (!jsS.has(v)) jsS.set(v, { label: v.replace(/[-_]/g, ' '), param: 'sort=' + v }) }
    r.sorting.fromJs = [...jsS.values()];
    return r;
}

// ================================================================
// KT_PLAYER / LICENSE_CODE
// ================================================================
function detectKtPlayerScript(doc, extScripts) {
    for (const src of extScripts) if (/kt_player|kt-player|ktplayer/i.test(src)) return src;
    for (const src of extScripts) if (/\/player\/[^"']+\.js/i.test(src)) return src;
    const allJS = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const m = allJS.match(/["']((?:https?:)?\/\/[^"']*kt_player[^"']*\.js[^"']*)/i) || allJS.match(/["'](\/player\/[^"']+\.js)/i);
    if (m) return m[1];
    return null;
}

function extractLicenseCode(html, allJS) {
    const combined = html + '\n' + allJS;
    const patterns = [
        /license_code\s*[:=]\s*['"]([^'"]+)['"]/,
        /kt_player\s*\([^)]*,\s*['"]([^'"]{10,})['"]\s*[,)]/,
        /var\s+license\s*=\s*['"]([^'"]+)['"]/
    ];
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
    r.tailHandling = /\.slice\(|\.substring\(/.test(block) ? 'slice-remainder' : /if\s*\([^)]*length/.test(block) ? 'conditional-skip' : 'none';
    r.algorithm = `license_code.substr(i,${r.chunkSize}) → parseInt → % ${r.modulo || '?'} → shift(${r.direction})` + (r.functionMarker !== null ? ` [/function/${r.functionMarker}/]` : '');
    return r;
}

function buildKtDecodeSnippet(analysis, licenseCode) {
    if (!analysis.found && !licenseCode) return null;
    const chunk = analysis?.chunkSize || 1, mod = analysis?.modulo || 9, dir = analysis?.direction || 'forward';
    let code = `// kt_player decode — auto-generated\n// chunkSize=${chunk}, modulo=${mod}, direction=${dir}\n\n`;
    code += `function decodeVideoUrl(encodedUrl, licenseCode) {\n  licenseCode = licenseCode || ${JSON.stringify(licenseCode || '')};\n`;
    code += `  var funcMatch = encodedUrl.match(/\\/function\\/(\\d)\\/(.*)/);  \n  var encoded = funcMatch ? funcMatch[2] : encodedUrl;\n`;
    code += `  var codes = [];\n  for (var i = 0; i < licenseCode.length; i += ${chunk}) {\n    var n = parseInt(licenseCode.substr(i, ${chunk}));\n    if (!isNaN(n)) codes.push(n % ${mod});\n  }\n`;
    if (dir === 'reverse') {
        code += `  var decoded = '', ci = codes.length - 1;\n  for (var j = encoded.length - 1; j >= 0; j--) {\n    decoded = String.fromCharCode(encoded.charCodeAt(j) - codes[ci]) + decoded;\n    ci--; if (ci < 0) ci = codes.length - 1;\n  }\n`;
    } else {
        code += `  var decoded = '';\n  for (var j = 0; j < encoded.length; j++) {\n    decoded += String.fromCharCode(encoded.charCodeAt(j) - codes[j % codes.length]);\n  }\n`;
    }
    code += `  return decoded;\n}\n`;
    return code;
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
    } catch { return null; }
    return null;
}

function ktDecodeMethod0(encoded, licenseCode) {
    const codes = [];
    for (let i = 0; i < licenseCode.length; i++) { const num = parseInt(licenseCode[i]); if (!isNaN(num)) codes.push(num % 9); }
    if (!codes.length) return null;
    let decoded = '';
    for (let i = 0; i < encoded.length; i++) decoded += String.fromCharCode(encoded.charCodeAt(i) - codes[i % codes.length]);
    if (decoded.startsWith('http') && (decoded.includes('/get_file/') || decoded.includes('.mp4') || decoded.includes('.m3u8'))) return decoded;
    const codes2 = [];
    for (let i = 0; i + 1 < licenseCode.length; i += 2) { const num = parseInt(licenseCode.substr(i, 2)); if (!isNaN(num)) codes2.push(num % 9); }
    if (!codes2.length) return null;
    let decoded2 = '';
    for (let i = 0; i < encoded.length; i++) decoded2 += String.fromCharCode(encoded.charCodeAt(i) - codes2[i % codes2.length]);
    if (decoded2.startsWith('http') && (decoded2.includes('/get_file/') || decoded2.includes('.mp4'))) return decoded2;
    return null;
}

function ktDecodeMethod1(encoded, licenseCode) {
    const codes = [];
    for (let i = 0; i < licenseCode.length; i++) { const num = parseInt(licenseCode[i]); if (!isNaN(num)) codes.push(num % 9); }
    if (!codes.length) return null;
    let decoded = '', ci = codes.length - 1;
    for (let i = encoded.length - 1; i >= 0; i--) { decoded = String.fromCharCode(encoded.charCodeAt(i) - codes[ci]) + decoded; ci--; if (ci < 0) ci = codes.length - 1; }
    if (decoded.startsWith('http') && (decoded.includes('/get_file/') || decoded.includes('.mp4'))) return decoded;
    return null;
}

// ================================================================
// REDIRECT & KVS DETECTION
// ================================================================
function detectRedirectPattern(videoUrls, siteHost) {
    const result = { hasRedirect: false, patterns: [], requiresFollow: false, getFilePattern: false, cdnChain: false };
    for (const vu of videoUrls) {
        const u = typeof vu === 'string' ? vu : (vu.src || vu.url || '');
        if (!u) continue;
        if (/\/get_file\/\d+\/[a-f0-9]+\//i.test(u)) {
            result.hasRedirect = true; result.getFilePattern = true;
            result.patterns.push({ type: 'kvs_get_file', url: u, description: '/get_file/{id}/{hash}/ → 302 → CDN', workerMode: 'follow' });
        }
        if (/[?&](sign|token|hash)=/.test(u) && !/(cdn|edge|stream|media)\./i.test(u)) {
            result.hasRedirect = true;
            result.patterns.push({ type: 'signed_redirect', url: u, description: 'Signed URL → 302 → CDN edge', workerMode: 'follow' });
        }
        try {
            const videoHost = new URL(u, 'https://' + siteHost).hostname;
            if (videoHost !== siteHost && !/cdn|stream|media|edge|video/i.test(videoHost))
                result.patterns.push({ type: 'different_host', url: u, videoHost, description: 'Video URL on different host' });
        } catch {}
    }
    result.requiresFollow = result.getFilePattern || result.patterns.some(p => p.type === 'signed_redirect');
    return result;
}

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
    return { isKvs: score >= 2, confidence: Math.min(score / 5, 1), markers,
        note: score >= 3 ? 'KVS (Kernel Video Sharing) engine' : score >= 2 ? 'Likely KVS-based' : 'Not KVS' };
}

// ================================================================
// WORKER NECESSITY VERDICT
// ================================================================
function assessWorkerNecessity(prot, redirectChain, kvsEngine) {
    const reasons = [];
    let required = false;
    if (prot?.cloudflare) { reasons.push({ reason: 'Cloudflare bypass', type: prot.cloudflareTurnstile ? 'critical' : 'cors' }); required = true; }
    if (prot?.ddosGuard) { reasons.push({ reason: 'DDoS-Guard bypass', type: 'cors' }); required = true; }
    if (prot?.ageGate?.type === 'cookie-flag' || prot?.ageGate?.type === 'post-form') { reasons.push({ reason: 'Age gate cookies', type: 'cookies' }); required = true; }
    if (prot?.refererProtected) { reasons.push({ reason: 'Referer header required', type: 'headers' }); required = true; }
    if (redirectChain?.requiresFollow) { reasons.push({ reason: 'Follow 302 redirects', type: 'redirect' }); required = true; }
    if (kvsEngine?.isKvs) { reasons.push({ reason: 'KVS session-bound URLs', type: 'resolve-page' }); required = true; }
    if (prot?.drm) { reasons.push({ reason: 'DRM protected', type: 'impossible' }); }
    let mode = 'none';
    if (reasons.some(r => r.type === 'impossible')) mode = 'impossible';
    else if (reasons.some(r => r.type === 'resolve-page')) mode = 'resolve-page';
    else if (reasons.some(r => r.type === 'redirect')) mode = 'follow-redirect';
    else if (reasons.some(r => r.type === 'critical')) mode = 'headless';
    else if (required) mode = 'cors-proxy';
    return { required, mode, reasons, summary: required ? `Worker needed: ${mode}` : 'Direct fetch possible' };
}

// ================================================================
// CDN WHITELIST
// ================================================================
function buildWhitelist(base, strategies, cards) {
    const domains = new Map();
    domains.set(hostOf(base), { domain: hostOf(base), role: 'site', required: true });
    // Collect from all strategy foundUrls
    for (const s of (strategies || [])) {
        for (const u of (s.foundUrls || [])) {
            try {
                // Handle "url [quality]" format
                const cleanU = u.replace(/\s*\[.*\]$/, '');
                const d = new URL(cleanU).hostname;
                if (d && d !== hostOf(base) && !domains.has(d)) domains.set(d, { domain: d, role: 'video CDN (' + s.id + ')', required: true });
            } catch {}
        }
    }
    (cards?.sampleCards || []).forEach(c => { const d = hostOf(c.thumbnail || ''); if (d && d !== hostOf(base) && !domains.has(d)) domains.set(d, { domain: d, role: 'thumb CDN', required: false }) });
    const list = [...domains.values()];
    const code = 'const ALLOWED_TARGETS = [\n' + list.filter(d => d.required).map(d => `  "${d.domain}",  // ${d.role}`).join('\n') + '\n];';
    return { required: list.filter(d => d.required), all: list, code };
}

// ================================================================
// isVideoScript helper
// ================================================================
function isVideoScript(src) {
    if (!src) return false;
    if (/jquery|react|vue|angular|bootstrap|analytics|tracking|ads|cdn|polyfill|webpack|chunk/i.test(src)) return false;
    return /video\d+|clip\d+|media\d+|stream\d+|embed\d+|config\d+|player.*\d{3,}/i.test(src);
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
    const result = { _meta: { analyzedUrl: url, baseUrl: base, analyzedAt: new Date().toISOString(), mode: 'catalog', testWord: getTestWord(), tool: 'v6.0.0' } };

    try {
        setStatus('📥', 'loading'); setProgress(10, '📡');
        let html;
        try { html = await fetchPage(url) } catch (e) {
            setProgress(10, '❌', 'cors-error'); setStatus('❌ ' + e.message, 'error');
            result._error = { type: isCE(e) ? 'CORS' : 'FETCH', message: e.message };
            catalogData = result; analysisResult = buildFinalJSON(); displayResults(analysisResult); return;
        }
        const doc = parseH(html); setProgress(20, 'DOM');
        const dom = aDom(doc), fw = aFW(doc, html);
        setProgress(30, 'Prot'); const prot = aProt(doc, html, base); result.protection = prot; result.encoding = aEnc(doc);
        setProgress(40, 'Cards'); result.videoCards = aCards(doc, base);
        setProgress(50, 'Nav'); result.navigation = parseJsNav(doc, html, base);
        setProgress(55, 'BuildUrl'); result.buildUrlPatterns = detectBuildUrlPatterns(doc, html, base, result.searchPattern, result.navigation);
        setProgress(60, 'Search'); result.searchPattern = detectSearchPattern(doc, html, base);
        setProgress(65, 'MainPage'); result.mainPagePaths = detectMainPagePath(doc, base, url);
        setProgress(68, 'CleanUrl'); result.cleanUrlRules = detectCleanUrlRules(html, Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n'));
        setProgress(70, 'Mirrors'); result.mirrors = detectMirrors(html, doc, base);
        setProgress(75, 'JSD');
        const jsReq = (() => { const root = doc.querySelector('#app,#root,#__next'); if (root && root.children.length <= 3) return 'yes'; if (dom.totalElements < 80) return 'yes'; if (result.videoCards.found) return 'no'; if (fw.some(f => ['JW Player', 'Video.js', 'HLS.js', 'Flowplayer', 'Plyr'].includes(f))) return 'partial'; return 'no' })();
        const sP = result.searchPattern.paramName || 'q', eTW = encodeURIComponent(getTestWord());
        result.navigation.urlScheme = { base, search: { paramName: sP, pattern: result.searchPattern.pattern || base + '/?' + sP + '={query}', example: base + '/?' + sP + '=' + eTW }, category: { paramName: 'c', pattern: result.buildUrlPatterns?.category || base + '/?c={slug}' }, channel: { pattern: result.navigation.channels.urlPattern ? base + result.navigation.channels.urlPattern : null }, sorting: { options: result.navigation.sorting.fromJs, pattern: result.buildUrlPatterns?.sorting || base + '/?sort={value}' }, pagination: { pattern: result.buildUrlPatterns?.pagination || '&page={N}' } };
        result.searchExamples = [{ label: 'Search: ' + getTestWord(), url: base + '/?' + sP + '=' + eTW }];
        result.navigation.sorting.fromJs.forEach(s => result.searchExamples.push({ label: 'Search+' + s.label, url: base + '/?' + s.param + '&' + sP + '=' + eTW }));
        result.architecture = { jsRequired: jsReq, frameworks: fw, recommendation: { method: jsReq === 'yes' ? 'Headless' : 'CSS+XPath', tools: jsReq === 'yes' ? 'Puppeteer' : 'Cheerio', transport: prot.cloudflare ? 'Worker' : 'Proxy/direct' } };
        result._transportLog = transportLog; catalogData = result; videoPageData = null;
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
    try { new URL(url) } catch { setStatus('❌ Bad URL', 'error'); return }
    const base = catalogData ? catalogData._meta.baseUrl : baseOf(url);
    const btn = $('btnAnalyze');
    if (btn) { btn.disabled = true; btn.textContent = '🎬⏳' }
    updCI('hidden'); transportLog = [];
    const vd = { analyzed: false, url };

    try {
        setStatus('🎬 Видео...', 'loading'); setProgress(15, '🎬', 'video-mode');
        const html = await fetchPage(url);
        const doc = parseH(html); vd.analyzed = true; vd.title = doc.title;
        const h1 = doc.querySelector('h1'); if (h1) vd.videoTitle = h1.textContent.trim();
        const ogImg = doc.querySelector('meta[property="og:image"]'); if (ogImg) vd.poster = ogImg.getAttribute('content');
        const allInline = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
        const allContent = html + '\n' + allInline;

        setProgress(30, '🎬 Debug...');
        vd.debugReport = buildDebugReport(allContent);

        setProgress(35, '🎬 Strategies...');
        vd.strategies = detectAllStrategies(html, allInline, doc, base);

        setProgress(45, '🎬 CleanUrl...');
        vd.cleanUrlRules = detectCleanUrlRules(html, allInline);

        setProgress(50, '🎬 Mirrors...');
        vd.mirrors = detectMirrors(html, doc, base);

        setProgress(55, '🎬 ExtJS...');
        const extSrcs = Array.from(doc.querySelectorAll('script[src]')).map(s => s.getAttribute('src')).filter(Boolean);
        const videoScripts = extSrcs.filter(isVideoScript).slice(0, 3);
        vd.externalScripts = [];
        for (const vs of videoScripts) {
            const full = resolve(vs, base);
            try {
                logT('ExtJS:' + vs);
                const jsCode = await fetchPage(full);
                const info = { src: vs, fetched: true, size: jsCode.length };
                // Run strategy detection on external JS too
                const extDoc = parseH('<html><body></body></html>');
                const extStrategies = detectAllStrategies('', jsCode, extDoc, base);
                if (extStrategies.length) {
                    info.strategiesFound = extStrategies.length;
                    // Merge strategies — add new ones, enhance existing with more URLs
                    for (const es of extStrategies) {
                        const existing = vd.strategies.find(s => s.id === es.id);
                        if (existing) {
                            existing.foundUrls = uniq([...existing.foundUrls, ...es.foundUrls]);
                            if (es.confidence === 'confirmed' && existing.confidence !== 'confirmed') existing.confidence = 'confirmed';
                        } else {
                            vd.strategies.push(es);
                        }
                    }
                }
                vd.externalScripts.push(info);
            } catch (e) { vd.externalScripts.push({ src: vs, fetched: false, error: e.message }) }
        }

        // Re-sort after merging external scripts
        vd.strategies.sort((a, b) => {
            const confOrder = { confirmed: 0, detected: 1, inferred: 2 };
            const ca = confOrder[a.confidence] ?? 9, cb2 = confOrder[b.confidence] ?? 9;
            if (ca !== cb2) return ca - cb2;
            return a.block - b.block;
        });
        vd.strategies.forEach((s, i) => { s.priority = i + 1; });

        // kt_player decode analysis
        setProgress(60, '🎬 KT...');
        const hasKt = vd.strategies.some(s => s.id === 'S1' || s.id === 'S12') && /kt_player|license_code/i.test(allContent);
        if (hasKt) {
            const licenseCode = extractLicenseCode(html, allInline);
            vd.ktDecode = { licenseCode };
            const ktSrc = detectKtPlayerScript(doc, extSrcs);
            if (ktSrc) {
                try {
                    logT('KT: ' + ktSrc);
                    const ktFull = resolve(ktSrc, base);
                    const ktCode = await fetchPage(ktFull);
                    const analysis = analyzeKtDecodeFunction(ktCode);
                    vd.ktDecode.analysis = analysis;
                    vd.ktDecode.ktPlayerJsUrl = ktSrc;
                    vd.ktDecode.ktPlayerJsSize = ktCode.length;
                    if (analysis.found && licenseCode) {
                        vd.ktDecode.decodeSnippet = buildKtDecodeSnippet(analysis, licenseCode);
                    }
                    // Try decoding found URLs
                    if (licenseCode) {
                        for (const s of vd.strategies) {
                            const decoded = [];
                            for (const u of (s.foundUrls || [])) {
                                const cleanU = u.replace(/\s*\[.*\]$/, '');
                                if (cleanU.includes('/function/')) {
                                    const d = tryKtDecode(cleanU, licenseCode);
                                    if (d) decoded.push({ encoded: cleanU, decoded: d });
                                }
                            }
                            if (decoded.length) {
                                s.decodedUrls = decoded;
                                // Replace encoded with decoded in foundUrls
                                for (const dd of decoded) {
                                    const idx = s.foundUrls.indexOf(dd.encoded);
                                    if (idx !== -1) s.foundUrls[idx] = dd.decoded + ' [decoded]';
                                }
                            }
                        }
                    }
                    logT('KT: ' + (analysis.found ? '✅ found' : '❌ not found'), analysis.found ? 'success' : 'fail');
                } catch (e) { logT('KT: ' + e.message, 'fail') }
            }
        }

        // Collect all video URLs from strategies for redirect/KVS analysis
        setProgress(68, '🎬 Redirect...');
        const allVideoUrls = [];
        for (const s of vd.strategies) {
            for (const u of (s.foundUrls || [])) {
                const cleanU = u.replace(/\s*\[.*\]$/, '');
                if (cleanU.startsWith('http')) allVideoUrls.push(cleanU);
            }
        }
        vd.redirectChain = detectRedirectPattern(allVideoUrls, hostOf(base));
        vd.kvsEngine = detectKvsEngine(allContent, allInline);

        // CDN resolution via worker
        setProgress(72, '🎬 CDN...');
        if (vd.redirectChain?.requiresFollow) {
            vd.redirectResolution = [];
            const w = getW();
            if (w) {
                try {
                    logT('Resolve-page: ' + url.substring(0, 60));
                    const rpUrl = w + '/resolve-page?url=' + encodeURIComponent(url) + '&max=8';
                    const a = new AbortController, t = setTimeout(() => a.abort(), 25000);
                    const r = await fetch(rpUrl, { signal: a.signal });
                    clearTimeout(t);
                    if (r.ok) {
                        const data = await r.json();
                        logT('Resolve-page: ' + (data.redirects || 0) + ' hops', data.error ? 'fail' : 'success');
                        vd.redirectResolution.push({
                            original: data.videoUrl || url, final: data.final, chain: data.chain,
                            redirectCount: data.redirects || 0, contentType: data.contentType,
                            contentLength: data.contentLength, resumable: data.resumable, error: data.error
                        });
                    }
                } catch (e) { logT('Resolve-page: ' + e.message, 'fail'); }
            }
        }

        setProgress(78, '🎬 Prot...');
        const prot = aProt(doc, html, base); vd.protection = prot;

        setProgress(82, '🎬 Worker verdict...');
        vd.workerVerdict = assessWorkerNecessity(prot, vd.redirectChain, vd.kvsEngine);

        setProgress(88, '🎬 Whitelist...');
        vd.workerWhitelist = buildWhitelist(base, vd.strategies, catalogData?.videoCards);

        // Add resolved CDN domains to whitelist
        if (vd.redirectResolution?.length) {
            for (const rr of vd.redirectResolution) {
                if (rr.final) { const d = hostOf(rr.final); if (d && !vd.workerWhitelist.required.some(w2 => w2.domain === d)) vd.workerWhitelist.required.push({ domain: d, role: 'CDN (resolved)', required: true }); }
                if (rr.chain) { for (const cu of rr.chain) { const d = hostOf(cu); if (d && !vd.workerWhitelist.required.some(w2 => w2.domain === d)) vd.workerWhitelist.required.push({ domain: d, role: 'CDN (chain)', required: true }); } }
            }
            vd.workerWhitelist.code = 'const ALLOWED_TARGETS = [\n' + vd.workerWhitelist.required.map(d => `  "${d.domain}",  // ${d.role}`).join('\n') + '\n];';
        }

        setProgress(92, '🎬 Done');
    } catch (e) { vd.error = e.message }

    vd._transportLog = transportLog; videoPageData = vd;
    analysisResult = buildFinalJSON(); displayResults(analysisResult);
    setProgress(100, '✅');
    setStatus(catalogData ? '✅ Каталог + Видео = полный JSON' : '✅ Видео', 'success');
    if (btn) { btn.disabled = false; btn.textContent = '🎬 Анализ видео' }
    updMerge();
}

// ================================================================
// REDIRECT URL ANALYSIS
// ================================================================
async function runRedirectAnalysis() {
    const redirectUrl = prompt('Вставьте CDN URL (финальная ссылка после редиректа):', '');
    if (!redirectUrl || !redirectUrl.startsWith('http')) { setStatus('❌ URL http...', 'error'); return; }
    const btn = $('btnAnalyze');
    if (btn) { btn.disabled = true; btn.textContent = '🔄⏳'; }
    setStatus('🔄 Redirect...', 'loading'); setProgress(10, '🔄', 'video-mode'); transportLog = [];

    try {
        logT('Redirect URL: ' + redirectUrl);
        const w = getW();
        if (!w) { setStatus('❌ Worker', 'error'); return; }

        setProgress(30, '🔄 HEAD...');
        const resolveUrl = w + '/resolve?url=' + encodeURIComponent(redirectUrl) + '&max=8';
        const a = new AbortController, t = setTimeout(() => a.abort(), 20000);
        const r = await fetch(resolveUrl, { signal: a.signal });
        clearTimeout(t);
        let data = {};
        if (r.ok) { data = await r.json(); logT('Resolved: ' + (data.redirects || 0) + ' hops', 'success'); }
        else { logT('HTTP ' + r.status, 'fail'); data = { error: 'HTTP ' + r.status, final: redirectUrl, redirects: 0, chain: [redirectUrl] }; }

        setProgress(60, '🔄 Analyzing...');
        let urlInfo = {};
        try { const u = new URL(data.final || redirectUrl); urlInfo = { hostname: u.hostname, pathname: u.pathname, params: Object.fromEntries(u.searchParams.entries()) }; } catch {}

        const params = urlInfo.params || {};
        const cdnInfo = {
            url: data.final || redirectUrl, domain: urlInfo.hostname,
            resumable: data.resumable || false, contentType: data.contentType || '',
            contentLength: data.contentLength || '', redirects: data.redirects || 0,
            chain: data.chain || [redirectUrl],
            expireTime: params.exp_time ? new Date(parseInt(params.exp_time) * 1000).toISOString() : null,
            sign: params.sign || null, tag: params.tag || null,
            filename: urlInfo.pathname ? urlInfo.pathname.split('/').pop() : null,
        };
        const qMatch = (cdnInfo.filename || '').match(/_(\d+p)\./);
        cdnInfo.quality = qMatch ? qMatch[1] : null;
        if (cdnInfo.expireTime) {
            cdnInfo.expired = new Date(cdnInfo.expireTime) < new Date();
            cdnInfo.expiresIn = cdnInfo.expired ? 'EXPIRED' : Math.round((new Date(cdnInfo.expireTime) - new Date()) / 60000) + ' min';
        }
        if (cdnInfo.contentLength) {
            const bytes = parseInt(cdnInfo.contentLength);
            cdnInfo.sizeHuman = bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : bytes > 1024 ? (bytes / 1024).toFixed(1) + ' KB' : bytes + ' B';
        }

        // Update whitelist
        if (videoPageData?.workerWhitelist) {
            const domainsToAdd = new Set([cdnInfo.domain]);
            if (data.chain) data.chain.forEach(cu => { try { domainsToAdd.add(new URL(cu).hostname); } catch {} });
            for (const d of domainsToAdd) { if (d && !videoPageData.workerWhitelist.required.some(w2 => w2.domain === d)) videoPageData.workerWhitelist.required.push({ domain: d, role: 'CDN (redirect)', required: true }); }
            videoPageData.workerWhitelist.code = 'const ALLOWED_TARGETS = [\n' + videoPageData.workerWhitelist.required.map(d => `  "${d.domain}",  // ${d.role}`).join('\n') + '\n];';
        }

        if (!videoPageData) videoPageData = { analyzed: true, url: redirectUrl, strategies: [] };
        videoPageData.redirectAnalysis = cdnInfo;
        if (!videoPageData.redirectResolution) videoPageData.redirectResolution = [];
        videoPageData.redirectResolution.push({
            original: redirectUrl, final: data.final || redirectUrl, chain: data.chain || [redirectUrl],
            redirectCount: data.redirects || 0, contentType: data.contentType, contentLength: data.contentLength,
            resumable: data.resumable, pattern: 'cdn_direct', manualInput: true
        });
        videoPageData._transportLog = transportLog;

        analysisResult = buildFinalJSON();
        displayResults(analysisResult); setProgress(100, '✅'); setStatus('✅ CDN: ' + cdnInfo.domain, 'success');
    } catch (e) { setStatus('❌ ' + e.message, 'error'); logT('Redirect error: ' + e.message, 'fail'); }
    if (btn) { btn.disabled = false; btn.textContent = isVideoMode() ? '🎬 Анализ видео' : '🚀 Анализ каталога'; }
}

// ================================================================
// DIRECT TEST
// ================================================================
async function runDirectTest() {
    const url = $('targetUrl')?.value.trim();
    if (!url) return setStatus('❌ URL!', 'error');
    const base = baseOf(url), btn = $('btnAnalyze');
    if (btn) { btn.disabled = true; btn.textContent = '🧪' }
    const checks = []; setStatus('🧪', 'loading'); setProgress(10, '🧪');
    let html = null;
    try {
        const ac = new AbortController, t = setTimeout(() => ac.abort(), 12000);
        const r = await fetch(url, { signal: ac.signal }); clearTimeout(t);
        if (r.ok) { html = await r.text(); checks.push({ icon: '✅', label: 'Direct fetch', hint: `HTTP ${r.status}, ${(html.length / 1024 | 0)}KB` }) }
        else checks.push({ icon: '❌', label: 'Direct fetch', hint: `HTTP ${r.status}` });
    } catch (e) { checks.push({ icon: '❌', label: 'Direct fetch', hint: isCE(e) ? 'CORS' : e.message }) }

    if (html) {
        const doc = parseH(html), dt = doc.querySelectorAll('*').length, lc = html.toLowerCase();
        checks.push({ icon: dt > 100 ? '✅' : '❌', label: 'SSR (DOM ' + dt + ')', hint: dt > 100 ? 'OK' : 'Too small' });
        const testCards = aCards(doc, base);
        checks.push({ icon: testCards.found ? '✅' : '❌', label: 'Cards: ' + (testCards.found ? testCards.totalCardsFound + ' (' + testCards.cardSelector + ')' : 'not found'), hint: testCards.found ? 'Selector works' : 'Check manually' });
        if (lc.includes('challenges.cloudflare.com')) checks.push({ icon: '⚠️', label: 'Cloudflare', hint: lc.includes('turnstile') ? 'Turnstile' : 'Basic' });
    }

    analysisResult = { _meta: { url, mode: 'direct-test', tool: 'v6.0.0' }, directTest: { checks } };
    displayResults(analysisResult);
    setProgress(100, '✅'); setStatus('🧪 Done', 'success');
    if (btn) { btn.disabled = false; btn.textContent = '🚀 Анализ каталога' }
}

// ================================================================
// BUILD FINAL JSON — v6.0.0
// ================================================================
function buildFinalJSON() {
    const r = {};
    const base = catalogData ? catalogData._meta.baseUrl : videoPageData ? baseOf(videoPageData.url) : '';

    // §1 IDENTITY
    r.HOST = base;
    r.NAME = generateNameFromHost(base);
    r.SITE_NAME = base.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*/, '');

    // META
    r._meta = {};
    if (catalogData) {
        r._meta = { ...catalogData._meta, mode: videoPageData ? 'catalog+video' : 'catalog' };
    }
    if (videoPageData) {
        if (!catalogData) r._meta = { mode: 'video', analyzedAt: new Date().toISOString(), tool: 'v6.0.0' };
        r._meta.videoPageUrl = videoPageData.url;
        r._meta.mode = catalogData ? 'catalog+video' : 'video';
    }

    // Template integration
    r.templateIntegration = {
        menuJson: `{ "title": "${r.SITE_NAME}", "playlist_url": "${r.NAME}" }`,
        domainMap: `'${r.SITE_NAME}': '${r.NAME}'`,
        workerWhitelist: `'${r.SITE_NAME}',`
    };

    // §2 CARD SELECTORS
    if (catalogData?.videoCards?.found) {
        r.CARD = {
            container: catalogData.videoCards.cardSelectors.container,
            link: catalogData.videoCards.cardSelectors.link,
            title: catalogData.videoCards.cardSelectors.title,
            thumb: catalogData.videoCards.cardSelectors.thumbnail,
            thumbAttr: catalogData.videoCards.cardSelectors.thumbnailAttr,
            duration: catalogData.videoCards.cardSelectors.duration,
            totalFound: catalogData.videoCards.totalCardsFound,
            linkPattern: catalogData.videoCards.linkPattern,
            rankedSelectors: (catalogData.videoCards.rankedSelectors || []).filter(s => s.usable).slice(0, 8),
            sampleCards: catalogData.videoCards.sampleCards.slice(0, 5)
        };
    }

    // BUILD_URL
    r.BUILD_URL = catalogData?.buildUrlPatterns || {};
    if (catalogData?.mainPagePaths?.length) r.BUILD_URL.main = catalogData.mainPagePaths[0];

    // SEARCH
    if (catalogData?.searchPattern) {
        r.SEARCH = {
            paramName: catalogData.searchPattern.paramName,
            pattern: catalogData.searchPattern.pattern,
            formAction: catalogData.searchPattern.formAction,
            method: catalogData.searchPattern.method,
            examples: catalogData.searchExamples
        };
    }

    // CATEGORIES & CHANNELS
    if (catalogData?.navigation) {
        const nav = catalogData.navigation;
        r.CATEGORIES = (nav.categories?.merged || []).map(c => ({ title: c.name, slug: c.slug }));
        r.CHANNELS = (nav.channels?.merged || []).map(c => ({ title: c.name, slug: c.slug }));
        r.SORT_OPTIONS = (nav.sorting?.fromJs || []).map(s => ({ label: s.label, value: s.param?.replace('sort=', '') || null }));
        r.URL_SCHEME = nav.urlScheme;
    }

    // ============================================================
    // §6 STRATEGIES — THE CORE
    // ============================================================
    if (videoPageData?.strategies?.length) {
        r.STRATEGIES = videoPageData.strategies;

        // ACTIVE_STRATEGIES — ready for template
        r.ACTIVE_STRATEGIES = {};
        for (const def of STRATEGY_DEFS) {
            const found = videoPageData.strategies.find(s => s.id === def.id);
            r.ACTIVE_STRATEGIES[def.id] = !!found;
        }

        // strategyOrder — sorted by priority for this specific site
        r.strategyOrder = videoPageData.strategies.map(s => s.id);

        // Summary stats
        r.strategySummary = {
            total: videoPageData.strategies.length,
            confirmed: videoPageData.strategies.filter(s => s.confidence === 'confirmed').length,
            detected: videoPageData.strategies.filter(s => s.confidence === 'detected').length,
            blocks: [...new Set(videoPageData.strategies.map(s => s.block))].sort(),
            recommendedBlock: Math.min(...videoPageData.strategies.map(s => s.block)),
            allFoundUrls: videoPageData.strategies.reduce((acc, s) => acc + (s.foundUrls?.length || 0), 0)
        };
    }

    // KT DECODE
    if (videoPageData?.ktDecode) {
        r.KT_DECODE = videoPageData.ktDecode;
    }

    // DEBUG REPORT
    if (videoPageData?.debugReport) r.DEBUG_REPORT = videoPageData.debugReport;

    // CLEAN URL RULES
    r.CLEAN_URL_RULES = videoPageData?.cleanUrlRules || catalogData?.cleanUrlRules || [];

    // REDIRECT
    if (videoPageData?.redirectChain?.hasRedirect) {
        r.REDIRECT = {
            requiresFollow: videoPageData.redirectChain.requiresFollow,
            getFilePattern: videoPageData.redirectChain.getFilePattern,
            patterns: videoPageData.redirectChain.patterns,
            resolved: videoPageData.redirectResolution || []
        };
    }

    // KVS ENGINE
    if (videoPageData?.kvsEngine) r.KVS_ENGINE = videoPageData.kvsEngine;

    // CDN REDIRECT (manual)
    if (videoPageData?.redirectAnalysis) r.CDN_REDIRECT = videoPageData.redirectAnalysis;

    // PROTECTION
    const prot = catalogData?.protection || videoPageData?.protection;
    if (prot) {
        r.PROTECTION = {
            cloudflare: prot.cloudflare, cloudflareTurnstile: prot.cloudflareTurnstile,
            ddosGuard: prot.ddosGuard, drm: prot.drm, drmDetails: prot.drmDetails,
            ageGate: prot.ageGate, refererProtected: prot.refererProtected,
            requiredHeaders: prot.requiredHeaders, cookies: prot.cookies
        };
    }

    // WORKER
    if (videoPageData?.workerVerdict) r.WORKER_VERDICT = videoPageData.workerVerdict;
    if (videoPageData?.workerWhitelist) r.WORKER_WHITELIST = videoPageData.workerWhitelist;

    // MIRRORS
    const mirrors = videoPageData?.mirrors || catalogData?.mirrors;
    if (mirrors?.totalFound) r.MIRRORS = mirrors;

    // ARCHITECTURE
    if (catalogData?.architecture) r.ARCHITECTURE = catalogData.architecture;

    // ENCODING
    if (catalogData?.encoding) r.ENCODING = catalogData.encoding;

    // MAIN PAGE PATHS
    if (catalogData?.mainPagePaths) r.MAIN_PAGE_PATHS = catalogData.mainPagePaths;

    // EXTERNAL SCRIPTS
    if (videoPageData?.externalScripts?.length) r.EXTERNAL_SCRIPTS = videoPageData.externalScripts;

    // TRANSPORT LOG
    r._transportLog = [
        ...(catalogData?._transportLog || []),
        ...(videoPageData?._transportLog || [])
    ];

    return r;
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

// ================================================================
// DISPLAY — only JSON + Raw tabs
// ================================================================
function displayResults(d) {
    $('results').style.display = 'block';
    const j = JSON.stringify(d, null, 2);
    $('jsonFormatted').innerHTML = synHL(j);
    $('jsonRaw').value = j;
    $('btnCopyJson').disabled = false;
    $('btnCopyWhitelist').disabled = !d.WORKER_WHITELIST;
}

// ================================================================
// SYNTAX HIGHLIGHT
// ================================================================
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

// ================================================================
// UI HELPERS
// ================================================================
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
