// ================================================================
// SITE STRUCTURE ANALYZER v4.2.2
// Redirect chain · KVS engine · /resolve · license_code · kt_player
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

function updMerge(){const el=$('mergeIndicator');if(!el)return;if(catalogData&&videoPageData){el.textContent='📦 Каталог + 🎬 Видео → полный Config';el.className='merge-indicator has-both';el.style.display='block'}else if(catalogData){el.textContent='📦 Каталог ✓ → для видео включите 🎬';el.className='merge-indicator has-catalog';el.style.display='block'}else el.style.display='none'}

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
// RESOLVE REDIRECT CHAIN via Worker /resolve endpoint
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
        // Fallback: regular worker fetch — just note we can't resolve
        return { error: e.message, chain: [url], final: url, redirects: 0, fallback: true };
    }
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
     ['JW Player', ['jwplayer']], ['Video.js', ['videojs']], ['HLS.js', ['hls.js', 'Hls.']]
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

    // Age gate
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
// CARD DETECTION v2
// ================================================================
function aCards(doc, base) {
    const r = { found: false, cardSelector: null, cardXPath: null, totalCardsFound: 0,
        cardSelectors: { container: null, link: null, title: null, thumbnail: null, thumbnailAttr: null, duration: null },
        sampleCards: [] };

    const KNOWN = ['.video-item', '.video-card', '.video-block', '.video_block', '.video-thumb',
        '.thumb-item', '.thumb_main', '.thumb', '.item', '.video', '.clip',
        '.gallery-item', 'article.post', '.card', '[data-video-id]', '[data-id]',
        '.mozaique .thumb-block', '.list-videos .video-item', 'div.thumb'];
    let cards = [], uS = '';
    for (const s of KNOWN) try {
        const f = doc.querySelectorAll(s);
        if (f.length >= 2) {
            const hasLink = Array.from(f).some(e => e.querySelector('a[href]'));
            const hasImg = Array.from(f).some(e => e.querySelector('img'));
            if (hasLink && hasImg) { cards = Array.from(f); uS = s; break }
        }
    } catch {}

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
    const qS = ['.quality', '.hd', '[class*="quality"]'];
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
        for (const qs of qS) try { const el = card.querySelector(qs); if (el) { const t = el.textContent.trim(); if (/\b(HD|4K|1080|720)\b/i.test(t)) { cd.quality = t; break } } } catch {}
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
// KT_PLAYER / LICENSE_CODE FUNCTIONS
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
    const r = { found: false, chunkSize: null, modulo: null, direction: null, tailHandling: null, rawSnippet: null, decodeFunctionName: null, algorithm: null, functionMarker: null };
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
        const hasCC = /charCodeAt|fromCharCode/.test(body);
        const hasSub = /\.substr\s*\(/.test(body);
        const hasMod = /%\s*\d+|%\s*\w+\.length/.test(body);
        if (hasCC && hasSub && hasMod && body.length < 4000) candidates.push(body);
    }
    if (!candidates.length) return r;
    candidates.sort((a, b) => a.length - b.length);
    const block = candidates[0];
    r.found = true;
    r.rawSnippet = block.substring(0, 600);
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
    const chunk = analysis?.chunkSize || 1;
    const mod = analysis?.modulo || 9;
    const dir = analysis?.direction || 'forward';

    let code = `// kt_player decode — auto-generated\n`;
    code += `// chunkSize=${chunk}, modulo=${mod}, direction=${dir}\n\n`;
    code += `function decodeVideoUrl(encodedUrl, licenseCode) {\n`;
    code += `  licenseCode = licenseCode || ${JSON.stringify(licenseCode || '')};\n\n`;
    code += `  // Remove /function/N/ prefix\n`;
    code += `  var funcMatch = encodedUrl.match(/\\/function\\/(\\d)\\/(.*)/);  \n`;
    code += `  var encoded = funcMatch ? funcMatch[2] : encodedUrl;\n`;
    code += `  var funcType = funcMatch ? parseInt(funcMatch[1]) : 0;\n\n`;
    code += `  // Build shift codes from license\n`;
    code += `  var codes = [];\n`;
    code += `  for (var i = 0; i < licenseCode.length; i += ${chunk}) {\n`;
    code += `    var n = parseInt(licenseCode.substr(i, ${chunk}));\n`;
    code += `    if (!isNaN(n)) codes.push(n % ${mod});\n`;
    code += `  }\n\n`;

    if (dir === 'reverse') {
        code += `  // Reverse decode\n`;
        code += `  var decoded = '', ci = codes.length - 1;\n`;
        code += `  for (var j = encoded.length - 1; j >= 0; j--) {\n`;
        code += `    decoded = String.fromCharCode(encoded.charCodeAt(j) - codes[ci]) + decoded;\n`;
        code += `    ci--; if (ci < 0) ci = codes.length - 1;\n`;
        code += `  }\n`;
    } else {
        code += `  // Forward decode\n`;
        code += `  var decoded = '';\n`;
        code += `  for (var j = 0; j < encoded.length; j++) {\n`;
        code += `    decoded += String.fromCharCode(encoded.charCodeAt(j) - codes[j % codes.length]);\n`;
        code += `  }\n`;
    }

    code += `  return decoded;\n`;
    code += `}\n`;
    return code;
}

// ================================================================
// REDIRECT CHAIN DETECTION
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
            if (videoHost !== siteHost && !/cdn|stream|media|edge|video/i.test(videoHost)) {
                result.patterns.push({ type: 'different_host', url: u, videoHost: videoHost, description: 'Video URL on different host' });
            }
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
    return {
        isKvs: score >= 2,
        confidence: Math.min(score / 5, 1),
        markers,
        note: score >= 3 ? 'KVS (Kernel Video Sharing) engine — /get_file/ redirect chain' : score >= 2 ? 'Likely KVS-based' : 'Not KVS'
    };
}

// ================================================================
// PLAYER STRUCTURE + QUALITY MAP
// ================================================================
const PLAYER_SIGS = [{ name: 'uppod', pats: ['uppod'] }, { name: 'jwplayer', pats: ['jwplayer'] }, { name: 'videojs', pats: ['videojs', 'video-js'] }, { name: 'flowplayer', pats: ['flowplayer'] }, { name: 'plyr', pats: ['plyr'] }];
const JS_CFG = [
    { type: 'kt_player', fields: [{ re: /video_url\s*[:=]\s*['"]([^'"]+)['"]/, labelRe: /video_url_text\s*[:=]\s*['"]([^'"]+)['"]/, fb: '480p' }, { re: /video_alt_url\s*[:=]\s*['"]([^'"]+)['"]/, labelRe: /video_alt_url_text\s*[:=]\s*['"]([^'"]+)['"]/, fb: '720p' }] },
    { type: 'xvideos', fields: [{ re: /setVideoUrlHigh\s*\(\s*['"]([^'"]+)['"]\)/, fb: '720p' }, { re: /setVideoUrlLow\s*\(\s*['"]([^'"]+)['"]\)/, fb: '480p' }, { re: /setVideoHLS\s*\(\s*['"]([^'"]+)['"]\)/, fb: 'HLS' }] },
    { type: 'jwplayer', fields: [{ re: /file\s*:\s*['"]([^'"]+\.(?:mp4|m3u8)[^'"]*)['"]/, fb: 'auto' }] }
];

// ================================================================
// KT_PLAYER INLINE DECODE (attempt without downloading kt_player.js)
// ================================================================
function tryKtDecode(url, licenseCode) {
    if (!url || !licenseCode) return null;

    // Check if URL has /function/N/ marker
    const funcMatch = url.match(/\/function\/(\d)\/(.*)/);
    if (!funcMatch) return null;

    const funcType = parseInt(funcMatch[1]);
    const encoded = funcMatch[2];

    if (!encoded || encoded.length < 10) return null;
    // If what follows /function/N/ is already a valid URL — just extract it
    if (encoded.startsWith('http') && (encoded.includes('/get_file/') || encoded.includes('.mp4') || encoded.includes	    ('.m3u8'))) {
    return encoded;
    }
    try {
        if (funcType === 0) {
            // Method 0: charCode shift with license_code chunks
            return ktDecodeMethod0(encoded, licenseCode);
        } else if (funcType === 1) {
            // Method 1: reverse + charCode shift
            return ktDecodeMethod1(encoded, licenseCode);
        }
    } catch (e) {
        // Decode failed — return null, will try after downloading kt_player.js
        return null;
    }
    return null;
}

function ktDecodeMethod0(encoded, licenseCode) {
    // Standard KVS decode: split license to digits, mod, shift chars
    const codes = [];
    for (let i = 0; i < licenseCode.length; i++) {
        const ch = licenseCode[i];
        const num = parseInt(ch);
        if (!isNaN(num)) codes.push(num % 9);
    }
    if (!codes.length) return null;

    let decoded = '';
    for (let i = 0; i < encoded.length; i++) {
        decoded += String.fromCharCode(encoded.charCodeAt(i) - codes[i % codes.length]);
    }

    // Validate — decoded should look like a URL
    if (decoded.startsWith('http') && (decoded.includes('/get_file/') || decoded.includes('.mp4') || decoded.includes('.m3u8'))) {
        return decoded;
    }

    // Try alternative: 2-char chunks
    const codes2 = [];
    for (let i = 0; i + 1 < licenseCode.length; i += 2) {
        const num = parseInt(licenseCode.substr(i, 2));
        if (!isNaN(num)) codes2.push(num % 9);
    }
    if (!codes2.length) return null;

    let decoded2 = '';
    for (let i = 0; i < encoded.length; i++) {
        decoded2 += String.fromCharCode(encoded.charCodeAt(i) - codes2[i % codes2.length]);
    }
    if (decoded2.startsWith('http') && (decoded2.includes('/get_file/') || decoded2.includes('.mp4') || decoded2.includes('.m3u8'))) {
        return decoded2;
    }

    return null;
}

function ktDecodeMethod1(encoded, licenseCode) {
    // Method 1: reverse iteration
    const codes = [];
    for (let i = 0; i < licenseCode.length; i++) {
        const num = parseInt(licenseCode[i]);
        if (!isNaN(num)) codes.push(num % 9);
    }
    if (!codes.length) return null;

    let decoded = '';
    let ci = codes.length - 1;
    for (let i = encoded.length - 1; i >= 0; i--) {
        decoded = String.fromCharCode(encoded.charCodeAt(i) - codes[ci]) + decoded;
        ci--; if (ci < 0) ci = codes.length - 1;
    }

    if (decoded.startsWith('http') && (decoded.includes('/get_file/') || decoded.includes('.mp4'))) {
        return decoded;
    }
    return null;
}

function analyzePlayer(doc, allJS, base) {
    const r = { videoTag: null, sources: [], jsConfigs: [], jsonEncodings: [], qualityMap: {}, videoUrlTemplates: [], player: null };
    const vid = doc.querySelector('video');
    if (vid) {
        r.videoTag = { id: vid.id || null, poster: vid.getAttribute('poster') ? resolve(vid.getAttribute('poster'), base) : null };
        doc.querySelectorAll('video source,source').forEach(s => {
            const src = s.getAttribute('src') || s.getAttribute('data-src'); if (!src) return;
            const entry = { src: resolve(src, base), size: s.getAttribute('size') || null, label: s.getAttribute('label') || null, title: s.getAttribute('title') || null, dataQuality: s.getAttribute('data-quality') || null };
            const qa = entry.size || entry.label || entry.title || entry.dataQuality;
            if (qa === 'preview') return;
            const ql = qa ? (/^\d+$/.test(qa) ? qa + 'p' : qa) : null;
            const method = entry.size ? 'size-attr' : entry.label ? 'label-attr' : entry.title ? 'title-attr' : 'unknown';
            if (ql && entry.src && !r.qualityMap[ql]) r.qualityMap[ql] = { url: entry.src, source: '<source>', method, domain: hostOf(entry.src) };
            r.sources.push(entry);
        });
    }
    doc.querySelectorAll('meta[property="og:video"],meta[property="og:video:url"]').forEach(m => {
        const u = m.getAttribute('content'); if (u && u.includes('.mp4')) {
            const rv = resolve(u, base), qm = u.match(/_(\d+)\.mp4/), lb = qm ? qm[1] + 'p' : 'HD';
            if (!r.qualityMap[lb]) r.qualityMap[lb] = { url: rv, source: 'og:video', method: 'filename', domain: hostOf(rv) };
        }
    });
    for (const cfg of JS_CFG) {
        const found = [];
        for (const f of cfg.fields) {
            const m = allJS.match(f.re); if (m) {
                let label = f.fb; if (f.labelRe) { const lm = allJS.match(f.labelRe); if (lm) label = lm[1] }
                const url = resolve(m[1].replace(/\\\//g, '/'), base);
                found.push({ quality: label, url });
                if (!r.qualityMap[label]) r.qualityMap[label] = { url, source: 'js-config', method: cfg.type, domain: hostOf(url) };
            }
        }
        if (found.length) r.jsConfigs.push({ type: cfg.type, fields: found, regex: cfg.type === 'kt_player' ? "video_url\\s*[:=]\\s*['\"]([^'\"]+)['\"]" : cfg.type === 'xvideos' ? "setVideoUrlHigh\\(['\"]([^'\"]+)['\"]\\)" : "file\\s*:\\s*['\"]([^'\"]+)['\"]" });
    }
    for (const vn of ['dataEncodings', 'sources', 'media_sources', 'video_sources']) {
        const idx = allJS.indexOf(vn); if (idx === -1) continue;
        const as = allJS.indexOf('[', idx); if (as === -1 || as - idx > 50) continue;
        try {
            let depth = 0, ae = -1;
            for (let i = as; i < Math.min(allJS.length, as + 5000); i++) { if (allJS[i] === '[') depth++; else if (allJS[i] === ']') { depth--; if (depth === 0) { ae = i; break } } }
            if (ae === -1) continue;
            JSON.parse(allJS.substring(as, ae + 1)).forEach(item => {
                const u = item.filename || item.file || item.src || item.url || '';
                const q = item.quality || item.label || item.res || item.height || '';
                if (!u) return;
                const url = (u.indexOf('//') === 0 ? 'https:' : '') + u.replace(/\\\//g, '/');
                const key = String(q).toLowerCase() === 'auto' ? 'auto' : (q ? q + 'p' : 'auto');
                r.jsonEncodings.push({ variable: vn, quality: key });
                if (!r.qualityMap[key]) r.qualityMap[key] = { url, source: 'json-encoding', method: vn, domain: hostOf(url) };
            });
        } catch {}
    }
    const hlsM = allJS.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);
    if (hlsM && !r.qualityMap.HLS && !r.qualityMap.auto) r.qualityMap.auto = { url: hlsM[1], source: 'js-regex', method: 'm3u8', domain: hostOf(hlsM[1]) };
    if (!Object.keys(r.qualityMap).length) {
        const mp4R = /(https?:\/\/[^\s"']+\.mp4[^\s"']*)/g; let mm, c = 0;
        while ((mm = mp4R.exec(allJS)) && c < 3) {
            const u = mm[1]; if (u.includes('preview') || u.includes('thumb')) continue;
            const qm2 = u.match(/_(\d+)\.mp4/); const lb = qm2 ? qm2[1] + 'p' : ('src' + c);
            if (!r.qualityMap[lb]) { r.qualityMap[lb] = { url: u, source: 'js-regex', method: 'mp4-brute', domain: hostOf(u) }; c++ }
        }
    }
    for (const [q, info] of Object.entries(r.qualityMap)) {
        try {
            const u = new URL(info.url); let tpl = u.pathname.replace(/\/\d{4,}\//g, '/{id}/').replace(/\/[a-f0-9]{16,}\//gi, '/{hash}/').replace(/_\d{3,4}\.mp4/, '_{quality}.mp4');
            r.videoUrlTemplates.push({ template: u.origin + tpl, domain: info.domain, variables: tpl.match(/\{[^}]+\}/g) || [] });
        } catch {}
    }
    const seen = new Set(); r.videoUrlTemplates = r.videoUrlTemplates.filter(t => { if (seen.has(t.template)) return false; seen.add(t.template); return true });


    // kt_player license_code decode — try to decode URLs before redirect detection
    r.ktDecode = null;
    if (r.jsConfigs.some(c => c.type === 'kt_player')) {
    const licenseCode = extractLicenseCode(allJS, allJS);
    if (licenseCode) {
        r.ktDecode = { licenseCode, analysis: null, decodeSnippet: null };

        // Try inline decode if URL contains /function/
        for (const [q, info] of Object.entries(r.qualityMap)) {
            if (info.url && info.url.includes('/function/')) {
                const decoded = tryKtDecode(info.url, licenseCode);
                if (decoded) {
                    info.urlEncoded = info.url;
                    info.url = decoded;
                    info.decoded = true;
                    info.domain = hostOf(decoded);
                }
            }
        }
        // Also decode jsConfigs fields
        for (const cfg of r.jsConfigs) {
            if (cfg.type !== 'kt_player') continue;
            for (const f of cfg.fields) {
                if (f.url && f.url.includes('/function/')) {
                    const decoded = tryKtDecode(f.url, licenseCode);
                    if (decoded) {
                        f.urlEncoded = f.url;
                        f.url = decoded;
                        f.decoded = true;
                    }
                }
            }
        }
    }
}

// Redirect chain detection from found video URLs (now using decoded URLs)
const allVideoSrcs = [...r.sources.map(v => v.src), ...Object.values(r.qualityMap).map(v => v.url)].filter(Boolean);
r.redirectChain = detectRedirectPattern(allVideoSrcs, hostOf(base));
r.kvsEngine = detectKvsEngine(allJS, allJS);

    const lcJS = allJS.toLowerCase();
    for (const p of PLAYER_SIGS) for (const pat of p.pats) if (lcJS.includes(pat)) { r.player = p.name; break }
    return r;
}

function isVideoScript(src) {
    if (!src) return false;
    if (/jquery|react|vue|angular|bootstrap|analytics|tracking|ads|cdn|polyfill|webpack|chunk/i.test(src)) return false;
    return /video\d+|clip\d+|media\d+|stream\d+|embed\d+|config\d+|player.*\d{3,}/i.test(src);
}

// ================================================================
// CDN WHITELIST
// ================================================================
function buildWhitelist(base, dom, player, cards) {
    const domains = new Map();
    domains.set(hostOf(base), { domain: hostOf(base), role: 'site', required: true });
    for (const [q, info] of Object.entries(player?.qualityMap || {})) {
        const d = info.domain; if (d && !domains.has(d)) domains.set(d, { domain: d, role: 'video (' + q + ')', required: true });
    }
    (cards?.sampleCards || []).forEach(c => { const d = hostOf(c.thumbnail || ''); if (d && d !== hostOf(base) && !domains.has(d)) domains.set(d, { domain: d, role: 'thumb CDN', required: false }) });
    const list = [...domains.values()], required = list.filter(d => d.required);
    const code = 'const ALLOWED_TARGETS = [\n' + required.map(d => `  "${d.domain}",  // ${d.role}`).join('\n') + '\n];';
    return { required, code };
}

// ================================================================
// URL FORMAT / PARSER FLOW
// ================================================================
function detectUrlFormat(html) {
    const r = { cleanUrlRules: [] };
    if (html.includes('\\/')) r.cleanUrlRules.push('unescape-backslash');
    if (/src=["']\/\/[^"']+/.test(html)) r.cleanUrlRules.push('add-protocol');
    if (/src=["']\/[^/"']/.test(html)) r.cleanUrlRules.push('prepend-host');
    if (html.includes('/THUMBNUM/')) r.cleanUrlRules.push('replace-THUMBNUM');
    return r;
}

function buildParserFlow(base, cards, player, search, prot) {
    const flow = {
        catalog: { url: base, cardSelector: cards?.cardSelector, cardCount: cards?.totalCardsFound || 0, linkSelector: cards?.cardSelectors?.link },
        card: { titleSelector: cards?.cardSelectors?.title, thumbSelector: cards?.cardSelectors?.thumbnail, thumbAttribute: cards?.cardSelectors?.thumbnailAttr, durationSelector: cards?.cardSelectors?.duration, linkPattern: cards?.linkPattern },
        videoPage: { strategies: [] }, requiredHeaders: prot?.requiredHeaders || {}
    };
    if (player?.sources?.length) flow.videoPage.strategies.push({ priority: 3, method: 'source-tags' });
    if (player?.jsConfigs?.length) player.jsConfigs.forEach(c => flow.videoPage.strategies.push({ priority: 2, method: 'js-' + c.type, regex: c.regex }));
    if (player?.jsonEncodings?.length) flow.videoPage.strategies.push({ priority: 2, method: 'json-encodings' });
    if (Object.values(player?.qualityMap || {}).some(v => v.source === 'og:video')) flow.videoPage.strategies.push({ priority: 2, method: 'og-video' });
    if (Object.values(player?.qualityMap || {}).some(v => v.method === 'm3u8')) flow.videoPage.strategies.push({ priority: 1, method: 'hls-regex' });
    if (Object.values(player?.qualityMap || {}).some(v => v.method === 'mp4-brute')) flow.videoPage.strategies.push({ priority: 0, method: 'mp4-brute' });
    flow.videoPage.strategies.sort((a, b) => b.priority - a.priority);
    return flow;
}

// ================================================================
// COMPATIBILITY
// ================================================================
function assessCompat(jsReq, prot, vc, player) {
    const items = [];
    items.push({ key: 'ssr', icon: jsReq === 'no' ? '✅' : '❌', label: 'SSR', status: jsReq === 'no' ? 'ok' : 'fail', hint: jsReq === 'no' ? 'HTML' : 'JS needed' });
    items.push({ key: 'cards', icon: vc?.found ? '✅' : '❌', label: 'Cards', status: vc?.found ? 'ok' : 'fail', hint: vc?.found ? vc.totalCardsFound + ' (' + vc.cardSelector + ')' : 'Not found' });
    const qk = Object.keys(player?.qualityMap || {}); items.push({ key: 'video', icon: qk.length ? '✅' : '❌', label: 'Video URLs', status: qk.length ? 'ok' : 'fail', hint: qk.length ? qk.join(', ') : 'None' });
    if (player?.redirectChain?.requiresFollow) items.push({ key: 'redir', icon: '⚠️', label: 'Redirect chain', status: 'warn', hint: 'Worker must follow 302' });
    if (player?.kvsEngine?.isKvs) items.push({ key: 'kvs', icon: '⚠️', label: 'KVS engine', status: 'warn', hint: player.kvsEngine.note });
    if (prot?.cloudflare) items.push({ key: 'cf', icon: prot.cloudflareTurnstile ? '❌' : '⚠️', label: prot.cloudflareTurnstile ? 'CF Turnstile' : 'CF Basic', status: prot.cloudflareTurnstile ? 'fail' : 'warn', hint: prot.cloudflareTurnstile ? 'Headless' : 'Worker' });
    if (prot?.drm) items.push({ key: 'drm', icon: '❌', label: 'DRM', status: 'fail', hint: prot.drmDetails.join(',') });
    if (prot?.ageGate?.detected) items.push({ key: 'age', icon: prot.ageGate.impact === 'none' ? '✅' : '⚠️', label: 'Age (' + prot.ageGate.type + ')', status: prot.ageGate.impact === 'none' ? 'ok' : 'warn', hint: prot.ageGate.note || '' });
    if (prot?.refererProtected) items.push({ key: 'ref', icon: '⚠️', label: 'Referer', status: 'warn', hint: 'Needs Referer header' });
    return items;
}

// ================================================================
// PARSER CONFIG
// ================================================================
function generateParserConfig(cat, vid) {
    const cfg = {}; const base = cat ? cat._meta?.baseUrl : vid ? baseOf(vid.url) : '';
    cfg.HOST = base;
    cfg.NAME = base.replace(/https?:\/\/(www\.)?/, '').replace(/\..*/, '').replace(/[^a-z0-9]/gi, '').substring(0, 12) || 'myparser';
    cfg.mainPagePath = cat?.mainPagePaths?.[0] || '/';
    if (cat?.searchPattern) { cfg.SEARCH_PARAM = cat.searchPattern.paramName; cfg.searchPattern = cat.searchPattern.pattern; if (cat.searchPattern.formAction) cfg.searchFormAction = cat.searchPattern.formAction }
    if (cat?.navigation) {
        const nav = cat.navigation;
        cfg.CATEGORIES = (nav.categories?.merged || []).map(c => ({ title: c.name, slug: c.slug }));
        cfg.CHANNELS = (nav.channels?.merged || []).map(c => ({ title: c.name, slug: c.slug }));
        cfg.SORT_OPTIONS = (nav.sorting?.fromJs || []).map(s => ({ label: s.label, value: s.param?.replace('sort=', '') || null }));
        cfg.URL_PATTERNS = {};
        if (nav.urlScheme?.search) cfg.URL_PATTERNS.search = nav.urlScheme.search;
        if (nav.urlScheme?.category) cfg.URL_PATTERNS.category = nav.urlScheme.category;
        if (nav.urlScheme?.channel?.pattern) cfg.URL_PATTERNS.channel = nav.urlScheme.channel;
        cfg.URL_PATTERNS.pagination = '&page={N}';
    }
    if (cat?.videoCards?.found) { cfg.CARD_SELECTORS = cat.videoCards.cardSelectors; cfg.linkPattern = cat.videoCards.linkPattern; cfg.sampleCards = cat.videoCards.sampleCards.slice(0, 3) }

    if (vid?.playerStructure) {
        const ps = vid.playerStructure;
        cfg.QUALITY_MAP = {};
	for (const [q, info] of Object.entries(ps.qualityMap || {})) {
	    cfg.QUALITY_MAP[q] = { ...info };
	    if (info.decoded) {
	        cfg.QUALITY_MAP[q]._note = 'decoded from license_code';
	        cfg.QUALITY_MAP[q].urlEncoded = info.urlEncoded;
	    }
	} 
	cfg.VIDEO_URL_TEMPLATES = ps.videoUrlTemplates;
        cfg.PLAYER = ps.player; cfg.VIDEO_RULES = ps.jsConfigs?.length ? ps.jsConfigs : [];
        cfg.JSON_ENCODINGS = ps.jsonEncodings?.length ? uniq(ps.jsonEncodings.map(e => e.variable)) : [];

        // Redirect info
        if (ps.redirectChain?.requiresFollow) {
            cfg.REDIRECT = { mode: 'follow', maxRedirects: 5, patterns: ps.redirectChain.patterns.map(p => ({ type: p.type, workerMode: p.workerMode })), note: 'Worker must follow 302 redirects for video URLs' };
            if (ps.kvsEngine?.isKvs) { cfg.REDIRECT.engine = 'KVS'; cfg.REDIRECT.kvsConfidence = ps.kvsEngine.confidence }
        }

        // KT Decode
        if (ps.ktDecode?.analysis?.found) {
            cfg.KT_DECODE = { licenseCode: ps.ktDecode.licenseCode, algorithm: ps.ktDecode.analysis.algorithm, chunkSize: ps.ktDecode.analysis.chunkSize, modulo: ps.ktDecode.analysis.modulo, direction: ps.ktDecode.analysis.direction, decodeSnippet: ps.ktDecode.decodeSnippet };
        }
    } else { cfg.VIDEO_RULES = []; cfg._note = 'Для VIDEO_RULES → анализ видео-страницы (🎬)' }

    // Resolved redirect URLs
    if (vid?.redirectResolution?.length) {
        cfg.REDIRECT_RESOLVED = vid.redirectResolution.map(r => ({ original: r.original?.substring(0, 100), final: r.final?.substring(0, 100), hops: r.redirectCount, type: r.contentType, resumable: r.resumable }));
    }

    if (vid?.urlFormat?.cleanUrlRules?.length) cfg.CLEAN_URL_RULES = vid.urlFormat.cleanUrlRules;
    if (cat?.protection?.requiredHeaders) cfg.REQUIRED_HEADERS = cat.protection.requiredHeaders;
    else if (vid?.protection?.requiredHeaders) cfg.REQUIRED_HEADERS = vid.protection.requiredHeaders;
    if (cat?.protection?.ageGate?.detected) { const ag = cat.protection.ageGate; cfg.AGE_GATE = { type: ag.type }; if (ag.cookieName) cfg.AGE_GATE.cookie = ag.cookieName + '=' + (ag.cookieValue || '1') }
    if (vid?.workerWhitelist) cfg.WORKER_WHITELIST = vid.workerWhitelist.required.map(d => d.domain);
    return cfg;
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
    const result = { _meta: { analyzedUrl: url, baseUrl: base, analyzedAt: new Date().toISOString(), mode: 'catalog', testWord: getTestWord(), tool: 'v4.2.1' } };

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
        setProgress(60, 'Search'); result.searchPattern = detectSearchPattern(doc, html, base);
        setProgress(65, 'MainPage'); result.mainPagePaths = detectMainPagePath(doc, base, url);
        setProgress(70, 'JSD');
        const jsReq = (() => { const root = doc.querySelector('#app,#root,#__next'); if (root && root.children.length <= 3) return 'yes'; if (dom.totalElements < 80) return 'yes'; if (result.videoCards.found) return 'no'; if (fw.some(f => ['JW Player', 'Video.js', 'HLS.js'].includes(f))) return 'partial'; return 'no' })();
        const sP = result.searchPattern.paramName || 'q', eTW = encodeURIComponent(getTestWord());
        result.navigation.urlScheme = { base, search: { paramName: sP, pattern: result.searchPattern.pattern || base + '/?' + sP + '={query}', example: base + '/?' + sP + '=' + eTW }, category: { paramName: 'c', pattern: base + '/?c={slug}' }, channel: { pattern: result.navigation.channels.urlPattern ? base + result.navigation.channels.urlPattern : null }, sorting: { options: result.navigation.sorting.fromJs, pattern: base + '/?sort={value}' }, pagination: { pattern: '&page={N}' } };
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
        setProgress(35, '🎬 Player...');
        vd.playerStructure = analyzePlayer(doc, html + '\n' + allInline, base);

        setProgress(50, '🎬 ExtJS...');
        const extSrcs = Array.from(doc.querySelectorAll('script[src]')).map(s => s.getAttribute('src')).filter(Boolean);
        const videoScripts = extSrcs.filter(isVideoScript).slice(0, 3);
        vd.externalScripts = [];
        for (const vs of videoScripts) {
            const full = resolve(vs, base);
            try {
                logT('ExtJS:' + vs);
                const jsCode = await fetchPage(full);
                const info = { src: vs, fetched: true, size: jsCode.length, videoFound: false };
                const extP = analyzePlayer(doc, jsCode, base);
                if (Object.keys(extP.qualityMap).length) {
                    info.videoFound = true;
                    Object.assign(vd.playerStructure.qualityMap, extP.qualityMap);
                    vd.playerStructure.jsConfigs.push(...extP.jsConfigs);
                    vd.playerStructure.jsonEncodings.push(...extP.jsonEncodings);
                    vd.playerStructure.videoUrlTemplates.push(...extP.videoUrlTemplates);
                    if (extP.player && !vd.playerStructure.player) vd.playerStructure.player = extP.player;
                    // Merge redirect chain
                    if (extP.redirectChain?.hasRedirect) {
                        vd.playerStructure.redirectChain.hasRedirect = true;
                        vd.playerStructure.redirectChain.patterns.push(...extP.redirectChain.patterns);
                        if (extP.redirectChain.getFilePattern) vd.playerStructure.redirectChain.getFilePattern = true;
                        if (extP.redirectChain.requiresFollow) vd.playerStructure.redirectChain.requiresFollow = true;
                    }
                    if (extP.kvsEngine?.isKvs && !vd.playerStructure.kvsEngine?.isKvs) vd.playerStructure.kvsEngine = extP.kvsEngine;
                }
                vd.externalScripts.push(info);
            } catch (e) { vd.externalScripts.push({ src: vs, fetched: false, error: e.message }) }
        }

        // kt_player decode analysis
        setProgress(58, '🎬 KT...');
        if (vd.playerStructure?.ktDecode || vd.playerStructure?.jsConfigs?.some(c => c.type === 'kt_player')) {
            const ktSrc = detectKtPlayerScript(doc, extSrcs);
            if (ktSrc) {
                try {
                    logT('KT: ' + ktSrc);
                    const ktFull = resolve(ktSrc, base);
                    const ktCode = await fetchPage(ktFull);
                    const analysis = analyzeKtDecodeFunction(ktCode);
                    const licenseCode = vd.playerStructure.ktDecode?.licenseCode || extractLicenseCode(html + '\n' + allInline, allInline);
                    if (!vd.playerStructure.ktDecode) vd.playerStructure.ktDecode = {};
                    vd.playerStructure.ktDecode.analysis = analysis;
                    vd.playerStructure.ktDecode.ktPlayerJsUrl = ktSrc;
                    vd.playerStructure.ktDecode.ktPlayerJsSize = ktCode.length;
                    if (analysis.found && licenseCode) {
                        vd.playerStructure.ktDecode.licenseCode = licenseCode;
                        vd.playerStructure.ktDecode.decodeSnippet = buildKtDecodeSnippet(analysis, licenseCode);
                    }
                    logT('KT: ' + (analysis.found ? '✅ algorithm found' : '❌ not found'), analysis.found ? 'success' : 'fail');
                } catch (e) { logT('KT: ' + e.message, 'fail') }
            }
        }

        if (videoScripts[0]) vd.externalJsPattern = videoScripts[0].replace(/\d+/g, '\\d+').replace(/\./g, '\\.');

        // Redirect chain resolution via Worker /resolve (fresh fetch for non-expired hash)
        setProgress(62, '🎬 Redirect...');
        if (vd.playerStructure?.redirectChain?.requiresFollow) {
            vd.redirectResolution = [];
            try {
                logT('Fresh fetch for resolve...');
                const freshHtml = await fetchPage(url);
                const freshDoc = parseH(freshHtml);
                const freshInline = Array.from(freshDoc.querySelectorAll('script')).map(s => s.textContent).join('\n');
                const freshAll = freshHtml + '\n' + freshInline;
                
                // Extract all fresh video URLs
                const freshPatterns = [
                    /video_url\s*[:=]\s*['"]([^'"]+)['"]/,
                    /video_alt_url\s*[:=]\s*['"]([^'"]+)['"]/
                ];
                const freshUrls = [];
                for (const pat of freshPatterns) {
                    const m = freshAll.match(pat);
                    if (m && m[1]) {
                        let u = m[1];
                        const funcM = u.match(/function\/\d\/(https?:\/\/.+)/);
                        if (funcM) u = funcM[1];
                        else if (!u.startsWith('http')) u = resolve(u, base);
                        if (u.startsWith('http')) freshUrls.push(u);
                    }
                }
                
                // Resolve first fresh URL (one is enough to discover CDN domains)
                const urlToResolve = freshUrls[0];
                if (urlToResolve) {
                    logT('Fresh URL: ' + urlToResolve.substring(0, 80));
                    const data = await resolveRedirectChain(urlToResolve, 8);
                    vd.redirectResolution.push({
                        original: urlToResolve, final: data.final, chain: data.chain,
                        redirectCount: data.redirects || 0, contentType: data.contentType,
                        contentLength: data.contentLength, resumable: data.resumable,
                        pattern: 'kvs_get_file', error: data.error || null, fallback: data.fallback || false
                    });
                    logT('→ ' + (data.redirects || 0) + ' hops → ' + (data.final || '').substring(0, 80),
                        data.error ? 'warning' : 'success');
                } else {
                    logT('No fresh video URL found', 'fail');
                }
            } catch (e) {
                logT('Fresh resolve error: ' + e.message, 'fail');
                vd.redirectResolution.push({ original: url, error: e.message, pattern: 'kvs_get_file' });
            }
        }

        setProgress(70, '🎬 Format');
        vd.urlFormat = detectUrlFormat(html + '\n' + allInline);
        const prot = aProt(doc, html, base); vd.protection = prot;
        setProgress(80, '🎬 Whitelist');
        const dom = aDom(doc);
        vd.workerWhitelist = buildWhitelist(base, dom, vd.playerStructure, catalogData?.videoCards);

        // Add resolved redirect domains to whitelist
        if (vd.redirectResolution?.length) {
            for (const rr of vd.redirectResolution) {
                if (rr.final) {
                    const d = hostOf(rr.final);
                    if (d && !vd.workerWhitelist.required.some(w => w.domain === d)) {
                        vd.workerWhitelist.required.push({ domain: d, role: 'CDN (resolved)', required: true });
                    }
                }
                if (rr.chain) {
                    for (const cu of rr.chain) {
                        const d = hostOf(cu);
                        if (d && !vd.workerWhitelist.required.some(w => w.domain === d)) {
                            vd.workerWhitelist.required.push({ domain: d, role: 'CDN (chain)', required: true });
                        }
                    }
                }
            }
            // Rebuild code
            vd.workerWhitelist.code = 'const ALLOWED_TARGETS = [\n' + vd.workerWhitelist.required.map(d => `  "${d.domain}",  // ${d.role}`).join('\n') + '\n];';
        }

        setProgress(85, '🎬 Flow');
        vd.parserFlow = buildParserFlow(base, catalogData?.videoCards, vd.playerStructure, catalogData?.searchPattern, prot);
        setProgress(90, '🎬 Done');
    } catch (e) { vd.error = e.message }

    vd._transportLog = transportLog; videoPageData = vd;
    analysisResult = buildFinalJSON(); displayResults(analysisResult);
    setProgress(100, '✅');
    setStatus(catalogData ? '✅ Каталог + Видео = полный Config' : '✅ Видео', 'success');
    if (btn) { btn.disabled = false; btn.textContent = '🎬 Анализ видео' }
    updMerge();
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
        let vUrl = null;
        doc.querySelectorAll('a[href]').forEach(a => { if (vUrl) return; const h = a.getAttribute('href') || ''; if (h.includes('video') || h.includes('watch') || /\/\d{3,}\//.test(h)) vUrl = resolve(h, base) });
        if (vUrl) {
            setProgress(60, '🧪 Video...');
            try {
                const ac2 = new AbortController, t2 = setTimeout(() => ac2.abort(), 12000);
                const r2 = await fetch(vUrl, { signal: ac2.signal }); clearTimeout(t2);
                if (r2.ok) {
                    const vh = await r2.text();
                    checks.push({ icon: '✅', label: 'Video page', hint: `${(vh.length / 1024 | 0)}KB` });
                    const vDoc = parseH(vh);
                    const vTag = vDoc.querySelector('video source[src],video[src]');
                    const ogV = vDoc.querySelector('meta[property="og:video"]');
                    checks.push({ icon: vTag ? '✅' : ogV ? '✅' : '⚠️', label: vTag ? '<video> tag' : ogV ? 'og:video' : 'Video in JS only', hint: vTag ? 'Direct' : ogV ? 'Meta' : 'Regex needed' });
                    // KVS check
                    const vInline = Array.from(vDoc.querySelectorAll('script')).map(s => s.textContent).join('\n');
                    const kvs = detectKvsEngine(vh, vInline);
                    if (kvs.isKvs) checks.push({ icon: '⚠️', label: 'KVS engine', hint: kvs.note });
                    if (/\/get_file\/\d+\//.test(vInline + vh)) checks.push({ icon: '⚠️', label: '/get_file/ pattern', hint: 'Needs redirect follow' });
                }
            } catch (e) { checks.push({ icon: '❌', label: 'Video page', hint: e.message }) }
        }
    }

    const ok = checks.filter(c => c.icon === '✅').length, fail = checks.filter(c => c.icon === '❌').length;
    const verdict = fail === 0 ? { v: 'ok', l: '✅ Compatible' } : ok > fail ? { v: 'partial', l: '⚠️ Partial' } : { v: 'fail', l: '❌ Incompatible' };
    analysisResult = { _meta: { url, mode: 'direct-test', tool: 'v4.2.1' }, directTest: { checks, verdict: verdict.v, verdictLabel: verdict.l } };
    let h = `<div class="dt-block${verdict.v === 'fail' ? ' fail' : ''}"><h3${verdict.v === 'fail' ? ' class="fail-title"' : ''}>🧪 ${esc(url)}</h3><div class="dt-grid">`;
    checks.forEach(c => { h += `<div class="dt-item"><span class="dt-icon">${c.icon}</span><div class="dt-text"><strong>${esc(c.label)}</strong><span class="dt-hint">${esc(c.hint)}</span></div></div>` });
    h += `</div><div class="dt-summary"><div class="verdict ${verdict.v}">${esc(verdict.l)}</div></div></div>`;
    $('results').style.display = 'block'; $('archReport').innerHTML = h;
    const j = JSON.stringify(analysisResult, null, 2);
    $('jsonFormatted').innerHTML = synHL(j); $('jsonRaw').value = j; $('configFormatted').textContent = '// direct-test';
    $('btnCopyJson').disabled = false; showTab('arch');
    setProgress(100, '✅'); setStatus('🧪 Done', 'success');
    if (btn) { btn.disabled = false; btn.textContent = '🚀 Анализ каталога' }
}

// ================================================================
// BUILD FINAL JSON
// ================================================================
function buildFinalJSON() {
    const r = { _meta: {} };
    if (catalogData) {
        r._meta = { ...catalogData._meta, mode: videoPageData ? 'catalog+video' : 'catalog' };
        r.encoding = catalogData.encoding; r.mainPagePaths = catalogData.mainPagePaths;
        r.searchPattern = catalogData.searchPattern; r.searchExamples = catalogData.searchExamples;
        r.videoCards = catalogData.videoCards;
        r.navigation = { categories: catalogData.navigation.categories, channels: catalogData.navigation.channels, sorting: catalogData.navigation.sorting, urlScheme: catalogData.navigation.urlScheme };
        r.architecture = catalogData.architecture;
    }
    if (videoPageData) {
        if (!catalogData) r._meta = { mode: 'video', analyzedAt: new Date().toISOString(), tool: 'v4.2.1' };
        r._meta.videoPageUrl = videoPageData.url;
        if (catalogData) r._meta.mode = 'catalog+video'; else r._meta.mode = 'video';
        r.videoPage = {
            url: videoPageData.url, title: videoPageData.videoTitle || videoPageData.title, poster: videoPageData.poster,
            player: videoPageData.playerStructure?.player, qualityMap: videoPageData.playerStructure?.qualityMap,
            videoUrlTemplates: videoPageData.playerStructure?.videoUrlTemplates,
            jsConfigs: videoPageData.playerStructure?.jsConfigs,
            jsonEncodings: videoPageData.playerStructure?.jsonEncodings?.length ? uniq(videoPageData.playerStructure.jsonEncodings.map(e => e.variable)) : [],
            externalScripts: videoPageData.externalScripts?.filter(s => s.videoFound) || [],
            redirectChain: videoPageData.playerStructure?.redirectChain || null,
            kvsEngine: videoPageData.playerStructure?.kvsEngine || null,
            redirectResolution: videoPageData.redirectResolution || null
        };
        r.urlFormat = videoPageData.urlFormat; r.workerWhitelist = videoPageData.workerWhitelist;
        r.parserFlow = videoPageData.parserFlow;
    }
    const prot = catalogData?.protection || videoPageData?.protection;
    if (prot) {
        r.protection = { cloudflare: prot.cloudflare, cloudflareTurnstile: prot.cloudflareTurnstile, ddosGuard: prot.ddosGuard, drm: prot.drm, drmDetails: prot.drmDetails, ageGate: prot.ageGate, refererProtected: prot.refererProtected, requiredHeaders: prot.requiredHeaders };
    }
    const jsReq = catalogData?.architecture?.jsRequired || 'no';
    r.compatibility = assessCompat(jsReq, prot, catalogData?.videoCards, videoPageData?.playerStructure);
    r.parserConfig = generateParserConfig(catalogData, videoPageData);
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
// DISPLAY
// ================================================================
function displayResults(d) {
    $('results').style.display = 'block';
    const j = JSON.stringify(d, null, 2);
    $('jsonFormatted').innerHTML = synHL(j); $('jsonRaw').value = j;
    $('archReport').innerHTML = genArch(d);
    const cfg = d.parserConfig ? JSON.stringify(d.parserConfig, null, 2) : '// No config';
    $('configFormatted').innerHTML = synHL(cfg);
    $('btnCopyJson').disabled = false; $('btnCopyConfig').disabled = !d.parserConfig; $('btnCopyWhitelist').disabled = !d.workerWhitelist;
}

// ================================================================
// ARCHITECTURE RENDER
// ================================================================
function genArch(d) {
    if (d.directTest) return '';
    let h = '';

    // Compatibility
    if (d.compatibility?.length) {
        h += '<div class="compat-block"><h3>🧪 Совместимость</h3><div class="compat-grid">';
        d.compatibility.forEach(c => { h += `<div class="compat-item"><span class="compat-icon">${c.icon}</span><div class="compat-text"><strong>${esc(c.label)}</strong><span class="hint">${esc(c.hint)}</span></div></div>` });
        h += '</div></div>';
    }

    // Whitelist
    if (d.workerWhitelist?.required?.length) {
        h += '<div class="wl-block"><h3>📡 Worker Whitelist</h3>';
        d.workerWhitelist.required.forEach(dm => { h += `<div class="wl-domain"><code>${esc(dm.domain)}</code><span class="role">${esc(dm.role)}</span></div>` });
        h += `<div class="wl-code" onclick="copyWhitelist()" title="Click=copy">${esc(d.workerWhitelist.code)}</div></div>`;
    }

    // Redirect Chain
    const rc = d.videoPage?.redirectChain;
    const rr = d.videoPage?.redirectResolution;
    const kvs = d.videoPage?.kvsEngine;
    if ((rc && rc.hasRedirect) || rr?.length) {
        h += '<div class="redir-block"><h3>🔄 Redirect Chain</h3>';
        if (rc) {
            h += '<div class="redir-info">';
            h += `<span class="ri-l">Requires follow:</span><span class="ri-v">${rc.requiresFollow ? '✅ Yes' : '❌ No'}</span>`;
            h += `<span class="ri-l">get_file pattern:</span><span class="ri-v">${rc.getFilePattern ? '✅ Detected' : '—'}</span>`;
            h += `<span class="ri-l">Patterns:</span><span class="ri-v">${(rc.patterns || []).map(p => esc(p.type)).join(', ') || '—'}</span>`;
            h += '</div>';
        }
        // KVS Engine
        if (kvs) {
            h += '<div class="kvs-block"><h4>🏭 KVS Engine Detection</h4>';
            h += `<div style="margin-bottom:6px;font-size:11px;color:${kvs.isKvs ? '#0f8' : '#888'}">${esc(kvs.note)} (${Math.round(kvs.confidence * 100)}%)</div>`;
            h += '<div class="kvs-markers">';
            for (const [k, v] of Object.entries(kvs.markers || {})) {
                h += `<span class="kvs-marker ${v ? 'on' : 'off'}">${v ? '✓' : '✗'} ${esc(k)}</span>`;
            }
            h += '</div></div>';
        }
        // Resolved chains
        if (rr?.length) {
            h += '<div style="margin-top:10px"><strong style="color:#fa0;font-size:12px">📡 Resolved URLs</strong>';
            for (const r2 of rr) {
                if (r2.error && !r2.fallback) {
                    h += `<div style="background:#1a0a0a;padding:6px 8px;border-radius:4px;margin:4px 0;font-size:10px"><span style="color:#f55">❌ ${esc(r2.error)}</span><br><span style="color:#888">${esc((r2.original || '').substring(0, 80))}</span></div>`;
                } else if (r2.fallback) {
                    h += `<div style="background:#1a1a0a;padding:6px 8px;border-radius:4px;margin:4px 0;font-size:10px"><span style="color:#fa0">⚠️ Worker /resolve not available — add endpoint to Worker</span><br><span style="color:#888">${esc((r2.original || '').substring(0, 80))}</span></div>`;
                } else {
                    h += '<div style="background:#0a1a0a;padding:6px 8px;border-radius:4px;margin:4px 0;font-size:10px">';
                    h += `<span style="color:#0f8">✅ ${r2.redirectCount || 0} redirects</span>`;
                    h += ` <span style="color:#888">${r2.resumable ? '📥 resumable' : '⚠️ not resumable'}</span>`;
                    // Render chain
                    if (r2.chain?.length > 1) {
                        h += '<div class="redir-chain" style="margin-top:4px">';
                        r2.chain.forEach((cu, idx) => {
                            if (idx > 0) h += '<span class="redir-arrow">→</span>';
                            const isLast = idx === r2.chain.length - 1;
                            h += `<div class="redir-step"><strong>${isLast ? '✅ Final' : '302 #' + idx}</strong><code>${esc(cu.substring(0, 80))}</code><div class="rs-status ${isLast ? 's200' : 's302'}">${isLast ? '200 OK' : '302'}</div></div>`;
                        });
                        h += '</div>';
                    } else {
                        h += `<br><span style="color:#aaa;word-break:break-all">→ ${esc((r2.final || '').substring(0, 120))}</span>`;
                    }
                    if (r2.contentType) h += `<br><span style="color:#666">${esc(r2.contentType)} ${r2.contentLength ? '(' + r2.contentLength + ' bytes)' : ''}</span>`;
                    h += '</div>';
                }
            }
            h += '</div>';
        }
        h += '</div>';
    }

    // Quality Map
    const qm = d.videoPage?.qualityMap;
    if (qm && Object.keys(qm).length) {
        h += '<div class="ab"><h3 class="gt">🎬 Quality Map</h3><table class="qm-table"><tr><th>Q</th><th>URL</th><th>Source</th><th>Method</th><th>Domain</th></tr>';
        for (const [q, info] of Object.entries(qm)) {
    const decoded = info.decoded ? ' <span style="color:#0f8;font-size:8px">✅ decoded</span>' : '';
    h += `<tr><td><strong>${esc(q)}</strong>${decoded}</td><td><code>${esc((info.url || '').substring(0, 70))}</code>`;
    if (info.urlEncoded) h += `<br><span style="color:#888;font-size:8px">encoded: ${esc(info.urlEncoded.substring(0, 50))}...</span>`;
    h += `</td><td>${esc(info.source)}</td><td>${esc(info.method)}</td><td><code>${esc(info.domain)}</code></td></tr>`;
}
        h += '</table></div>';
    }

    // Parser Flow
    if (d.parserFlow) {
        const pf = d.parserFlow;
        h += '<div class="ab"><h3 class="wt">🔗 Parser Flow</h3><div class="pf-chain">';
        h += `<div class="pf-step"><strong>📄 Catalog</strong><code>${esc(pf.catalog?.cardSelector || '?')}</code><br>${pf.catalog?.cardCount || 0} cards</div><span class="pf-arrow">→</span>`;
        h += `<div class="pf-step"><strong>🔗 Card</strong>title: <code>${esc(pf.card?.titleSelector || '?')}</code><br>thumb: <code>${esc(pf.card?.thumbSelector || '?')}</code> [${esc(pf.card?.thumbAttribute || '')}]<br>link: <code>${esc(pf.card?.linkPattern || '?')}</code></div><span class="pf-arrow">→</span>`;
        h += `<div class="pf-step"><strong>▶️ Video</strong>`;
        (pf.videoPage?.strategies || []).forEach(s => { h += `<br>${'⭐'.repeat(s.priority) || '☆'} <code>${esc(s.method)}</code>` });
        h += '</div></div>';
        if (Object.keys(pf.requiredHeaders || {}).length) {
            h += '<table class="st"><tr><th>Header</th><th>Value</th></tr>';
            for (const [k, v] of Object.entries(pf.requiredHeaders)) h += `<tr><td><strong>${esc(k)}</strong></td><td><code>${esc(v)}</code></td></tr>`;
            h += '</table>';
        }
        h += '</div>';
    }

    // Video URL Templates
    if (d.videoPage?.videoUrlTemplates?.length) {
        h += '<div class="ab"><h3>📐 URL Templates</h3><table class="st"><tr><th>Template</th><th>Domain</th><th>Vars</th></tr>';
        d.videoPage.videoUrlTemplates.forEach(t => { h += `<tr><td><code>${esc(t.template)}</code></td><td><code>${esc(t.domain)}</code></td><td>${(t.variables || []).map(v => `<span class="tag">${esc(v)}</span>`).join('')}</td></tr>` });
        h += '</table></div>';
    }

    // JS Configs
    if (d.videoPage?.jsConfigs?.length) {
        h += '<div class="ab"><h3>🎮 JS Player</h3>';
        d.videoPage.jsConfigs.forEach(c => {
            h += `<strong style="color:#0df">${esc(c.type)}</strong> `;
            c.fields.forEach(f => { h += `<code style="color:#fa4;font-size:9px">${esc(f.quality)}</code>: <code style="color:#0f8;font-size:9px">${esc((f.url || '').substring(0, 50))}</code> ` });
            h += `<br>Regex: <code style="color:#888;font-size:9px">${esc(c.regex)}</code><br>`;
        });
        h += '</div>';
    }

    // KT Decode
    const kt = d.parserConfig?.KT_DECODE;
    if (kt) {
        h += `<div class="ab"><h3 class="rt">🔑 kt_player Decode</h3><div class="arg">`;
        h += `<span class="arl">license_code:</span><span class="arv"><code>${esc(kt.licenseCode)}</code></span>`;
        h += `<span class="arl">Algorithm:</span><span class="arv"><code>${esc(kt.algorithm)}</code></span>`;
        h += `<span class="arl">Chunk:</span><span class="arv">${kt.chunkSize}</span>`;
        h += `<span class="arl">Modulo:</span><span class="arv">${kt.modulo}</span>`;
        h += `<span class="arl">Direction:</span><span class="arv">${kt.direction}</span>`;
        h += '</div>';
        if (kt.decodeSnippet) h += `<pre style="background:#0a0a1e;color:#0f8;padding:8px;border-radius:5px;font-size:10px;margin-top:8px;white-space:pre-wrap">${esc(kt.decodeSnippet)}</pre>`;
        h += '</div>';
    }

    // External JS
    const extJS = d.videoPage?.externalScripts;
    if (extJS?.length) {
        h += '<div class="ab"><h3>📜 External JS</h3><div class="ext-js-block">';
        extJS.forEach(s => { h += `<div class="ext-js-item"><code>${esc(s.src)}</code><span class="ejs-st" style="color:#0f8"> ✅ video found (${((s.size / 1024) | 0)}K)</span></div>` });
        h += '</div></div>';
    }

    // Age Gate
    if (d.protection?.ageGate?.detected) {
        const ag = d.protection.ageGate;
        h += `<div class="age-g"><h4>🔞 Age Gate <span class="gt-badge ${ag.type}">${esc(ag.type)}</span></h4><p>${esc(ag.note || '')}</p>`;
        if (ag.cookieName) h += `<div class="age-detail">Cookie: <code>${esc(ag.cookieName)}=${esc(ag.cookieValue || '1')}</code></div>`;
        h += '</div>';
    }

    // Recommendation
    if (d.architecture?.recommendation) {
        const rc2 = d.architecture.recommendation;
        h += `<div class="ab"><h3 class="wt">🔧 Stack</h3><div class="arg"><span class="arl">Method:</span><span class="arv"><code>${esc(rc2.method)}</code></span><span class="arl">Tools:</span><span class="arv"><code>${esc(rc2.tools)}</code></span><span class="arl">Transport:</span><span class="arv">${esc(rc2.transport)}</span></div></div>`;
    }

    // URL Scheme
    const nav = d.navigation;
    if (nav?.urlScheme) {
        h += '<div class="url-scheme"><h3>🗺️ URL Scheme</h3>';
        if (d.mainPagePaths?.length) {
            h += '<div class="us-section"><h4>🏠 Main page</h4><div class="us-combo">';
            d.mainPagePaths.forEach(p => { h += `<code>${esc(p)}</code> ` });
            h += '</div></div>';
        }
        if (d.searchExamples?.length) {
            h += `<div class="us-section"><h4>🔍 Search «${esc(d._meta?.testWord || '')}»</h4><table class="us-table"><tr><th>Variant</th><th>URL</th></tr>`;
            d.searchExamples.forEach(u => { h += `<tr><td style="font-size:10px">${esc(u.label)}</td><td><code>${esc(u.url)}</code></td></tr>` });
            h += `</table><div class="us-combo">Pattern: <code>${esc(d.searchPattern?.pattern || nav.urlScheme.search?.pattern || '')}</code></div></div>`;
        }
        const so = nav.sorting?.fromJs;
        if (so?.length) {
            h += `<div class="us-section"><h4>🔄 Sort (${so.length})</h4><table class="us-table"><tr><th>Label</th><th>Param</th></tr>`;
            so.forEach(s => { h += `<tr><td>${esc(s.label)}</td><td><code>${esc(s.param)}</code></td></tr>` });
            h += '</table></div>';
        }
        if (nav.categories?.merged?.length) {
            h += `<div class="us-section"><h4>📁 Categories (${nav.categories.merged.length})</h4><div class="us-cat-grid">`;
            nav.categories.merged.forEach(c => { h += `<div class="us-cat-item"><span class="cat-name">${esc(c.name)}</span><span class="cat-slug">${esc(c.slug)}</span></div>` });
            h += '</div></div>';
        }
        if (nav.channels?.merged?.length) {
            h += `<div class="us-section"><h4>📺 Channels (${nav.channels.merged.length})</h4><div class="us-cat-grid">`;
            nav.channels.merged.forEach(c => { h += `<div class="us-cat-item"><span class="cat-name">${esc(c.name)}</span><span class="cat-slug">${esc(c.slug)}</span></div>` });
            h += '</div></div>';
        }
        h += '</div>';
    }

    // Card Selectors
    if (d.videoCards?.found) {
        const cs = d.videoCards.cardSelectors;
        h += `<div class="ab"><h3>🎯 Card Selectors (${d.videoCards.totalCardsFound})</h3><table class="st"><tr><th>Field</th><th>CSS Selector</th></tr>`;
        h += `<tr><td><strong>container</strong></td><td><code>${esc(cs.container)}</code></td></tr>`;
        h += `<tr><td><strong>link</strong></td><td><code>${esc(cs.link || 'a[href]')}</code></td></tr>`;
        h += `<tr><td><strong>title</strong></td><td><code>${esc(cs.title || '—')}</code></td></tr>`;
        h += `<tr><td><strong>thumbnail</strong></td><td><code>${esc(cs.thumbnail || 'img')}</code> [${esc(cs.thumbnailAttr || 'src')}]</td></tr>`;
        h += `<tr><td><strong>duration</strong></td><td><code>${esc(cs.duration || '—')}</code></td></tr>`;
        if (d.videoCards.linkPattern) h += `<tr><td><strong>linkPattern</strong></td><td><code>${esc(d.videoCards.linkPattern)}</code></td></tr>`;
        h += '</table></div>';
    }

    // Sample Cards
    if (d.videoCards?.sampleCards?.length) {
        h += `<div class="ab"><h3>📑 Sample Cards (${d.videoCards.sampleCards.length})</h3>`;
        d.videoCards.sampleCards.slice(0, 5).forEach((c, i) => {
            h += `<div class="sample-card"><strong>#${i + 1}</strong> `;
            if (c.title) h += `<span class="sc-field">title:</span>${esc(c.title.substring(0, 50))} `;
            if (c.duration) h += `<span class="sc-field">dur:</span>${esc(c.duration)} `;
            if (c.quality) h += `<span class="sc-field">q:</span>${esc(c.quality)} `;
            if (c.views) h += `<span class="sc-field">views:</span>${esc(c.views)} `;
            if (c.link) h += `<br><span class="sc-field">link:</span><code>${esc(c.link.substring(0, 80))}</code>`;
            if (c.thumbnail) h += `<br><span class="sc-field">thumb:</span><code>${esc(c.thumbnail.substring(0, 80))}</code>`;
            h += '</div>';
        });
        h += '</div>';
    }

    // URL Format
    if (d.urlFormat?.cleanUrlRules?.length) {
        h += '<div class="ab"><h3>🔧 cleanUrl rules</h3><div class="acg">';
        d.urlFormat.cleanUrlRules.forEach(r2 => { h += `<div class="aci"><span class="aci-i">🔧</span><span class="aci-l">${esc(r2)}</span></div>` });
        h += '</div></div>';
    }

    // Summary
    const checks = [];
    if (d.videoCards) checks.push({ i: '📄', l: 'Cards', v: d.videoCards.found ? d.videoCards.totalCardsFound + ' (' + d.videoCards.cardSelector + ')' : '❌ not found', c: d.videoCards.found ? 'ok' : 'fail' });
    if (d.navigation) {
        checks.push({ i: '📁', l: 'Categories', v: d.navigation.categories?.totalCount || 0, c: d.navigation.categories?.totalCount ? 'ok' : 'n' });
        checks.push({ i: '📺', l: 'Channels', v: d.navigation.channels?.totalCount || 0, c: d.navigation.channels?.totalCount ? 'ok' : 'n' });
    }
    if (d.searchPattern) checks.push({ i: '🔍', l: 'Search', v: d.searchPattern.paramName || '—', c: d.searchPattern.paramName ? 'ok' : 'n' });
    if (d.videoPage?.qualityMap) checks.push({ i: '🎬', l: 'Qualities', v: Object.keys(d.videoPage.qualityMap).join(', ') || '—', c: Object.keys(d.videoPage.qualityMap).length ? 'ok' : 'n' });
    if (d.videoPage?.player) checks.push({ i: '🎮', l: 'Player', v: d.videoPage.player, c: 'ok' });
    if (d.videoPage?.redirectChain?.requiresFollow) checks.push({ i: '🔄', l: 'Redirect', v: 'follow required', c: 'warn' });
    if (d.videoPage?.kvsEngine?.isKvs) checks.push({ i: '🏭', l: 'KVS', v: Math.round(d.videoPage.kvsEngine.confidence * 100) + '%', c: 'warn' });
    if (d.workerWhitelist) checks.push({ i: '📡', l: 'Whitelist', v: d.workerWhitelist.required.length + ' domains', c: 'ok' });
    if (checks.length) {
        h += '<div class="ab"><h3>✅ Summary</h3><div class="acg">';
        checks.forEach(c => { h += `<div class="aci"><span class="aci-i">${c.i}</span><span class="aci-l">${esc(c.l)}</span><span class="aci-v ${c.c}">${c.v}</span></div>` });
        h += '</div></div>';
    }

    return h;
}

// ================================================================
// UI HELPERS
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
function copyParserConfig() { if (analysisResult?.parserConfig) { clip(JSON.stringify(analysisResult.parserConfig, null, 2)); setStatus('⚙️ Config copied!', 'success') } }
function copyWhitelist() { if (analysisResult?.workerWhitelist?.code) { clip(analysisResult.workerWhitelist.code); setStatus('📡 Whitelist copied!', 'success') } else setStatus('No data', 'error') }

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
