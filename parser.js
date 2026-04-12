// ================================================================
// SITE STRUCTURE ANALYZER v3.3
// JS-парсинг категорий, сортировки, поиска → URL-схема для парсера
// ================================================================

const DEFAULT_TARGET_URL="";
const DEFAULT_WORKER_URL="https://zonaproxy.777b737.workers.dev";
let analysisResult=null,transportLog=[];
const logT=(m,t='info')=>transportLog.push({time:new Date().toLocaleTimeString(),message:m,type:t});

// ---- Utils ----
const $=id=>document.getElementById(id);
const setStatus=(m,t='loading')=>{const e=$('status');if(e){e.textContent=m;e.className='status '+t}};
const setProgress=(p,t,s)=>{const c=$('progress-container'),b=$('progress-bar'),x=$('progress-text');if(!c)return;c.style.display='block';b.style.width=p+'%';x.textContent=t||p+'%';b.classList.remove('cors-error','warning','worker');if(s)b.classList.add(s)};
const baseOf=u=>{try{return new URL(u).origin}catch{return''}};
const resolve=(h,b)=>{if(!h)return'';try{return new URL(h,b).href}catch{return h}};
const uniq=a=>[...new Set(a.filter(Boolean))];
const esc=t=>{if(!t)return'';const d=document.createElement('div');d.textContent=String(t);return d.innerHTML};
const getTestWord=()=>($('testWord')?.value.trim()||'wife');

// ---- XPath ----
function genXP(el){if(!el||el.nodeType!==1)return'';if(el.id)return`//*[@id="${el.id}"]`;const p=[];let c=el;while(c&&c.nodeType===1){let t=c.tagName.toLowerCase();if(c.className&&typeof c.className==='string'){const cl=c.className.trim().split(/\s+/)[0];if(cl&&cl.length>2&&!['col','row','item','div','block','wrap','container'].includes(cl)){p.unshift(`//${t}[contains(@class,"${cl}")]`);break}}let i=1,s=c.previousElementSibling;while(s){if(s.tagName===c.tagName)i++;s=s.previousElementSibling}p.unshift(`/${t}[${i}]`);c=c.parentElement}return p.join('')}
function sXP(el){if(!el||el.nodeType!==1)return'';const t=el.tagName.toLowerCase();if(el.id)return`//*[@id="${el.id}"]`;if(el.className&&typeof el.className==='string'){const c=el.className.trim().split(/\s+/)[0];if(c)return`//${t}[contains(@class,"${c}")]`}return`//${t}`}

// ---- UA ----
const UA={desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',mobile:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Chrome/120.0.0.0',bot:'Googlebot/2.1'};
function getUA(){const s=$('uaSelect');if(!s)return UA.desktop;if(s.value==='custom'){const c=$('uaCustom');return c?.value.trim()||UA.desktop}return UA[s.value]||UA.desktop}

// ---- Worker / CORS ----
const getW=()=>{const i=$('workerUrl');return i?i.value.trim().replace(/\/$/,''):''};
const updW=h=>{const b=$('workerStatusBadge');if(b){b.textContent=h?'✦':'○';b.className='worker-badge '+(h?'active':'inactive')}};
function updCI(state,detail){const el=$('corsIndicator');if(!el)return;const m={'trying-direct':['🔗 Прямое...','trying'],'direct-ok':['✅ OK','direct-ok'],'trying-worker':['⚡ Worker...','trying'],'worker-ok':['✅ W '+(detail||''),'worker-ok'],'cors-detected':['🛡️ CORS→прокси','cors-blocked'],'trying-proxy':['🔄 '+(detail||''),'cors-blocked'],'proxy-ok':['✅ '+(detail||''),'proxy-ok'],'all-failed':['❌ Заблокировано','all-failed'],hidden:['','']};const s=m[state]||m.hidden;el.textContent=s[0];el.className='cors-indicator '+s[1];el.style.display=state==='hidden'?'none':'block'}
const proxies=()=>[{n:'allorigins',u:'https://api.allorigins.win/raw?url='},{n:'corsproxy',u:'https://corsproxy.io/?'},{n:'codetabs',u:'https://api.codetabs.com/v1/proxy?quest='},{n:'thingproxy',u:'https://thingproxy.freeboard.io/fetch/'},{n:'cors-anywhere',u:'https://cors-anywhere.herokuapp.com/'},{n:'cors.bridged',u:'https://cors.bridged.cc/'}];
const isCE=e=>{if(!e)return false;const m=(e.message||'').toLowerCase();return m.includes('failed to fetch')||m.includes('networkerror')||m.includes('load failed')||e.name==='TypeError'};

// ---- Fetch ----
async function fD(url){const a=new AbortController,t=setTimeout(()=>a.abort(),10000);try{const r=await fetch(url,{headers:{Accept:'text/html,*/*'},signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('HTTP '+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}
async function fW(url){const w=getW();if(!w)throw new Error('No W');const a=new AbortController,t=setTimeout(()=>a.abort(),15000);try{const r=await fetch(w+'/?url='+encodeURIComponent(url)+'&ua='+encodeURIComponent(getUA()),{headers:{Accept:'text/html,*/*'},signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('W'+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}
async function fP(url,pfx){const a=new AbortController,t=setTimeout(()=>a.abort(),15000);const raw=pfx.includes('thingproxy')||pfx.includes('cors-anywhere')||pfx.includes('cors.bridged');try{const r=await fetch(raw?pfx+url:pfx+encodeURIComponent(url),{headers:{Accept:'text/html,*/*'},signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('HTTP '+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}
async function fetchPage(url){const mode=($('proxySelect')||{}).value||'auto',w=getW();if(mode===''){logT('Direct');updCI('trying-direct');try{const h=await fD(url);logT('✅','success');updCI('direct-ok');return h}catch(e){logT('❌ '+e.message,'fail');updCI('all-failed');throw e}}
if(mode==='auto'){try{logT('1/3 Direct');updCI('trying-direct');setProgress(12,'🔗');const h=await fD(url);logT('✅','success');updCI('direct-ok');return h}catch(e){logT(isCE(e)?'🛡️ CORS':e.message,'warning')}
if(w){try{logT('2/3 Worker');updCI('trying-worker');setProgress(14,'⚡','worker');const h=await fW(url);logT('✅ W','success');updCI('worker-ok',w);return h}catch(e){logT('W:'+e.message,'fail')}}
updCI('cors-detected');const px=proxies();for(let i=0;i<px.length;i++){try{logT('3/3 '+px[i].n);updCI('trying-proxy',px[i].n);setProgress(15+i*2,px[i].n,'warning');const h=await fP(url,px[i].u);logT('✅ '+px[i].n,'success');updCI('proxy-ok',px[i].n);return h}catch(e){logT('❌ '+px[i].n,'fail')}}
updCI('all-failed');throw new Error('All blocked')}
if(w){try{const h=await fW(url);logT('✅ W','success');updCI('worker-ok',w);return h}catch(e){logT('W:'+e.message,'warning')}}
try{const h=await fP(url,mode);updCI('proxy-ok',mode.split('/')[2]);return h}catch(e){updCI('all-failed');throw e}}
async function extractVW(u){const w=getW();if(!w)return null;try{const r=await fetch(w+'/?url='+encodeURIComponent(u)+'&mode=extract');if(!r.ok)return null;const d=await r.json();return d.success&&d.videoUrl?d.videoUrl:null}catch{return null}}
const parseH=h=>new DOMParser().parseFromString(h,'text/html');

// ================================================================
// JS-ПАРСИНГ КАТЕГОРИЙ, СОРТИРОВКИ, ПОИСКА
// ================================================================

function parseJsNavigation(doc, html, baseUrl) {
    const allScript = Array.from(doc.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const combined = allScript + '\n' + html;
    const result = {
        categories: { fromJs: [], fromHtml: [], merged: [] },
        sorting: { fromJs: [], fromHtml: [] },
        search: { patterns: [], paramNames: [], exampleUrls: [] },
        urlScheme: {}
    };
    const tw = getTestWord();

    // ======= CATEGORIES FROM JS =======
    const catPatterns = [
        /new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*[?&]c=([A-Za-z0-9_-]+(?:-\d+)?)/g,
        /new\s+\w+\s*\(\s*'([^']+)'\s*,\s*[^)]*[?&]c=([A-Za-z0-9_-]+(?:-\d+)?)/g,
        /new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*"[&?]c=([A-Za-z0-9_-]+(?:-\d+)?)"/g,
    ];
    const jsCats = new Map();
    for (const pat of catPatterns) {
        let m;
        while ((m = pat.exec(combined)) !== null) {
            const name = m[1].trim();
            const slug = m[2];
            if (name && slug && name.length < 80 && !jsCats.has(slug)) {
                jsCats.set(slug, { name, slug, url: baseUrl + '/?c=' + slug });
            }
        }
        pat.lastIndex = 0;
    }
    const cParamPat = /[?&]c=([A-Za-z0-9_-]+(?:-\d+)?)/g;
    let cm;
    while ((cm = cParamPat.exec(combined)) !== null) {
        const slug = cm[1];
        if (!jsCats.has(slug) && slug.length > 1 && slug.length < 60) {
            jsCats.set(slug, { name: slug.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), slug, url: baseUrl + '/?c=' + slug });
        }
    }
    result.categories.fromJs = [...jsCats.values()];

    // ======= CATEGORIES FROM HTML =======
    const catSelectors = ['.categories a', '.category-list a', '.cats a', '.tags a', '[class*="categor"] a',
        'a[href*="/categories/"]', 'a[href*="/category/"]', 'a[href*="/c/"]', 'a[href*="/tags/"]', 'a[href*="?c="]'];
    for (const sel of catSelectors) {
        try {
            const links = doc.querySelectorAll(sel);
            if (links.length >= 3) {
                links.forEach(a => {
                    const href = a.getAttribute('href');
                    const name = a.textContent.trim();
                    if (href && name && name.length < 100) {
                        let slug = '';
                        const cMatch = href.match(/[?&]c=([^&]+)/);
                        const pathMatch = href.match(/\/c\/([^/?]+)/);
                        if (cMatch) slug = cMatch[1];
                        else if (pathMatch) slug = pathMatch[1];
                        else slug = href.split('/').filter(Boolean).pop() || '';
                        result.categories.fromHtml.push({ name, slug, url: resolve(href, baseUrl) });
                    }
                });
                break;
            }
        } catch {}
    }

    const mergedMap = new Map();
    result.categories.fromJs.forEach(c => mergedMap.set(c.slug, c));
    result.categories.fromHtml.forEach(c => { if (!mergedMap.has(c.slug)) mergedMap.set(c.slug, c); });
    result.categories.merged = [...mergedMap.values()];
    result.categories.totalCount = result.categories.merged.length;
    result.categories.source = result.categories.fromJs.length > result.categories.fromHtml.length ? 'JavaScript' : 'HTML';

    // ======= SORTING FROM JS =======
    const sortPatterns = [
        /new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*[?&]sort=([a-z0-9_-]+)/gi,
        /new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*"[?&]sort=([a-z0-9_-]+)"/gi,
    ];
    const jsSort = new Map();
    for (const pat of sortPatterns) {
        let m;
        while ((m = pat.exec(combined)) !== null) {
            const label = m[1].trim();
            const value = m[2];
            if (label && value && !jsSort.has(value)) {
                jsSort.set(value, { label, param: 'sort=' + value });
            }
        }
        pat.lastIndex = 0;
    }
    const sortValPat = /[?&]sort=([a-z0-9_-]+)/gi;
    while ((cm = sortValPat.exec(combined)) !== null) {
        const v = cm[1];
        if (!jsSort.has(v)) jsSort.set(v, { label: v.replace(/[-_]/g, ' '), param: 'sort=' + v });
    }
    result.sorting.fromJs = [...jsSort.values()];

    for (const sel of ['select[name*="sort"]', '[class*="sort"] a', '.sorting a', 'a[href*="sort="]', 'a[href*="order="]']) {
        try {
            doc.querySelectorAll(sel).forEach(el => {
                if (el.tagName === 'SELECT') {
                    el.querySelectorAll('option').forEach(o => result.sorting.fromHtml.push({ label: o.textContent.trim(), param: o.value ? 'sort=' + o.value : null }));
                } else if (el.tagName === 'A') {
                    const href = el.getAttribute('href') || '';
                    const sm = href.match(/sort=([^&]+)/);
                    if (sm) result.sorting.fromHtml.push({ label: el.textContent.trim(), param: 'sort=' + sm[1], url: resolve(href, baseUrl) });
                }
            });
        } catch {}
    }

    // ======= SEARCH PATTERNS FROM JS =======
    const searchParamPats = [
        /[?&](search)=["']?\s*\.?concat\s*\(\s*(?:encodeURIComponent\s*\()?\s*(\w)/gi,
        /[?&](k)=["']?\s*\.?concat/gi,
        /[?&](q)=["']?\s*\.?concat/gi,
        /[?&](query)=["']?\s*\.?concat/gi,
        /[?&](search)=[^&"']+/gi,
        /[?&](k)=[^&"']+/gi,
    ];
    const foundSearchParams = new Set();
    for (const pat of searchParamPats) {
        let m;
        while ((m = pat.exec(combined)) !== null) {
            foundSearchParams.add(m[1].toLowerCase());
        }
        pat.lastIndex = 0;
    }
    doc.querySelectorAll('form').forEach(f => {
        f.querySelectorAll('input').forEach(i => {
            const nm = (i.getAttribute('name') || '').toLowerCase();
            if (['q', 'k', 'query', 'search', 's', 'keyword', 'find'].includes(nm)) foundSearchParams.add(nm);
        });
    });
    result.search.paramNames = [...foundSearchParams];

    const searchParam = result.search.paramNames[0] || 'q';
    const encodedTW = encodeURIComponent(tw);
    result.search.testWord = tw;

    const searchBase = baseUrl + '/?' + searchParam + '=' + encodedTW;
    result.search.exampleUrls.push({ label: 'Поиск: ' + tw, url: searchBase });

    result.sorting.fromJs.forEach(s => {
        result.search.exampleUrls.push({
            label: 'Поиск + ' + s.label,
            url: baseUrl + '/?' + s.param + '&' + searchParam + '=' + encodedTW
        });
    });

    // ======= URL SCHEME =======
    result.urlScheme = {
        base: baseUrl,
        search: {
            paramName: searchParam,
            pattern: baseUrl + '/?' + searchParam + '={query}',
            example: searchBase,
            withSort: result.search.exampleUrls,
        },
        category: {
            paramName: 'c',
            pattern: baseUrl + '/?c={slug}',
            example: result.categories.merged[0] ? result.categories.merged[0].url : null,
            withSort: result.sorting.fromJs.length
                ? baseUrl + '/?{sort_param}&c={slug}'
                : null,
        },
        sorting: {
            options: result.sorting.fromJs.length ? result.sorting.fromJs : result.sorting.fromHtml,
            pattern: baseUrl + '/?sort={value}',
        },
        pagination: {
            pattern: '&page={N}',
            note: 'Добавляется к любому URL',
        },
        combinations: {
            searchPlusSortPlusPagination: baseUrl + '/?' + 'sort={sort}&' + searchParam + '={query}&page={N}',
            categoryPlusSortPlusPagination: baseUrl + '/?sort={sort}&c={slug}&page={N}',
        }
    };

    return result;
}

// ================================================================
// STANDARD ANALYZERS (compact)
// ================================================================
function aDom(doc){const a=doc.querySelectorAll('*').length,s=doc.querySelectorAll('script');return{totalElements:a,scripts:s.length,inlineScriptSize:Array.from(s).reduce((x,e)=>x+(e.textContent||'').length,0),externalScripts:Array.from(s).filter(s=>s.src).map(s=>s.src).slice(0,15),images:doc.querySelectorAll('img').length,links:doc.querySelectorAll('a[href]').length,forms:doc.querySelectorAll('form').length,iframes:doc.querySelectorAll('iframe').length}}
function aFW(doc,html){const f=[],src=html+Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n');const ck=[['React',['data-reactroot','_reactRootContainer','ReactDOM']],['Next.js',['__NEXT_DATA__','_next/static']],['Vue.js',['__vue__','v-cloak','data-v-','createApp']],['Nuxt.js',['__NUXT__','_nuxt/']],['Angular',['ng-app','ng-version']],['jQuery',['jquery.min.js','jQuery']],['WordPress',['wp-content','wp-json']],['Cloudflare',['cf-browser-verification','challenges.cloudflare.com']],['DDoS-Guard',['ddos-guard']],['JW Player',['jwplayer']],['Video.js',['videojs','video-js']],['HLS.js',['hls.js','Hls.']]];for(const[n,ps]of ck)for(const p of ps)if(src.includes(p)){f.push(n);break}return uniq(f)}
function aAPI(doc){const src=Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n'),eps=[];for(const p of[/fetch\s*\(\s*['"`](\/[^'"`]+)/gi,/axios\.\w+\(\s*['"`](\/[^'"`]+)/gi]){let m;while((m=p.exec(src)))if(m[1])eps.push(m[1]);p.lastIndex=0}const sv=[];for(const p of[/__NEXT_DATA__/,/__NUXT__/,/__INITIAL_STATE__/])if(p.test(src))sv.push(p.source.replace(/\\/g,''));return{endpoints:uniq(eps).slice(0,15),stateVars:sv}}
function aProt(doc,html){const r={cloudflare:false,ddosGuard:false,recaptcha:false,ageGate:null,cookies:[]},lc=html.toLowerCase();if(lc.includes('challenges.cloudflare.com'))r.cloudflare=true;if(lc.includes('ddos-guard'))r.ddosGuard=true;if(lc.includes('recaptcha')||lc.includes('hcaptcha'))r.recaptcha=true;const src=Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n');const cp=/(?:setCookie|document\.cookie\s*=\s*['"`])([^'"`=;]+)/gi;let cm;while((cm=cp.exec(src)))r.cookies.push(cm[1]);r.cookies=uniq(r.cookies).slice(0,10);let agF=false,agS=null;for(const s of['#age-verify','#age-gate','.age-verify','.age-gate','[class*="age-verif"]','[class*="age-gate"]','#disclaimer'])try{if(doc.querySelector(s)){agF=true;agS=s;break}}catch{}if(!agF&&/(?:мне\s*(?:уже\s*)?18|i\s*am\s*(?:over\s*)?18|18\+|confirm.*age)/i.test(doc.body?.textContent||''))agF=true;if(agF){let tp='css-overlay';if(lc.includes('cookie')&&lc.includes('age'))tp='cookie';r.ageGate={detected:true,type:tp,selector:agS,impact:tp==='css-overlay'?'low':'medium',note:tp==='css-overlay'?'Контент в HTML':'Cookie нужен'}}return r}
function aObf(html){const r={base64Urls:[],obfPat:[],tokenUrls:[]};let m;const at=/atob\s*\(\s*['"`]([A-Za-z0-9+/=]{20,})['"`]\s*\)/gi;while((m=at.exec(html)))try{const d=atob(m[1]);if(/https?:\/\/.*\.(mp4|m3u8)/.test(d))r.base64Urls.push({dec:d.substring(0,200),type:d.includes('.m3u8')?'HLS':'MP4'})}catch{}if(/String\.fromCharCode/.test(html))r.obfPat.push('String.fromCharCode');const tp=/https?:\/\/[^\s"'<>]+\.(mp4|m3u8)[^\s"'<>]*(?:token|expires|hash|sign)=[^\s"'<>]+/gi;while((m=tp.exec(html)))r.tokenUrls.push(m[0].substring(0,200));return r}
function aJSD(doc,html,cf,fw){const r={jsRequired:'no',catalog:'no',player:'no',ev:[]};const root=doc.querySelector('#app,#root,#__next,#__nuxt,[data-reactroot]');if(root&&root.children.length<=3){r.ev.push('SPA root');r.catalog='yes'}const ns=doc.querySelector('noscript');if(ns&&/enable|javascript/i.test(ns.textContent)){r.ev.push('<noscript>');r.catalog='yes'}const dt=doc.querySelectorAll('*').length;if(dt<80){r.ev.push(`DOM ${dt}`);r.catalog='yes'}else if(dt<200&&!cf){r.ev.push(`Small DOM ${dt}`);r.catalog='yes'}if(cf){r.ev.push('Cards in HTML');r.catalog='no'}if(fw.some(f=>['JW Player','Video.js','HLS.js'].includes(f))){r.player='yes';r.ev.push('JS player')}r.jsRequired=r.catalog==='yes'?'yes':r.catalog==='partial'||r.player==='yes'?'partial':'no';return r}
function aEnc(doc){const mc=doc.querySelector('meta[charset]'),mct=doc.querySelector('meta[http-equiv="Content-Type"]');let cs='N/A';if(mc)cs=mc.getAttribute('charset');else if(mct){const m=(mct.getAttribute('content')||'').match(/charset=([^\s;]+)/i);if(m)cs=m[1]}return{charset:cs.toUpperCase()}}
function aMeta(doc){const m={title:doc.title};const d=doc.querySelector('meta[name="description"]');if(d)m.description=d.getAttribute('content');const l=doc.documentElement.getAttribute('lang');if(l)m.language=l;return m}
function aPag(doc,base,target){const r={pagination:{found:false,type:null,pattern:null,examples:[]}};let pl=[],ms='';for(const s of['.pagination a','.pager a','nav.pagination a','.paginator a','a.page-link','[class*="pagination"] a'])try{const l=doc.querySelectorAll(s);if(l.length){ms=s;l.forEach(a=>{const h=a.getAttribute('href');if(h)pl.push(h)});break}}catch{}if(!pl.length){doc.querySelectorAll('a[href]').forEach(a=>{const h=a.getAttribute('href')||'',t=a.textContent.trim();if(/[?&]page=\d+/i.test(h)||/\/page\/\d+/i.test(h)||(/\/\d+\/?$/.test(h)&&/^\d+$/.test(t)))pl.push(h)});if(pl.length)ms='pattern'}if(pl.length){r.pagination.found=true;r.pagination.selector=ms;r.pagination.examples=uniq(pl.map(h=>resolve(h,base))).slice(0,10);const s0=pl[0];if(/[?&]page=\d+/i.test(s0)){r.pagination.type='query';r.pagination.pattern='?page=N'}else if(/\/page\/\d+/i.test(s0)){r.pagination.type='path';r.pagination.pattern='/page/N/'}else{r.pagination.type='other';r.pagination.pattern=s0}}return r}
function aQP(doc,base){const params={};doc.querySelectorAll('a[href]').forEach(a=>{try{const u=new URL(resolve(a.getAttribute('href'),base));u.searchParams.forEach((v,k)=>{if(!params[k])params[k]={vals:new Set(),cnt:0};params[k].vals.add(v);params[k].cnt++})}catch{}});const res=[];for(const[k,d]of Object.entries(params)){let cat='unknown';if(/^(page|p|pg|start|offset)$/i.test(k))cat='pagination';else if(/^(sort|order|orderby)$/i.test(k))cat='sorting';else if(/^(q|query|search|s|k|keyword|find)$/i.test(k))cat='search';else if(/^(cat|category|tag|genre|type|filter|c)$/i.test(k))cat='filter';res.push({param:k,category:cat,values:[...d.vals].slice(0,8),count:d.cnt})}res.sort((a,b)=>b.count-a.count);return res.slice(0,30)}

// ================================================================
// VIDEO CARDS with views/likes/date/slug/XPath/fallbacks
// ================================================================
function extractSlug(href){if(!href)return null;try{const segs=new URL(href).pathname.split('/').filter(Boolean);for(let i=segs.length-1;i>=0;i--){const s=segs[i];if(/^[a-z0-9][-a-z0-9_]{5,}$/i.test(s)&&!/^\d+$/.test(s))return s.replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim()}}catch{}return null}
function aCards(doc,base){
    const r={found:false,cardSelector:null,cardXPath:null,totalCardsFound:0,structure:{title:{css:null,xpath:null,fb:[],example:null},link:{css:null,xpath:null,fb:[],example:null,pattern:null},thumbnail:{css:null,xpath:null,fb:[],attribute:null,example:null},duration:{css:null,xpath:null,fb:[],example:null},quality:{css:null,xpath:null,fb:[],example:null},views:{css:null,xpath:null,fb:[],example:null},likes:{css:null,xpath:null,fb:[],example:null},date:{css:null,xpath:null,fb:[],example:null}},sampleCards:[]};
    const cS=['.video-item','.video-card','.thumb-item','.thumb','.video-thumb','.video_block','.video-block','.item','.video','.clip','.gallery-item','article','.post','.list-item','.grid-item','[data-video-id]','[data-id]','.card'];
    let cards=[],uS='';for(const s of cS)try{const f=doc.querySelectorAll(s);if(f.length>=2&&Array.from(f).some(e=>e.querySelector('a[href]'))&&Array.from(f).some(e=>e.querySelector('img'))){cards=Array.from(f);uS=s;break}}catch{}
    if(!cards.length){const p=[];doc.querySelectorAll('div,li,article').forEach(d=>{if(d.querySelectorAll(':scope>img,:scope>a>img,:scope>div>img').length>=1&&d.querySelectorAll(':scope>a[href]').length>=1&&d.querySelectorAll('a[href]').length<10)p.push(d)});if(p.length>=3){cards=p;uS='auto'}}
    if(!cards.length)return r;r.found=true;r.cardSelector=uS;r.totalCardsFound=cards.length;r.cardXPath=genXP(cards[0]);
    const tS=['h1','h2','h3','h4','h5','.title','.name','.video-title','a[title]','[class*="title"]','strong','b'];
    const dS=['.duration','.time','.video-time','[class*="duration"]','[class*="time"]','time'];
    const qS=['.quality','.hd','[class*="quality"]','[class*="hd"]'];
    const vS=['.views','.count','[class*="view"]','[class*="watch"]','.stats'];
    const lS=['.likes','.rating','[class*="like"]','[class*="rate"]','[class*="thumb"]'];
    const dtS=['.date','.added','[class*="date"]','[class*="added"]','[class*="ago"]','time[datetime]'];
    const imgA=['data-src','data-original','data-lazy-src','data-thumb','src'];

    for(let i=0;i<Math.min(8,cards.length);i++){const card=cards[i],cd={};
        const tF=[];for(const ts of tS)try{const el=card.querySelector(ts);if(el){const t=ts==='a[title]'?(el.getAttribute('title')||''):el.textContent.trim();if(t.length>2&&t.length<300){tF.push({css:`${uS} ${ts}`,xpath:sXP(el),example:t.substring(0,80)});if(!cd.title)cd.title=t}}}catch{}
        const imgAlt=card.querySelector('img[alt]');if(imgAlt){const alt=imgAlt.getAttribute('alt')||'';if(alt.length>3&&alt.length<200){tF.push({css:`${uS} img[alt]`,xpath:sXP(imgAlt),example:alt.substring(0,80),source:'img-alt'});if(!cd.title)cd.title=alt}}
        if(i===0&&tF.length){r.structure.title.css=tF[0].css;r.structure.title.xpath=tF[0].xpath;r.structure.title.example=tF[0].example;r.structure.title.fb=tF.slice(1)}
        const lk=card.querySelector('a[href]');if(lk){cd.link=resolve(lk.getAttribute('href'),base);if(i===0){r.structure.link.css=`${uS} a[href]`;r.structure.link.xpath=sXP(lk);r.structure.link.example=cd.link;try{r.structure.link.pattern=new URL(cd.link).pathname.replace(/\/\d+\//g,'/{id}/').replace(/\/\d+$/,'/{id}').replace(/\/[a-z0-9_-]{10,}\/?$/i,'/{slug}/')}catch{}}const slug=extractSlug(cd.link);if(slug){cd.slugName=slug;if(!cd.title)cd.title=slug}}
        const thF=[];card.querySelectorAll('img').forEach(img=>{for(const at of imgA){const sv=img.getAttribute(at);if(sv&&!sv.startsWith('data:')&&sv.length>5){thF.push({css:`${uS} img`,xpath:sXP(img),attr:at,example:resolve(sv,base)});if(!cd.thumbnail)cd.thumbnail=resolve(sv,base);break}}});
        if(i===0&&thF.length){r.structure.thumbnail.css=thF[0].css;r.structure.thumbnail.xpath=thF[0].xpath;r.structure.thumbnail.attribute=thF[0].attr;r.structure.thumbnail.example=thF[0].example;r.structure.thumbnail.fb=thF.slice(1)}
        const dF=[];for(const ds of dS)try{const el=card.querySelector(ds);if(el){let t=el.textContent.trim();if(el.tagName==='TIME'&&el.getAttribute('datetime')){const pt=el.getAttribute('datetime').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);if(pt)t=[pt[1]||'',pt[2]||'0',(pt[3]||'0').padStart(2,'0')].filter(Boolean).join(':')}if(/\d{1,2}:\d{2}/.test(t)){dF.push({css:`${uS} ${ds}`,xpath:sXP(el),example:t});if(!cd.duration)cd.duration=t}}}catch{}
        if(!cd.duration)for(const el of card.querySelectorAll('span,div,small,em')){const t=el.textContent.trim();if(/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)){cd.duration=t;dF.push({css:`${uS} ${el.tagName.toLowerCase()}`,xpath:sXP(el),example:t});break}}
        if(i===0&&dF.length){r.structure.duration.css=dF[0].css;r.structure.duration.xpath=dF[0].xpath;r.structure.duration.example=dF[0].example;r.structure.duration.fb=dF.slice(1)}
        const qF=[];for(const qs of qS)try{const el=card.querySelector(qs);if(el){const t=el.textContent.trim();if(/\b(HD|FHD|4K|1080|720|SD)\b/i.test(t)){qF.push({css:`${uS} ${qs}`,xpath:sXP(el),example:t});if(!cd.quality)cd.quality=t}}}catch{}
        if(i===0&&qF.length){r.structure.quality.css=qF[0].css;r.structure.quality.xpath=qF[0].xpath;r.structure.quality.example=qF[0].example;r.structure.quality.fb=qF.slice(1)}
        const vF=[];for(const vs of vS)try{const el=card.querySelector(vs);if(el){const t=el.textContent.trim();const nm=t.match(/([\d,.]+\s*[KkMm]?)\s*(views?|просмотр|раз|hits?)?/i);if(nm){vF.push({css:`${uS} ${vs}`,xpath:sXP(el),example:nm[0].trim()});if(!cd.views)cd.views=nm[0].trim()}}}catch{}
        if(!cd.views){const dv=card.querySelector('[data-views]');if(dv){cd.views=dv.getAttribute('data-views');vF.push({css:`${uS} [data-views]`,xpath:sXP(dv),example:cd.views})}}
        if(i===0&&vF.length){r.structure.views.css=vF[0].css;r.structure.views.xpath=vF[0].xpath;r.structure.views.example=vF[0].example;r.structure.views.fb=vF.slice(1)}
        const lF=[];for(const ls of lS)try{const el=card.querySelector(ls);if(el){const t=el.textContent.trim();if(/[\d,.%]+/.test(t)&&t.length<30){lF.push({css:`${uS} ${ls}`,xpath:sXP(el),example:t});if(!cd.likes)cd.likes=t}}}catch{}
        if(!cd.likes)for(const attr of['data-likes','data-rating','data-score']){const el=card.querySelector(`[${attr}]`);if(el){cd.likes=el.getAttribute(attr);lF.push({css:`${uS} [${attr}]`,xpath:sXP(el),example:cd.likes});break}}
        if(i===0&&lF.length){r.structure.likes.css=lF[0].css;r.structure.likes.xpath=lF[0].xpath;r.structure.likes.example=lF[0].example;r.structure.likes.fb=lF.slice(1)}
        const dtF=[];for(const ds of dtS)try{const el=card.querySelector(ds);if(el){let t=el.textContent.trim();if(el.tagName==='TIME'&&el.getAttribute('datetime')&&!/PT\d/.test(el.getAttribute('datetime')))t=el.getAttribute('datetime');if(t.length>2&&t.length<50&&/\d/.test(t)){dtF.push({css:`${uS} ${ds}`,xpath:sXP(el),example:t});if(!cd.date)cd.date=t}}}catch{}
        if(!cd.date)for(const el of card.querySelectorAll('span,div,small,em,time')){const t=el.textContent.trim();if(/^\d+\s*(дн|час|мин|ago|day|hour|min|week|month|назад)/i.test(t)||/^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(t)){cd.date=t;dtF.push({css:`${uS} ${el.tagName.toLowerCase()}`,xpath:sXP(el),example:t});break}}
        if(i===0&&dtF.length){r.structure.date.css=dtF[0].css;r.structure.date.xpath=dtF[0].xpath;r.structure.date.example=dtF[0].example;r.structure.date.fb=dtF.slice(1)}
        r.sampleCards.push(cd)}return r}

// ---- Video Page ----
async function aVP(url,base){const r={analyzed:false,videoUrl:url,urlStructure:{pattern:null},videoSources:{found:false,sources:[],methods:[]},relatedVideos:{found:false}};if(!url)return r;try{setStatus('📥 Видео...','loading');setProgress(82,'Видео...');const html=await fetchPage(url);const doc=parseH(html);r.analyzed=true;try{r.urlStructure.pattern=new URL(url).pathname.replace(/\/\d+\//g,'/{id}/').replace(/\/\d+$/,'/{id}').replace(/\/[a-z0-9_-]{10,}\/?$/i,'/{slug}/')}catch{}r.pageTitle=doc.title;const h1=doc.querySelector('h1');if(h1)r.videoTitle=h1.textContent.trim();
doc.querySelectorAll('video, video source').forEach(v=>{const s=v.getAttribute('src')||v.getAttribute('data-src');if(s){r.videoSources.sources.push({type:s.includes('.m3u8')?'HLS':s.includes('.mp4')?'MP4':'?',url:resolve(s,base),foundIn:'<video>',attr:v.hasAttribute('data-src')?'data-src':'src'});r.videoSources.found=true;r.videoSources.methods.push('video_tag')}});
const asc=Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n');for(const p of[/["'](?:file|src|source|video_url|mp4|hls)["']\s*[:=]\s*["'](https?:\/\/[^"']+\.(?:mp4|m3u8|webm)[^"']*?)["']/gi,/(?:https?:\/\/[^\s"'<>]+\.(?:mp4|m3u8|webm)(?:\?[^\s"'<>]*)?)/gi]){let m;while((m=p.exec(asc))){const u=(m[1]||m[0]).replace(/\\/g,'');if(/\.(mp4|m3u8|webm)/.test(u)){const tok=/(?:token|expires|hash|sign)=/i.test(u);r.videoSources.sources.push({type:u.includes('.m3u8')?'HLS':u.includes('.mp4')?'MP4':'WebM',url:u,foundIn:'JS',tokenized:tok});r.videoSources.found=true;r.videoSources.methods.push('javascript')}}p.lastIndex=0}
doc.querySelectorAll('meta[property="og:video"],meta[property="og:video:url"]').forEach(m=>{const u=m.getAttribute('content');if(u){r.videoSources.sources.push({type:u.includes('.m3u8')?'HLS':'MP4',url:resolve(u,base),foundIn:'og:meta'});r.videoSources.found=true;r.videoSources.methods.push('meta_tag')}});
const ifs=[];doc.querySelectorAll('iframe[src],iframe[data-src]').forEach(f=>{const s=f.getAttribute('src')||f.getAttribute('data-src');if(s&&(s.includes('player')||s.includes('embed')||s.includes('video')))ifs.push({src:resolve(s,base)})});if(ifs.length){r.videoSources.playerIframes=ifs;r.videoSources.methods.push('iframe')}
const we=await extractVW(url);if(we){r.videoSources.sources.push({type:we.includes('.m3u8')?'HLS':'MP4',url:we,foundIn:'Worker✦'});r.videoSources.found=true;r.videoSources.methods.push('worker_extract')}
const ob=aObf(html);if(ob.base64Urls.length){ob.base64Urls.forEach(b=>{r.videoSources.sources.push({type:b.type,url:b.dec,foundIn:'Base64',base64:true})});r.videoSources.found=true;r.videoSources.methods.push('base64')}
if(!r.videoSources.found)for(const p of[/["'](https?:\/\/[^"']+\.mp4[^"']*)['"]/i,/["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/i]){const m=html.match(p);if(m?.[1]){r.videoSources.sources.push({type:m[1].includes('.m3u8')?'HLS':'MP4',url:m[1],foundIn:'pattern'});r.videoSources.found=true;r.videoSources.methods.push('pattern');break}}
const ss=new Set();r.videoSources.sources=r.videoSources.sources.filter(s=>{if(ss.has(s.url))return false;ss.add(s.url);return true});r.videoSources.methods=uniq(r.videoSources.methods);r.obfuscation=ob;
for(const sel of['.related','.related-videos','.similar','#related','[class*="related"]'])try{const el=doc.querySelector(sel);if(el){const rl=el.querySelectorAll('a[href]');if(rl.length){r.relatedVideos={found:true,selector:sel,count:rl.length};break}}}catch{}}catch(e){r.error=isCE(e)?'🛡️ CORS':e.message}return r}

// ---- Synthesis ----
function synth(dom,fw,api,prot,obf,jsd,vc,vp){let st='A',lb='Статический HTML',ds='Все данные в HTML';const empty=dom.totalElements<100,spa=fw.some(f=>['React','Vue.js','Angular','Next.js','Nuxt.js'].includes(f));const hAPI=api.endpoints.length>0||api.stateVars.length>0;const hls=vp?.videoSources?.sources?.some(s=>(s.type||'').includes('HLS'));const ifr=vp?.videoSources?.playerIframes?.length>0;
if(empty&&spa){st='C';lb='Dynamic JS';ds='Headless'}else if(!empty&&hAPI&&!vc?.found){st='B';lb='JSON API';ds='API sniffing'}else if(hls&&!vc?.found){st='D';lb='Стриминг';ds='Stream extractor'}else if(vc?.found&&(ifr||spa||hAPI)){st='E';lb='Гибрид';ds='HTML+JS'}
let cx=1;const cf=[];if(vc?.found){cx-=.5;cf.push({t:'Cards HTML',e:-.5})}else{cx+=1.5;cf.push({t:'No cards',e:1.5})}
if(vp?.videoSources?.found){const mt=vp.videoSources.methods||[];if(mt.includes('video_tag')){cf.push({t:'<video>',e:-.3});cx-=.3}else if(mt.includes('javascript')){cf.push({t:'JS',e:.3});cx+=.3}else if(mt.includes('base64')){cf.push({t:'Base64',e:.8});cx+=.8}}else{cx+=1;cf.push({t:'No video',e:1})}
if(ifr){cx+=.5;cf.push({t:'iframe',e:.5})}if(empty){cx+=1.5;cf.push({t:'Empty DOM',e:1.5})}if(spa){cx+=.5;cf.push({t:'SPA',e:.5})}if(prot.cloudflare){cx+=1;cf.push({t:'CF',e:1})}if(prot.ddosGuard){cx+=.8;cf.push({t:'DDoS',e:.8})}if(prot.recaptcha){cx+=1;cf.push({t:'CAPTCHA',e:1})}if(obf?.base64Urls?.length){cx+=.5;cf.push({t:'Base64 obf',e:.5})}
const lvl=Math.max(1,Math.min(5,Math.round(cx)));const ll={1:'Элементарно',2:'Просто',3:'Средне',4:'Сложно',5:'Очень сложно'};
let rm='CSS + XPath',rt='Cheerio/BS4',rtr='Прокси',rn=[];if(st==='B'){rm='API sniffing';rt='requests+JSON'}else if(st==='C'){rm='Headless';rt='Puppeteer';rtr='Headless Chrome'}else if(st==='E'){rm='CSS + JS regex';rt='Cheerio + regex'}
if(prot.cloudflare||prot.ddosGuard){rtr='Worker/stealth';rn.push('Anti-DDoS')}if(jsd.jsRequired==='yes')rn.push('Requires JS');
return{siteType:st,siteTypeLabel:lb,siteTypeDesc:ds,complexity:lvl,complexityLabel:ll[lvl],complexityFactors:cf,recommendation:{method:rm,tools:rt,transport:rtr,notes:rn},frameworks:fw,apiEndpoints:api.endpoints,stateVars:api.stateVars,protection:prot,domInfo:dom,jsDependency:jsd,obfuscation:obf,headersUsed:{'User-Agent':getUA()}}}

// ================================================================
// MAIN
// ================================================================
async function runFullAnalysis(){
    const ui=$('targetUrl'),targetUrl=(ui?.value.trim()||'')||DEFAULT_TARGET_URL;
    if(!targetUrl){setStatus('❌ URL!','error');return}try{new URL(targetUrl)}catch{setStatus('❌ Bad URL','error');return}
    if(ui)ui.value=targetUrl;const base=baseOf(targetUrl),w=getW();
    const btn=$('btnAnalyze');if(btn){btn.disabled=true;btn.textContent='⏳'}
    $('results').style.display='none';updCI('hidden');updW(!!w);transportLog=[];
    const pb=$('progress-bar');if(pb)pb.classList.remove('cors-error','warning','worker');
    analysisResult={_meta:{analyzedUrl:targetUrl,baseUrl:base,analyzedAt:new Date().toISOString(),workerUsed:w||'нет',userAgent:getUA(),testWord:getTestWord(),tool:'v3.3'}};
    try{
        setStatus('📥','loading');setProgress(10,'📡');
        let html;try{html=await fetchPage(targetUrl)}catch(e){setProgress(10,'❌','cors-error');setStatus('❌ '+e.message,'error');analysisResult._error={type:isCE(e)?'CORS':'FETCH',message:e.message};analysisResult._transportLog=transportLog;displayResults(analysisResult);return}
        const doc=parseH(html);setProgress(20,(html.length/1024).toFixed(0)+'KB');
        setProgress(22,'DOM');const dom=aDom(doc);
        setProgress(25,'Enc');analysisResult.encoding=aEnc(doc);
        setProgress(27,'Meta');analysisResult.meta=aMeta(doc);
        setProgress(30,'FW');const fw=aFW(doc,html);
        setProgress(34,'API');const api=aAPI(doc);
        setProgress(38,'Prot');const prot=aProt(doc,html);
        setProgress(40,'Obf');const obf=aObf(html);
        setProgress(44,'Pag');analysisResult.pagination=aPag(doc,base,targetUrl);
        setProgress(48,'QP');analysisResult.queryParams=aQP(doc,base);
        setProgress(55,'Cards');analysisResult.videoCards=aCards(doc,base);
        setProgress(62,'JS dep');const jsd=aJSD(doc,html,analysisResult.videoCards.found,fw);
        setProgress(68,'JS Navigation');analysisResult.navigation=parseJsNavigation(doc,html,base);
        setProgress(76,'Video');const svUrl=analysisResult.videoCards.sampleCards?.[0]?.link;
        analysisResult.videoPage=svUrl?await aVP(svUrl,base):{analyzed:false};
        setProgress(88,'Synth');analysisResult.architecture=synth(dom,fw,api,prot,obf,jsd,analysisResult.videoCards,analysisResult.videoPage);
        setProgress(94,'Report');
        analysisResult._summary={siteType:analysisResult.architecture.siteType,siteTypeLabel:analysisResult.architecture.siteTypeLabel,complexity:analysisResult.architecture.complexity,complexityLabel:analysisResult.architecture.complexityLabel,jsRequired:jsd.jsRequired,encoding:analysisResult.encoding.charset,hasPagination:analysisResult.pagination.pagination.found,paginationPattern:analysisResult.pagination.pagination.pattern,videoCardsFound:analysisResult.videoCards.totalCardsFound,fieldsFound:Object.entries(analysisResult.videoCards.structure).filter(([_,v])=>v.css).map(([k])=>k),videoSourceFound:analysisResult.videoPage.videoSources?.found||false,videoSourceMethods:analysisResult.videoPage.videoSources?.methods||[],categoriesCount:analysisResult.navigation.categories.totalCount,categoriesSource:analysisResult.navigation.categories.source,sortingOptions:analysisResult.navigation.sorting.fromJs.length||analysisResult.navigation.sorting.fromHtml.length,searchParamNames:analysisResult.navigation.search.paramNames,testWord:getTestWord(),frameworks:fw,protection:{cloudflare:prot.cloudflare,ddosGuard:prot.ddosGuard,recaptcha:prot.recaptcha,ageGate:!!prot.ageGate?.detected}};
        analysisResult._transportLog=transportLog;displayResults(analysisResult);setProgress(100,'✅');setStatus('✅ Готово!','success');
    }catch(e){setStatus('❌ '+e.message,'error');analysisResult._transportLog=transportLog;displayResults(analysisResult)}
    finally{if(btn){btn.disabled=false;btn.textContent='🚀 Полный анализ'}}}

// ================================================================
// DISPLAY
// ================================================================
function displayResults(d){$('results').style.display='block';const j=JSON.stringify(d,null,2);$('jsonFormatted').innerHTML=synHL(j);$('jsonRaw').value=j;$('visualReport').innerHTML=genVis(d);$('archReport').innerHTML=genArch(d);$('btnCopyJson').disabled=false;$('btnCopyArch').disabled=false}

// ================================================================
// ARCHITECTURE TAB (render — без изменений)
// ================================================================
function genArch(d){
    if(!d.architecture)return d._error?genCors(d):'<p style="color:#555">Нет данных</p>';
    const a=d.architecture,l=a.complexity,lc=['','lc1','lc2','lc3','lc4','lc5'][l];
    let h='';
    h+=`<div class="arch-diag"><div class="arch-main l${l}"><span class="atb atb-${a.siteType}">Тип ${a.siteType}</span><div class="ast">${esc(a.siteTypeLabel)}</div><div class="asd">${esc(a.siteTypeDesc)}</div>
    <table style="font-size:11px;color:#aaa;width:100%;border-collapse:collapse"><tr><th style="text-align:left;padding:2px 5px;color:#666;border-bottom:1px solid #222">Фактор</th><th style="text-align:right;padding:2px 5px;color:#666;border-bottom:1px solid #222">Вес</th></tr>
    ${a.complexityFactors.map(f=>`<tr><td style="padding:2px 5px">${esc(f.t)}</td><td style="text-align:right;color:${f.e>0?'#f66':'#6f6'}">${f.e>0?'+':''}${f.e}</td></tr>`).join('')}</table>
    </div><div class="arch-cx"><div class="cg"><span class="cn ${lc}">${l}/5</span></div><div class="cl ${lc}">${esc(a.complexityLabel)}</div><div class="cs">Сложность</div></div></div>`;
    const js=a.jsDependency;if(js){const vc=js.jsRequired==='yes'?'jy':js.jsRequired==='partial'?'jp':'jn';
    h+=`<div class="jsv"><h4 class="${vc}">🔧 JS: ${js.jsRequired==='yes'?'❌ Требуется':js.jsRequired==='partial'?'⚠️ Частично':'✅ Не нужен'}</h4>
    ${js.ev.length?'<ul style="padding-left:16px;margin-top:4px">'+js.ev.map(e=>`<li style="font-size:11px;color:#777">${esc(e)}</li>`).join('')+'</ul>':''}</div>`}
    const rc=a.recommendation;
    h+=`<div class="ab"><h3 class="wt">🔧 Стек</h3><div class="arg">
    <span class="arl">📦 Метод:</span><span class="arv"><code>${esc(rc.method)}</code></span>
    <span class="arl">🛠 Инструменты:</span><span class="arv"><code>${esc(rc.tools)}</code></span>
    <span class="arl">🔗 Транспорт:</span><span class="arv">${esc(rc.transport)}</span>
    <span class="arl">📡 UA:</span><span class="arv"><code style="font-size:10px">${esc((a.headersUsed?.['User-Agent']||'').substring(0,60))}</code></span>
    ${rc.notes.map(n=>`<span class="arl">⚠️</span><span class="arv w">${esc(n)}</span>`).join('')}</div></div>`;
    const nav=d.navigation;if(nav){
        h+='<div class="url-scheme"><h3>🗺️ URL-схема сайта (для парсера)</h3>';
        if(nav.urlScheme?.search){const s=nav.urlScheme.search;
            h+=`<div class="us-section"><h4>🔍 Поиск (тестовое слово: <strong>${esc(d._meta.testWord)}</strong>)</h4>
            <table class="us-table"><tr><th>Вариант</th><th>URL</th></tr>`;
            (nav.search.exampleUrls||[]).forEach(u=>{h+=`<tr><td>${esc(u.label)}</td><td><a class="url-link" href="${esc(u.url)}" target="_blank">${esc(u.url)}</a></td></tr>`});
            h+=`</table><div class="us-combo">Паттерн: <code>${esc(s.pattern)}</code></div></div>`}
        const sortOpts=nav.sorting.fromJs.length?nav.sorting.fromJs:nav.sorting.fromHtml;
        if(sortOpts.length){h+=`<div class="us-section"><h4>🔄 Сортировка (${sortOpts.length})</h4><table class="us-table"><tr><th>Название</th><th>Параметр</th></tr>`;sortOpts.forEach(s=>{h+=`<tr><td>${esc(s.label)}</td><td><code>${esc(s.param||'—')}</code></td></tr>`});h+='</table></div>'}
        if(nav.categories.merged.length){h+=`<div class="us-section"><h4>📁 Категории (${nav.categories.merged.length}, ${esc(nav.categories.source)})</h4><div class="us-cat-grid">`;nav.categories.merged.forEach(c=>{h+=`<div class="us-cat-item"><span class="cat-name">${esc(c.name)}</span><span class="cat-slug">${esc(c.slug)}</span></div>`});h+=`</div><div class="us-combo">Паттерн: <code>${esc(nav.urlScheme.category?.pattern||'')}</code></div></div>`}
        if(nav.urlScheme.combinations){const cb=nav.urlScheme.combinations;h+=`<div class="us-section"><h4>🔗 Комбинации</h4><table class="us-table">
        <tr><td>Поиск+Сорт+Стр</td><td><code>${esc(cb.searchPlusSortPlusPagination)}</code></td></tr>
        <tr><td>Кат+Сорт+Стр</td><td><code>${esc(cb.categoryPlusSortPlusPagination)}</code></td></tr></table></div>`}
        h+='</div>'}
    const vc2=d.videoCards;if(vc2?.found){
        h+=`<div class="ab"><h3>🎯 Селекторы (${vc2.totalCardsFound})</h3><table class="st"><tr><th>Поле</th><th>CSS</th><th>XPath</th><th>FB</th><th>Пример</th></tr>`;
        const mkR=(nm,f,ex)=>{const fbs=(f.fb||[]).map(x=>`<code class="fb">${esc(x.css||x.attr||'')}</code>`).join(' ');return`<tr><td><strong>${nm}</strong></td><td><code>${esc(f.css||'—')}</code></td><td><code class="xp">${esc(f.xpath||'—')}</code></td><td>${fbs||'—'}</td><td style="font-size:10px;color:#888;max-width:150px;overflow:hidden;text-overflow:ellipsis">${esc((ex||f.example||'').substring(0,50))}</td></tr>`};
        const st=vc2.structure;
        h+=`<tr><td><strong>📦 Card</strong></td><td><code>${esc(vc2.cardSelector)}</code></td><td><code class="xp">${esc(vc2.cardXPath||'—')}</code></td><td>—</td><td>${vc2.totalCardsFound}</td></tr>`;
        h+=mkR('📌 Title',st.title);h+=mkR('🔗 Link',st.link,st.link.pattern);h+=mkR('🖼 Thumb',st.thumbnail,st.thumbnail.attribute?'attr:'+st.thumbnail.attribute:'');
        h+=mkR('⏱ Dur',st.duration);h+=mkR('📺 Qual',st.quality);h+=mkR('👁 Views',st.views);h+=mkR('👍 Likes',st.likes);h+=mkR('📅 Date',st.date);
        h+='</table></div>'}
    if(d.videoPage?.videoSources?.sources?.length){h+='<div class="ab"><h3>🎬 Видео</h3>';d.videoPage.videoSources.sources.forEach(s=>{h+=`<div class="vui"><code>${esc(s.url)}</code><div class="vum"><span class="vt ${(s.type||'').includes('HLS')?'hls':'mp4'}">${esc(s.type)}</span><span class="vt mth">${esc(s.foundIn)}</span>${s.tokenized?'<span class="vt tok">⏰</span>':''}${s.base64?'<span class="vt b64">🔐</span>':''}</div></div>`});h+='</div>'}
    if(d.queryParams?.length){h+=`<div class="ab"><h3>🔎 GET (${d.queryParams.length})</h3><table class="qpt"><tr><th>P</th><th>Тип</th><th>Знач</th><th>#</th></tr>`;d.queryParams.forEach(p=>{h+=`<tr><td><code>${esc(p.param)}</code></td><td><span class="tag">${esc(p.category)}</span></td><td style="font-size:10px;color:#888">${p.values.slice(0,5).map(v=>esc(v)).join(', ')}</td><td>${p.count}</td></tr>`});h+='</table></div>'}
    const sm=d._summary||{};const checks=[{i:'📄',l:'Каталог',v:vc2?.found?`✅ ${vc2.totalCardsFound}`:'❌',c:vc2?.found?'ok':'fail'},{i:'🗂',l:'Полей',v:sm.fieldsFound?.length?sm.fieldsFound.join(','):'—',c:sm.fieldsFound?.length?'ok':'n'},{i:'📁',l:'Категории',v:sm.categoriesCount?`✅ ${sm.categoriesCount} (${sm.categoriesSource})`:'❌',c:sm.categoriesCount?'ok':'fail'},{i:'🔄',l:'Сортировка',v:sm.sortingOptions?`✅ ${sm.sortingOptions}`:'❌',c:sm.sortingOptions?'ok':'fail'},{i:'🔍',l:'Поиск',v:sm.searchParamNames?.length?`✅ ${sm.searchParamNames.join(',')}`:'❌',c:sm.searchParamNames?.length?'ok':'fail'},{i:'📑',l:'Пагинация',v:sm.hasPagination?`✅ ${sm.paginationPattern}`:'❌',c:sm.hasPagination?'ok':'fail'},{i:'▶️',l:'Видео',v:sm.videoSourceFound?`✅ ${sm.videoSourceMethods.join(',')}`:'❌',c:sm.videoSourceFound?'ok':'fail'},{i:'📊',l:'DOM',v:a.domInfo?.totalElements||'?',c:(a.domInfo?.totalElements||0)<100?'warn':'ok'},{i:'🛡️',l:'CF',v:a.protection?.cloudflare?'⚠️':'—',c:a.protection?.cloudflare?'warn':'n'},{i:'🤖',l:'CAPTCHA',v:a.protection?.recaptcha?'❌':'—',c:a.protection?.recaptcha?'fail':'n'}];
    h+='<div class="ab"><h3>✅ Чеклист</h3><div class="acg">';checks.forEach(c=>{h+=`<div class="aci"><span class="aci-i">${c.i}</span><span class="aci-l">${esc(c.l)}</span><span class="aci-v ${c.c}">${c.v}</span></div>`});h+='</div></div>';
    if(a.protection?.ageGate?.detected){const ag=a.protection.ageGate;h+=`<div class="age-g"><h4>🔞 Age gate <span class="gt ${ag.type}">${esc(ag.type)}</span></h4><p>${esc(ag.note)}</p></div>`}
    h+='<div class="adg">';
    h+=`<div class="adc"><h4>⚙️ FW</h4>${a.frameworks?.length?'<ul>'+a.frameworks.map(f=>`<li><code>${esc(f)}</code></li>`).join('')+'</ul>':'<p class="ade">—</p>'}</div>`;
    h+=`<div class="adc"><h4>🔌 API</h4>${(a.apiEndpoints?.length||a.stateVars?.length)?'<ul>'+(a.stateVars||[]).map(v=>`<li>🗂 <code>${esc(v)}</code></li>`).join('')+(a.apiEndpoints||[]).map(e=>`<li>🔗 <code>${esc(e)}</code></li>`).join('')+'</ul>':'<p class="ade">HTML</p>'}</div>`;
    h+=`<div class="adc"><h4>📊 DOM</h4><ul><li>Els: <code>${a.domInfo?.totalElements||0}</code></li><li>Scripts: <code>${a.domInfo?.scripts||0}</code> (${((a.domInfo?.inlineScriptSize||0)/1024).toFixed(1)}KB)</li><li>Img: <code>${a.domInfo?.images||0}</code> Links: <code>${a.domInfo?.links||0}</code></li></ul></div>`;
    if(a.protection?.cookies?.length)h+=`<div class="adc"><h4>🍪 Cookies</h4><ul>${a.protection.cookies.map(c=>`<li><code>${esc(c)}</code></li>`).join('')}</ul></div>`;
    h+='</div>';
    if(d.videoCards?.sampleCards?.length){h+=`<div class="ab"><h3>📑 Карточки (${d.videoCards.sampleCards.length})</h3>`;d.videoCards.sampleCards.forEach((c,i)=>{h+=`<div style="margin-bottom:8px;padding:6px;background:#0f0f23;border-radius:5px;font-size:11px"><strong style="color:#00d4ff">#${i+1}</strong> `;if(c.title)h+=`📌${esc(c.title.substring(0,50))} `;if(c.duration)h+=`⏱${esc(c.duration)} `;if(c.quality)h+=`📺${esc(c.quality)} `;if(c.views)h+=`👁${esc(c.views)} `;if(c.likes)h+=`👍${esc(c.likes)} `;if(c.date)h+=`📅${esc(c.date)} `;if(c.slugName)h+=`<span style="color:#555">slug:${esc(c.slugName.substring(0,25))}</span>`;h+='</div>'});h+='</div>'}
    if(d._transportLog?.length){h+=`<div class="ab"><h3>🔌 Транспорт</h3><div class="transport-log">`;d._transportLog.forEach(e=>{h+=`<div class="tle ${e.type}">[${e.time}] ${esc(e.message)}</div>`});h+='</div></div>'}
    return h}

function genCors(d){return`<div class="report-section cors-error-section"><div class="rsh">🛡️ Ошибка</div><div class="rsb"><div class="ri"><span class="rl">Тип:</span><span class="rv err">${esc(d._error?.type)}</span></div><div class="ri"><span class="rl">Info:</span><span class="rv err">${esc(d._error?.message)}</span></div><div class="cors-help-box"><h4>💡</h4><ol><li>Worker</li><li>Авто</li><li><a href="https://github.com/Rob--W/cors-anywhere" target="_blank">cors-anywhere</a></li></ol></div></div></div>`}

// ================================================================
// VISUAL (без изменений)
// ================================================================
function genVis(d){let h='';if(d._error)h+=genCors(d);if(d._summary){const s=d._summary;h+=`<div class="report-section"><div class="rsh">📋 Сводка</div><div class="rsb">
<div class="ri"><span class="rl">URL:</span><span class="rv">${esc(d._meta.analyzedUrl)}</span></div>
<div class="ri"><span class="rl">Тип:</span><span class="rv">${esc(s.siteTypeLabel)} (${s.siteType})</span></div>
<div class="ri"><span class="rl">Сложность:</span><span class="rv">${s.complexity}/5 — ${esc(s.complexityLabel)}</span></div>
<div class="ri"><span class="rl">Карточек:</span><span class="rv">${s.videoCardsFound||0}</span></div>
<div class="ri"><span class="rl">Категорий:</span><span class="rv">${s.categoriesCount||0} (${esc(s.categoriesSource||'—')})</span></div>
<div class="ri"><span class="rl">Сортировок:</span><span class="rv">${s.sortingOptions||0}</span></div>
<div class="ri"><span class="rl">Поиск:</span><span class="rv">${(s.searchParamNames||[]).join(', ')||'—'}</span></div>
<div class="ri"><span class="rl">Видео:</span><span class="rv ${s.videoSourceFound?'':'warn'}">${s.videoSourceFound?'✅ '+s.videoSourceMethods.join(','):'❌'}</span></div>
</div></div>`}
if(d.navigation?.categories?.merged?.length){h+=`<div class="report-section"><div class="rsh">📁 Категории (${d.navigation.categories.merged.length})</div><div class="rsb" style="max-height:250px;overflow-y:auto">`;d.navigation.categories.merged.forEach(c=>{h+=`<span class="tag" style="margin:2px">${esc(c.name)}</span>`});h+='</div></div>'}
if(d.navigation?.search?.exampleUrls?.length){h+=`<div class="report-section"><div class="rsh">🔍 Поиск: "${esc(d._meta.testWord)}"</div><div class="rsb">`;d.navigation.search.exampleUrls.forEach(u=>{h+=`<div class="ri"><span class="rl">${esc(u.label)}:</span><span class="rv"><a href="${esc(u.url)}" target="_blank" style="color:#00ff88">${esc(u.url)}</a></span></div>`});h+='</div></div>'}
return h}

// ================================================================
// UI + COPY (изменения тут)
// ================================================================
function synHL(j){j=j.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');return j.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,m=>{let c='color:#ae81ff';if(/^"/.test(m))c=/:$/.test(m)?'color:#a6e22e':'color:#e6db74';else if(/true|false/.test(m))c='color:#66d9ef';else if(/null/.test(m))c='color:#f92672';return`<span style="${c}">${m}</span>`})}
function showTab(n){document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));const t=$('tab-'+n);if(t)t.classList.add('active');if(event?.target)event.target.classList.add('active')}
function clip(text){navigator.clipboard.writeText(text).then(()=>setStatus('📋 OK','success')).catch(()=>{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);setStatus('📋 OK','success')})}
function copyResults(){if(analysisResult)clip(JSON.stringify(analysisResult,null,2))}

// ================================================================
// ИЗМЕНЕНИЕ 1: copyArchitecture — только уникальные данные
// (то, чего НЕТ в полном JSON или что является сводкой)
// ================================================================
function copyArchitecture(){
    if(!analysisResult)return;

    // Собираем ТОЛЬКО архитектурную аналитику:
    // - _summary (краткая сводка — не дублирует, а суммирует)
    // - navigation.urlScheme (URL-паттерны — главное для парсера)
    // - navigation.categories.merged (полный список категорий)
    // - navigation.sorting (варианты сортировки)
    // - navigation.search (поиск с примерами)
    // - videoCards.structure (селекторы CSS/XPath/fallbacks)
    // - architecture.recommendation (стек)
    // - architecture.complexity + type
    //
    // НЕ включаем (уже есть в полном JSON):
    // - _meta, _transportLog, encoding, meta, queryParams
    // - videoCards.sampleCards (есть в JSON)
    // - videoPage (полные данные есть в JSON)
    // - architecture.domInfo, frameworks, apiEndpoints, stateVars
    //   protection, jsDependency, obfuscation, complexityFactors
    //   (всё это есть в полном JSON в architecture.*)
    // - pagination (есть в JSON)

    const nav = analysisResult.navigation;
    const arch = analysisResult.architecture;
    const vc = analysisResult.videoCards;

    const archOnly = {
        // Диагноз
        siteType: arch?.siteType,
        siteTypeLabel: arch?.siteTypeLabel,
        complexity: arch?.complexity,
        complexityLabel: arch?.complexityLabel,
        jsRequired: arch?.jsDependency?.jsRequired,
        recommendation: arch?.recommendation,

        // URL-схема — главное для парсера
        urlScheme: nav?.urlScheme,

        // Категории (полный список — не дублируется в JSON)
        categories: nav?.categories?.merged,
        categoriesSource: nav?.categories?.source,
        categoriesCount: nav?.categories?.totalCount,

        // Сортировка
        sorting: nav?.sorting?.fromJs?.length
            ? nav.sorting.fromJs
            : nav?.sorting?.fromHtml,

        // Поиск с примерами URL
        search: {
            paramNames: nav?.search?.paramNames,
            testWord: nav?.search?.testWord,
            exampleUrls: nav?.search?.exampleUrls,
        },

        // Селекторы (CSS + XPath + fallbacks) — главное для парсера
        selectors: vc?.found ? vc.structure : null,
        cardSelector: vc?.cardSelector,
        cardXPath: vc?.cardXPath,

        // Видео-источники (только структура, не raw data)
        videoUrlPattern: analysisResult.videoPage?.urlStructure?.pattern,
        videoMethods: analysisResult.videoPage?.videoSources?.methods,
        videoSourceCount: analysisResult.videoPage?.videoSources?.sources?.length || 0,
    };

    clip(JSON.stringify(archOnly, null, 2));
    setStatus('🏗️ Архитектура скопирована (без дублей)!', 'success');
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded',()=>{
    const ui=$('targetUrl');if(DEFAULT_TARGET_URL&&ui&&!ui.value)ui.value=DEFAULT_TARGET_URL;if(ui)ui.addEventListener('keypress',e=>{if(e.key==='Enter')runFullAnalysis()});
    const ps=$('proxySelect');if(ps)ps.addEventListener('change',()=>{const h=$('proxyHint');if(h)h.textContent={'auto':'Прямой→Worker→прокси','':'Прямой'}[ps.value]||ps.value.split('/')[2]||''});

    // ИЗМЕНЕНИЕ 2: Worker — default + localStorage
    const wi=$('workerUrl');
    if(wi){
        const saved=localStorage.getItem('aWU');
        if(saved){
            wi.value=saved;
        }else if(!wi.value){
            wi.value=DEFAULT_WORKER_URL;
        }
        updW(!!wi.value.trim());
        wi.addEventListener('input',()=>updW(!!wi.value.trim()));
        wi.addEventListener('change',()=>{
            const v=wi.value.trim();
            if(v)localStorage.setItem('aWU',v);
            else localStorage.removeItem('aWU');
        });
    }

    const ua=$('uaSelect'),uc=$('uaCustom');if(ua&&uc)ua.addEventListener('change',()=>{uc.style.display=ua.value==='custom'?'block':'none'});
});
