// ================================================================
// SITE STRUCTURE ANALYZER v4.0.0
// Player Structure, Quality Map, CDN Whitelist, JS Config Detection,
// Video URL Templates, Required Headers, URL Format, Parser Flow,
// Referer check, JSON encodings detection
// ================================================================
const DEFAULT_WORKER_URL="https://zonaproxy.777b737.workers.dev";
let analysisResult=null,transportLog=[];
const logT=(m,t='info')=>transportLog.push({time:new Date().toLocaleTimeString(),message:m,type:t});
const $=id=>document.getElementById(id);
const setStatus=(m,t='loading')=>{const e=$('status');if(e){e.textContent=m;e.className='status '+t}};
const setProgress=(p,t,s)=>{const c=$('progress-container'),b=$('progress-bar'),x=$('progress-text');if(!c)return;c.style.display='block';b.style.width=p+'%';x.textContent=t||p+'%';b.classList.remove('cors-error','warning','worker');if(s)b.classList.add(s)};
const baseOf=u=>{try{return new URL(u).origin}catch{return''}};
const resolve=(h,b)=>{if(!h)return'';try{return new URL(h,b).href}catch{return h}};
const hostOf=u=>{try{return new URL(u).hostname}catch{return''}};
const uniq=a=>[...new Set(a.filter(Boolean))];
const esc=t=>{if(!t)return'';const d=document.createElement('div');d.textContent=String(t);return d.innerHTML};
const getTestWord=()=>($('testWord')?.value.trim()||'wife');
const UA={desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',mobile:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Mobile Chrome/120.0.0.0',bot:'Googlebot/2.1'};
function getUA(){const s=$('uaSelect');return s?UA[s.value]||UA.desktop:UA.desktop}
function genXP(el){if(!el||el.nodeType!==1)return'';if(el.id)return`//*[@id="${el.id}"]`;const p=[];let c=el;while(c&&c.nodeType===1){let t=c.tagName.toLowerCase();if(c.className&&typeof c.className==='string'){const cl=c.className.trim().split(/\s+/)[0];if(cl&&cl.length>2){p.unshift(`//${t}[contains(@class,"${cl}")]`);break}}let i=1,s=c.previousElementSibling;while(s){if(s.tagName===c.tagName)i++;s=s.previousElementSibling}p.unshift(`/${t}[${i}]`);c=c.parentElement}return p.join('')}
function sXP(el){if(!el||el.nodeType!==1)return'';const t=el.tagName.toLowerCase();if(el.id)return`//*[@id="${el.id}"]`;if(el.className&&typeof el.className==='string'){const c=el.className.trim().split(/\s+/)[0];if(c)return`//${t}[contains(@class,"${c}")]`}return`//${t}`}

// ---- Transport ----
const getW=()=>{const i=$('workerUrl');return i?i.value.trim().replace(/\/$/,''):''};
const updW=h=>{const b=$('workerStatusBadge');if(b){b.textContent=h?'✦':'○';b.className='worker-badge '+(h?'active':'inactive')}};
function updCI(s,d){const el=$('corsIndicator');if(!el)return;const m={'trying-direct':['🔗','trying'],'direct-ok':['✅','direct-ok'],'trying-worker':['⚡','trying'],'worker-ok':['✅ W','worker-ok'],'cors-detected':['🛡️ CORS','cors-blocked'],'trying-proxy':['🔄 '+(d||''),'cors-blocked'],'proxy-ok':['✅ '+(d||''),'proxy-ok'],'all-failed':['❌','all-failed'],hidden:['','']};const v=m[s]||m.hidden;el.textContent=v[0];el.className='cors-indicator '+v[1];el.style.display=s==='hidden'?'none':'block'}
const proxies=()=>[{n:'allorigins',u:'https://api.allorigins.win/raw?url='},{n:'corsproxy',u:'https://corsproxy.io/?'},{n:'codetabs',u:'https://api.codetabs.com/v1/proxy?quest='}];
const isCE=e=>{if(!e)return false;const m=(e.message||'').toLowerCase();return m.includes('failed to fetch')||m.includes('networkerror')||m.includes('load failed')||e.name==='TypeError'};
async function fD(url){const a=new AbortController,t=setTimeout(()=>a.abort(),10000);try{const r=await fetch(url,{signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('HTTP '+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}
async function fW(url){const w=getW();if(!w)throw new Error('No W');const a=new AbortController,t=setTimeout(()=>a.abort(),15000);try{const r=await fetch(w+'/?url='+encodeURIComponent(url)+'&ua='+encodeURIComponent(getUA()),{signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('W'+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}
async function fP(url,pfx){const a=new AbortController,t=setTimeout(()=>a.abort(),15000);try{const r=await fetch(pfx+encodeURIComponent(url),{signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('HTTP '+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}
async function fetchPage(url){const mode=($('proxySelect')||{}).value||'auto',w=getW();if(mode===''||mode==='direct-test'){try{return await fD(url)}catch(e){throw e}}if(mode==='auto'){try{logT('Direct');updCI('trying-direct');const h=await fD(url);logT('✅','success');updCI('direct-ok');return h}catch(e){logT(isCE(e)?'CORS':e.message,'warning')}if(w){try{logT('Worker');updCI('trying-worker');setProgress(14,'⚡','worker');const h=await fW(url);logT('✅ W','success');updCI('worker-ok');return h}catch(e){logT('W:'+e.message,'fail')}}updCI('cors-detected');const px=proxies();for(let i=0;i<px.length;i++){try{logT(px[i].n);updCI('trying-proxy',px[i].n);const h=await fP(url,px[i].u);logT('✅ '+px[i].n,'success');updCI('proxy-ok',px[i].n);return h}catch(e){logT('❌ '+px[i].n,'fail')}}updCI('all-failed');throw new Error('All blocked')}if(w){try{return await fW(url)}catch(e){logT('W:'+e.message,'warning')}}try{return await fP(url,mode)}catch(e){throw e}}
const parseH=h=>new DOMParser().parseFromString(h,'text/html');

// ================================================================
// ANALYZERS
// ================================================================
function aDom(doc){return{totalElements:doc.querySelectorAll('*').length,scripts:doc.querySelectorAll('script').length,images:doc.querySelectorAll('img').length,links:doc.querySelectorAll('a[href]').length,externalScripts:Array.from(doc.querySelectorAll('script[src]')).map(s=>s.src).slice(0,20)}}
function aFW(doc,html){const f=[],src=html+Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n');const ck=[['React',['data-reactroot','ReactDOM']],['Next.js',['__NEXT_DATA__']],['Vue.js',['__vue__','data-v-']],['Nuxt.js',['__NUXT__']],['jQuery',['jquery.min.js','jQuery']],['Cloudflare',['challenges.cloudflare.com']],['DDoS-Guard',['ddos-guard']],['JW Player',['jwplayer']],['Video.js',['videojs','video-js']],['HLS.js',['hls.js','Hls.']]];for(const[n,ps]of ck)for(const p of ps)if(src.includes(p)){f.push(n);break}return uniq(f)}
function aAPI(doc){const src=Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n'),eps=[];for(const p of[/fetch\s*\(\s*['"`](\/[^'"`]+)/gi,/axios\.\w+\(\s*['"`](\/[^'"`]+)/gi]){let m;while((m=p.exec(src)))eps.push(m[1]);p.lastIndex=0}return{endpoints:uniq(eps).slice(0,15)}}
function aEnc(doc){const mc=doc.querySelector('meta[charset]');return{charset:mc?mc.getAttribute('charset').toUpperCase():'N/A'}}

// ================================================================
// PROTECTION v3 — Age Gate 3 типа + DRM + Turnstile + Referer + Auth
// ================================================================
function aProt(doc,html){
    const r={cloudflare:false,cloudflareTurnstile:false,ddosGuard:false,recaptcha:false,drm:false,drmDetails:[],authRequired:false,refererProtected:false,ageGate:null,cookies:[],requiredHeaders:{}};
    const lc=html.toLowerCase();const src=Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n');const combined=lc+src.toLowerCase();
    if(lc.includes('challenges.cloudflare.com')){r.cloudflare=true;r.cloudflareTurnstile=combined.includes('turnstile')||combined.includes('cf-turnstile')}
    if(lc.includes('ddos-guard'))r.ddosGuard=true;
    if(combined.includes('recaptcha')||combined.includes('hcaptcha'))r.recaptcha=true;
    for(const d of[{n:'Widevine',p:['widevine']},{n:'PlayReady',p:['playready']},{n:'FairPlay',p:['fairplay']},{n:'EME',p:['requestmedialkeysystemaccess','encrypted-media']}])for(const p of d.p)if(combined.includes(p)){r.drm=true;r.drmDetails.push(d.n);break}
    r.drmDetails=uniq(r.drmDetails);
    if(doc.querySelectorAll('form[action*="login"],form[action*="signin"],form[action*="auth"]').length)r.authRequired=true;
    // Referer check
    if(combined.includes('referer')||combined.includes('document.referrer'))r.refererProtected=true;
    // Cookies
    const cp=/(?:document\.cookie\s*=\s*['"`])([^'"`=;]+)/gi;let cm;while((cm=cp.exec(src)))r.cookies.push(cm[1]);r.cookies=uniq(r.cookies).slice(0,10);
    // Age Gate 3 types
    const ageCookies=['age_verified','disclaimer','over18','agegate','is_adult','mature','age_confirm','adult_confirm'];
    let ageType=null,ageDet={};
    // Type 2: POST form
    for(const form of doc.querySelectorAll('form')){const act=(form.getAttribute('action')||'').toLowerCase(),meth=(form.getAttribute('method')||'').toUpperCase();if((act.includes('age')||act.includes('verify')||act.includes('disclaimer'))&&meth==='POST'){ageType='post-form';ageDet={action:form.getAttribute('action'),method:'POST',note:'POST-подтверждение возраста'};break}}
    // Type 1: Cookie
    if(!ageType)for(const cn of ageCookies){if(combined.includes(cn)){ageType='cookie-flag';const vp=new RegExp(cn+'\\s*[=:]\\s*["\']?([^"\'\\s;,}{]+)','i'),vm=combined.match(vp);ageDet={cookieName:cn,cookieValue:vm?vm[1]:'1',note:`Cookie: ${cn}=${vm?vm[1]:'1'}`};break}}
    // Type 3: Overlay
    if(!ageType){for(const s of['#age-verify','#age-gate','.age-verify','.age-gate','[class*="age-verif"]','#disclaimer'])try{if(doc.querySelector(s)){ageType='js-overlay';ageDet={selector:s,note:'CSS/JS-оверлей — контент в HTML'};break}}catch{}}
    if(!ageType&&/(?:мне\s*(?:уже\s*)?18|i\s*am\s*(?:over\s*)?18|18\+)/i.test(doc.body?.textContent||'')){ageType='js-overlay';ageDet={note:'Текст 18+ найден'}}
    if(ageType)r.ageGate={detected:true,type:ageType,impact:ageType==='js-overlay'?'none':ageType==='cookie-flag'?'low':'medium',...ageDet};
    // Required Headers
    r.requiredHeaders={};
    if(r.ageGate?.cookieName)r.requiredHeaders.Cookie=(r.ageGate.cookieName+'='+(r.ageGate.cookieValue||'1'));
    if(r.refererProtected)r.requiredHeaders.Referer=baseOf(doc.baseURI||'')+'/';
    r.requiredHeaders['User-Agent']=getUA();
    return r}

// ================================================================
// JS NAVIGATION (categories, sorting, search)
// ================================================================
function parseJsNav(doc,html,base){const allS=Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n');const comb=allS+'\n'+html;const res={categories:{fromJs:[],fromHtml:[],merged:[]},sorting:{fromJs:[],fromHtml:[]},search:{paramNames:[],testWord:getTestWord(),exampleUrls:[]},urlScheme:{}};const tw=getTestWord();
    // Categories JS
    const jsCats=new Map();for(const pat of[/new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*[?&]c=([A-Za-z0-9_-]+(?:-\d+)?)/g]){let m;while((m=pat.exec(comb))!==null){const n=m[1].trim(),s=m[2];if(n&&s&&!jsCats.has(s))jsCats.set(s,{name:n,slug:s,url:base+'/?c='+s})}pat.lastIndex=0}
    const cPP=/[?&]c=([A-Za-z0-9_-]+(?:-\d+)?)/g;let cm;while((cm=cPP.exec(comb))!==null){const s=cm[1];if(!jsCats.has(s)&&s.length>1&&s.length<60)jsCats.set(s,{name:s.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),slug:s,url:base+'/?c='+s})}
    res.categories.fromJs=[...jsCats.values()];
    // Categories HTML
    for(const sel of['a[href*="/c/"]','a[href*="?c="]','a[href*="/categories/"]','a[href*="/category/"]']){try{const links=doc.querySelectorAll(sel);if(links.length>=3){links.forEach(a=>{const href=a.getAttribute('href'),name=a.textContent.trim();if(href&&name){let slug='';const cM=href.match(/[?&]c=([^&]+)/),pM=href.match(/\/c\/([^/?]+)/);slug=cM?cM[1]:pM?pM[1]:href.split('/').filter(Boolean).pop()||'';res.categories.fromHtml.push({name,slug,url:resolve(href,base)})}});break}}catch{}}
    const mm=new Map();res.categories.fromJs.forEach(c=>mm.set(c.slug,c));res.categories.fromHtml.forEach(c=>{if(!mm.has(c.slug))mm.set(c.slug,c)});res.categories.merged=[...mm.values()];res.categories.totalCount=res.categories.merged.length;res.categories.source=res.categories.fromJs.length>res.categories.fromHtml.length?'JavaScript':'HTML';
    // Sorting
    const jsS=new Map();const svP=/[?&]sort=([a-z0-9_-]+)/gi;while((cm=svP.exec(comb))!==null){const v=cm[1];if(!jsS.has(v))jsS.set(v,{label:v.replace(/[-_]/g,' '),param:'sort='+v})}res.sorting.fromJs=[...jsS.values()];
    // Search
    const fSP=new Set();for(const pat of[/[?&](search)=[^&"']+/gi,/[?&](k)=[^&"']+/gi,/[?&](q)=[^&"']+/gi]){let m;while((m=pat.exec(comb))!==null)fSP.add(m[1].toLowerCase());pat.lastIndex=0}
    doc.querySelectorAll('form input').forEach(i=>{const nm=(i.getAttribute('name')||'').toLowerCase();if(['q','k','query','search','s'].includes(nm))fSP.add(nm)});
    res.search.paramNames=[...fSP];const sP=res.search.paramNames[0]||'q';const eTW=encodeURIComponent(tw);
    res.search.exampleUrls.push({label:'Поиск: '+tw,url:base+'/?'+sP+'='+eTW});
    res.sorting.fromJs.forEach(s=>res.search.exampleUrls.push({label:'Поиск+'+s.label,url:base+'/?'+s.param+'&'+sP+'='+eTW}));
    res.urlScheme={base,search:{paramName:sP,pattern:base+'/?'+sP+'={query}'},category:{paramName:'c',pattern:base+'/?c={slug}'},sorting:{options:res.sorting.fromJs,pattern:base+'/?sort={value}'},pagination:{pattern:'&page={N}'},combinations:{searchSortPage:base+'/?sort={sort}&'+sP+'={query}&page={N}',categorySortPage:base+'/?sort={sort}&c={slug}&page={N}'}};
    return res}

// ================================================================
// CARDS
// ================================================================
function aCards(doc,base){const r={found:false,cardSelector:null,cardXPath:null,totalCardsFound:0,structure:{title:{css:null,xpath:null,fb:[],example:null},link:{css:null,xpath:null,fb:[],example:null,pattern:null},thumbnail:{css:null,xpath:null,fb:[],attribute:null,example:null},duration:{css:null,xpath:null,fb:[],example:null},quality:{css:null,xpath:null,fb:[],example:null},views:{css:null,xpath:null,fb:[],example:null}},sampleCards:[]};
    const cS=['.video-item','.video-card','.thumb-item','.thumb','.video-thumb','.video_block','.video-block','.item','.video','.thumb_main','article','.card','[data-video-id]'];
    let cards=[],uS='';for(const s of cS)try{const f=doc.querySelectorAll(s);if(f.length>=2&&Array.from(f).some(e=>e.querySelector('a[href]'))&&Array.from(f).some(e=>e.querySelector('img'))){cards=Array.from(f);uS=s;break}}catch{}
    if(!cards.length)return r;r.found=true;r.cardSelector=uS;r.totalCardsFound=cards.length;r.cardXPath=genXP(cards[0]);
    const tS=['.title','.name','.video-title','a[title]','[class*="title"]','h3','h4','strong'];
    const dS=['.duration','.time','[class*="duration"]','[class*="time"]'];
    const imgA=['data-src','data-original','data-lazy-src','data-thumb','src'];
    for(let i=0;i<Math.min(5,cards.length);i++){const card=cards[i],cd={};
        for(const ts of tS)try{const el=card.querySelector(ts);if(el){const t=ts==='a[title]'?el.getAttribute('title'):el.textContent.trim();if(t&&t.length>2&&t.length<300){if(!cd.title)cd.title=t;if(i===0){r.structure.title.css=`${uS} ${ts}`;r.structure.title.xpath=sXP(el);r.structure.title.example=t.substring(0,60)}break}}}catch{}
        const lk=card.querySelector('a[href]');if(lk){cd.link=resolve(lk.getAttribute('href'),base);if(i===0){r.structure.link.css=`${uS} a[href]`;r.structure.link.xpath=sXP(lk);r.structure.link.example=cd.link;try{r.structure.link.pattern=new URL(cd.link).pathname.replace(/\/\d+\//g,'/{id}/').replace(/\/[a-z0-9_-]{8,}\/?$/i,'/{slug}/')}catch{}}}
        card.querySelectorAll('img').forEach(img=>{if(cd.thumbnail)return;for(const at of imgA){const sv=img.getAttribute(at);if(sv&&!sv.startsWith('data:')&&sv.length>5){cd.thumbnail=resolve(sv,base);if(i===0){r.structure.thumbnail.css=`${uS} img`;r.structure.thumbnail.xpath=sXP(img);r.structure.thumbnail.attribute=at;r.structure.thumbnail.example=cd.thumbnail}break}}});
        for(const ds of dS)try{const el=card.querySelector(ds);if(el){const t=el.textContent.trim();if(/\d{1,2}:\d{2}/.test(t)){cd.duration=t;if(i===0){r.structure.duration.css=`${uS} ${ds}`;r.structure.duration.xpath=sXP(el);r.structure.duration.example=t}break}}}catch{}
        r.sampleCards.push(cd)}return r}

// ================================================================
// NEW: PLAYER STRUCTURE
// ================================================================
function analyzePlayer(doc,base){
    const r={videoTag:null,sources:[],jsConfigs:[],jsonEncodings:[],qualityMap:{},videoUrlTemplates:[]};
    // Video tag
    const vid=doc.querySelector('video');
    if(vid){r.videoTag={id:vid.id||null,poster:vid.getAttribute('poster')?resolve(vid.getAttribute('poster'),base):null,selector:vid.id?`video#${vid.id}`:'video'};
        // Sources
        doc.querySelectorAll('video source, source').forEach(s=>{const src=s.getAttribute('src')||s.getAttribute('data-src');if(!src)return;const entry={src:resolve(src,base),type:s.getAttribute('type')||null,size:s.getAttribute('size')||null,label:s.getAttribute('label')||null,res:s.getAttribute('res')||null,title:s.getAttribute('title')||null,dataQuality:s.getAttribute('data-quality')||null};
            const qa=entry.size||entry.label||entry.res||entry.title||entry.dataQuality;
            if(qa==='preview'){entry.skip=true;entry.skipReason='preview'}
            else{const qLabel=qa?(/^\d+$/.test(qa)?qa+'p':qa):null;entry.qualityDetected=qLabel;entry.detectionMethod=entry.size?'size-attr':entry.label?'label-attr':entry.res?'res-attr':entry.title?'title-attr':'unknown';
                if(qLabel&&entry.src){r.qualityMap[qLabel]={url:entry.src,source:'<source>',method:entry.detectionMethod,domain:hostOf(entry.src)}}}
            r.sources.push(entry)})}
    // og:video
    doc.querySelectorAll('meta[property="og:video"],meta[property="og:video:url"]').forEach(m=>{const u=m.getAttribute('content');if(u&&u.includes('.mp4')){const resolved=resolve(u,base);const qm=u.match(/_(\d+)\.mp4/);const label=qm?qm[1]+'p':'HD';if(!r.qualityMap[label])r.qualityMap[label]={url:resolved,source:'og:video',method:'filename-regex',domain:hostOf(resolved)}}});
    // JS player configs
    const allJS=Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n');
    const cfgPatterns=[
        {type:'kt_player',fields:[{re:/video_url\s*[:=]\s*['"]([^'"]+)['"]/,labelRe:/video_url_text\s*[:=]\s*['"]([^'"]+)['"]/,fb:'480p'},{re:/video_alt_url\s*[:=]\s*['"]([^'"]+)['"]/,labelRe:/video_alt_url_text\s*[:=]\s*['"]([^'"]+)['"]/,fb:'720p'}]},
        {type:'xvideos',fields:[{re:/setVideoUrlHigh\s*\(\s*['"]([^'"]+)['"]\)/,fb:'720p'},{re:/setVideoUrlLow\s*\(\s*['"]([^'"]+)['"]\)/,fb:'480p'},{re:/setVideoHLS\s*\(\s*['"]([^'"]+)['"]\)/,fb:'HLS'}]},
        {type:'jwplayer',fields:[{re:/file\s*:\s*['"]([^'"]+\.(?:mp4|m3u8)[^'"]*)['"]/,fb:'auto'}]},
    ];
    for(const cfg of cfgPatterns){const found=[];for(const f of cfg.fields){const m=allJS.match(f.re);if(m){let label=f.fb;if(f.labelRe){const lm=allJS.match(f.labelRe);if(lm)label=lm[1]}const url=resolve(m[1].replace(/\\\//g,'/'),base);found.push({field:f.re.source.substring(0,40),value:url,quality:label});if(!r.qualityMap[label])r.qualityMap[label]={url,source:'js-config',method:cfg.type,domain:hostOf(url)}}}
        if(found.length)r.jsConfigs.push({type:cfg.type,fields:found,extractionHint:cfg.type==='kt_player'?"video_url\\s*[:=]\\s*['\"]([^'\"]+)['\"]":cfg.type==='xvideos'?"setVideoUrlHigh\\(['\"]([^'\"]+)['\"]\\)":"file\\s*:\\s*['\"]([^'\"]+)['\"]"})}
    // JSON encodings
    for(const varName of['dataEncodings','sources','media_sources','video_sources']){const idx=allJS.indexOf(varName);if(idx===-1)continue;const arrS=allJS.indexOf('[',idx);if(arrS===-1||arrS-idx>50)continue;try{let depth=0,arrE=-1;for(let i=arrS;i<Math.min(allJS.length,arrS+5000);i++){if(allJS[i]==='[')depth++;else if(allJS[i]===']'){depth--;if(depth===0){arrE=i;break}}}if(arrE===-1)continue;const arr=JSON.parse(allJS.substring(arrS,arrE+1));arr.forEach(item=>{const u=item.filename||item.file||item.src||item.url||'';const q=item.quality||item.label||item.res||item.height||'';if(!u)return;const url=(u.indexOf('//')==0?'https:':'')+u.replace(/\\\//g,'/');const key=String(q).toLowerCase()==='auto'?'auto':(q+'p');r.jsonEncodings.push({variable:varName,url,quality:key});if(!r.qualityMap[key])r.qualityMap[key]={url,source:'json-encoding',method:varName,domain:hostOf(url)}})}catch{}}
    // HLS fallback
    const hlsM=allJS.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);if(hlsM&&!r.qualityMap['HLS']&&!r.qualityMap['auto'])r.qualityMap['auto']={url:hlsM[1],source:'js-regex',method:'m3u8-pattern',domain:hostOf(hlsM[1])};
    // MP4 brute
    if(!Object.keys(r.qualityMap).length){const mp4R=/(https?:\/\/[^\s"']+\.mp4[^\s"']*)/g;let mm,c=0;while((mm=mp4R.exec(allJS))&&c<3){const u=mm[1];if(u.includes('preview')||u.includes('thumb'))continue;const qm2=u.match(/_(\d+)\.mp4/);const label=qm2?qm2[1]+'p':('src'+c);if(!r.qualityMap[label]){r.qualityMap[label]={url:u,source:'js-regex',method:'mp4-brute',domain:hostOf(u)};c++}}}
    // Video URL Templates
    for(const[q,info]of Object.entries(r.qualityMap)){try{const u=new URL(info.url);let tpl=u.pathname.replace(/\/\d{4,}\//g,'/{id}/').replace(/\/[a-f0-9]{16,}\//gi,'/{hash}/').replace(/_\d{3,4}\.mp4/,'_{quality}.mp4').replace(/\/\d+_/,'/{id}_');r.videoUrlTemplates.push({template:u.origin+tpl,example:info.url.substring(0,100),domain:info.domain,variables:tpl.match(/\{[^}]+\}/g)||[]})}catch{}}
    // Deduplicate templates
    const seen=new Set();r.videoUrlTemplates=r.videoUrlTemplates.filter(t=>{if(seen.has(t.template))return false;seen.add(t.template);return true});
    return r}

// ================================================================
// NEW: CDN WHITELIST
// ================================================================
function buildWhitelist(base,dom,player,cards){
    const domains=new Map();
    domains.set(hostOf(base),{domain:hostOf(base),role:'site',required:true});
    // From video sources
    for(const[q,info]of Object.entries(player?.qualityMap||{})){const d=info.domain;if(d&&!domains.has(d))domains.set(d,{domain:d,role:'video CDN ('+q+')',required:true})}
    // From player sources
    (player?.sources||[]).forEach(s=>{const d=hostOf(s.src);if(d&&!domains.has(d))domains.set(d,{domain:d,role:'video source',required:true})});
    // From thumbnails
    (cards?.sampleCards||[]).forEach(c=>{const d=hostOf(c.thumbnail||'');if(d&&d!==hostOf(base)&&!domains.has(d))domains.set(d,{domain:d,role:'thumbnail CDN',required:false})});
    // From external scripts
    (dom?.externalScripts||[]).forEach(s=>{const d=hostOf(s);if(d&&!domains.has(d))domains.set(d,{domain:d,role:'script',required:false})});
    const list=[...domains.values()];const required=list.filter(d=>d.required);
    const code='const ALLOWED_TARGETS = [\n'+required.map(d=>`  "${d.domain}",  // ${d.role}`).join('\n')+'\n];';
    return{domains:list,required,code}}

// ================================================================
// NEW: URL FORMAT DETECTION
// ================================================================
function detectUrlFormat(html,base){
    const r={videoUrls:'unknown',thumbnailUrls:'unknown',backslashEscaped:false,protocolRelative:false,rootRelative:false,placeholders:[],cleanUrlRules:[]};
    if(html.includes('\\/'))r.backslashEscaped=true;
    if(/src=["']\/\/[^"']+["']/.test(html))r.protocolRelative=true;
    if(/src=["']\/[^/"'][^"']*["']/.test(html))r.rootRelative=true;
    if(html.includes('/THUMBNUM/'))r.placeholders.push('THUMBNUM');
    if(html.includes('{quality}'))r.placeholders.push('{quality}');
    if(r.backslashEscaped)r.cleanUrlRules.push('unescape-backslash');
    if(r.protocolRelative)r.cleanUrlRules.push('add-protocol');
    if(r.rootRelative)r.cleanUrlRules.push('prepend-host');
    if(r.placeholders.length)r.cleanUrlRules.push('replace-placeholders');
    return r}

// ================================================================
// NEW: PARSER FLOW
// ================================================================
function buildParserFlow(base,nav,cards,player,prot){
    const flow={catalog:{url:base,paginationPattern:nav?.urlScheme?.pagination?.pattern||'?page={N}',cardSelector:cards?.cardSelector,cardCount:cards?.totalCardsFound||0},card:{},videoPage:{extractionStrategies:[]}};
    if(cards?.structure){const s=cards.structure;flow.card={linkSelector:s.link.css,linkPattern:s.link.pattern,titleSelector:s.title.css,thumbSelector:s.thumbnail.css,thumbAttribute:s.thumbnail.attribute,durationSelector:s.duration.css}}
    // Strategies ordered by priority
    if(player?.sources?.length)flow.videoPage.extractionStrategies.push({priority:3,method:'source-tags',count:player.sources.filter(s=>!s.skip).length,hint:'<source src="..." size/label/res="...">'});
    if(player?.jsConfigs?.length)player.jsConfigs.forEach(c=>flow.videoPage.extractionStrategies.push({priority:2,method:'js-config-'+c.type,hint:c.extractionHint}));
    if(player?.jsonEncodings?.length)flow.videoPage.extractionStrategies.push({priority:2,method:'json-encodings',variables:uniq(player.jsonEncodings.map(e=>e.variable)),hint:'JSON array with filename/quality'});
    if(Object.values(player?.qualityMap||{}).some(v=>v.source==='og:video'))flow.videoPage.extractionStrategies.push({priority:2,method:'og-video-meta',hint:'<meta property="og:video" content="...mp4">'});
    if(Object.values(player?.qualityMap||{}).some(v=>v.method==='m3u8-pattern'))flow.videoPage.extractionStrategies.push({priority:1,method:'hls-regex',hint:'"https://...m3u8"'});
    if(Object.values(player?.qualityMap||{}).some(v=>v.method==='mp4-brute'))flow.videoPage.extractionStrategies.push({priority:0,method:'mp4-brute-regex',hint:'https://...mp4 in JS'});
    flow.videoPage.extractionStrategies.sort((a,b)=>b.priority-a.priority);
    // Required headers
    flow.requiredHeaders=prot?.requiredHeaders||{};
    return flow}

// ================================================================
// COMPATIBILITY
// ================================================================
function assessCompat(jsd,prot,vc,player){
    const items=[];
    items.push({key:'ssr',icon:jsd==='no'?'✅':jsd==='partial'?'⚠️':'❌',label:'HTML без JS (SSR)',status:jsd==='no'?'ok':jsd==='partial'?'warn':'fail',hint:jsd==='no'?'Контент в HTML':'JS нужен'});
    const hasToken=Object.values(player?.qualityMap||{}).some(v=>(v.url||'').includes('token'));
    items.push({key:'urlStable',icon:hasToken?'⚠️':Object.keys(player?.qualityMap||{}).length?'✅':'❌',label:'URL видео стабилен',status:hasToken?'warn':Object.keys(player?.qualityMap||{}).length?'ok':'fail',hint:hasToken?'Токенизирован':'Прямые ссылки'});
    items.push({key:'poster',icon:vc?.found?'✅':'❌',label:'Постеры',status:vc?.found?'ok':'fail',hint:vc?.found?vc.totalCardsFound+' шт':'Нет'});
    const hasDirect=player?.sources?.some(s=>!s.skip);
    items.push({key:'directVideo',icon:hasDirect?'✅':Object.keys(player?.qualityMap||{}).length?'⚠️':'❌',label:'Видео прямой ссылкой',status:hasDirect?'ok':Object.keys(player?.qualityMap||{}).length?'warn':'fail',hint:hasDirect?'<source> теги':'Через JS'});
    if(prot.cloudflare)items.push({key:'cf',icon:prot.cloudflareTurnstile?'❌':'⚠️',label:prot.cloudflareTurnstile?'CF Turnstile':'CF Basic',status:prot.cloudflareTurnstile?'fail':'warn',hint:prot.cloudflareTurnstile?'Headless нужен':'Worker обходит'});
    if(prot.drm)items.push({key:'drm',icon:'❌',label:'DRM: '+prot.drmDetails.join(','),status:'fail',hint:'Прямое скачивание невозможно'});
    if(prot.authRequired)items.push({key:'auth',icon:'❌',label:'Авторизация',status:'fail',hint:'Форма логина найдена'});
    if(prot.ageGate?.detected)items.push({key:'age',icon:prot.ageGate.impact==='none'?'✅':'⚠️',label:'Age Gate ('+prot.ageGate.type+')',status:prot.ageGate.impact==='none'?'ok':'warn',hint:prot.ageGate.note||''});
    return items}

// ================================================================
// JS DEPENDENCY
// ================================================================
function aJSD(doc,html,cardsFound,fw){let jsReq='no';const ev=[];const root=doc.querySelector('#app,#root,#__next');if(root&&root.children.length<=3){ev.push('SPA');jsReq='yes'}const dt=doc.querySelectorAll('*').length;if(dt<80){ev.push('Small DOM');jsReq='yes'}if(cardsFound){ev.push('Cards HTML');jsReq='no'}if(fw.some(f=>['JW Player','Video.js','HLS.js'].includes(f))){ev.push('JS player');if(jsReq==='no')jsReq='partial'}return jsReq}

// ================================================================
// DIRECT TEST
// ================================================================
async function runDirectTest(){const ui=$('targetUrl'),url=ui?.value.trim();if(!url){setStatus('❌ URL!','error');return}const base=baseOf(url);const btn=$('btnAnalyze');if(btn){btn.disabled=true;btn.textContent='🧪'}const checks=[];setStatus('🧪 Тест...','loading');setProgress(10,'Direct...');
    let html=null;try{const ac=new AbortController;const t=setTimeout(()=>ac.abort(),12000);const r=await fetch(url,{signal:ac.signal});clearTimeout(t);if(r.ok){html=await r.text();checks.push({icon:'✅',label:'Прямой запрос',status:'ok',hint:`HTTP ${r.status}, ${(html.length/1024).toFixed(0)}KB`})}else checks.push({icon:'❌',label:'Прямой запрос',status:'fail',hint:`HTTP ${r.status}`})}catch(e){checks.push({icon:'❌',label:'Прямой запрос',status:'fail',hint:isCE(e)?'CORS':e.message})}
    if(html){const doc=parseH(html);const dt=doc.querySelectorAll('*').length;checks.push({icon:dt>100?'✅':'❌',label:'SSR',status:dt>100?'ok':'fail',hint:`DOM ${dt}`});
    const lc=html.toLowerCase();if(lc.includes('challenges.cloudflare.com'))checks.push({icon:lc.includes('turnstile')?'❌':'⚠️',label:'Cloudflare',status:lc.includes('turnstile')?'fail':'warn',hint:lc.includes('turnstile')?'Turnstile':'Basic'})}
    const ok=checks.filter(c=>c.status==='ok').length,fail=checks.filter(c=>c.status==='fail').length;
    const verdict=fail===0?{v:'ok',l:'✅ Совместим'}:ok>fail?{v:'partial',l:'⚠️ Частично'}:{v:'fail',l:'❌ Несовместим'};
    analysisResult={_meta:{url,mode:'direct-test',tool:'v4.0.0'},directTest:{checks,verdict:verdict.v,verdictLabel:verdict.l}};
    let h=`<div class="dt-block${verdict.v==='fail'?' fail':''}"><h3${verdict.v==='fail'?' class="fail-title"':''}>🧪 ${esc(url)}</h3><div class="dt-grid">`;
    checks.forEach(c=>{h+=`<div class="dt-item"><span class="dt-icon">${c.icon}</span><div class="dt-text"><strong>${esc(c.label)}</strong><span class="dt-hint">${esc(c.hint)}</span></div></div>`});
    h+=`</div><div class="dt-summary"><div class="verdict ${verdict.v}">${esc(verdict.l)}</div></div></div>`;
    $('results').style.display='block';$('archReport').innerHTML=h;$('jsonFormatted').innerHTML=synHL(JSON.stringify(analysisResult,null,2));$('jsonRaw').value=JSON.stringify(analysisResult,null,2);$('btnCopyJson').disabled=false;showTab('arch');setProgress(100,'✅');setStatus('🧪 Done','success');if(btn){btn.disabled=false;btn.textContent='🚀 Полный анализ'}}

// ================================================================
// MAIN ANALYSIS
// ================================================================
async function runFullAnalysis(){
    const mode=($('proxySelect')||{}).value;if(mode==='direct-test')return runDirectTest();
    const ui=$('targetUrl'),targetUrl=ui?.value.trim();if(!targetUrl){setStatus('❌ URL!','error');return}try{new URL(targetUrl)}catch{setStatus('❌ Bad URL','error');return}
    const base=baseOf(targetUrl),w=getW();const btn=$('btnAnalyze');if(btn){btn.disabled=true;btn.textContent='⏳'}
    $('results').style.display='none';updCI('hidden');updW(!!w);transportLog=[];
    analysisResult={_meta:{analyzedUrl:targetUrl,baseUrl:base,analyzedAt:new Date().toISOString(),testWord:getTestWord(),tool:'v4.0.0'}};
    try{
        setStatus('📥','loading');setProgress(10,'📡');
        let html;try{html=await fetchPage(targetUrl)}catch(e){setProgress(10,'❌','cors-error');setStatus('❌ '+e.message,'error');analysisResult._error={type:isCE(e)?'CORS':'FETCH',message:e.message};displayResults(analysisResult);return}
        const doc=parseH(html);setProgress(20,'DOM');
        const dom=aDom(doc);
        setProgress(25,'FW');const fw=aFW(doc,html);
        setProgress(30,'Prot');const prot=aProt(doc,html);
        setProgress(35,'Enc');analysisResult.encoding=aEnc(doc);
        setProgress(40,'Nav');analysisResult.navigation=parseJsNav(doc,html,base);
        setProgress(50,'Cards');analysisResult.videoCards=aCards(doc,base);
        setProgress(58,'JSD');const jsReq=aJSD(doc,html,analysisResult.videoCards.found,fw);

        // Video page analysis
        setProgress(65,'Video page...');
        const svUrl=analysisResult.videoCards.sampleCards?.[0]?.link;
        let vpHtml=null,vpDoc=null;
        if(svUrl){try{vpHtml=await fetchPage(svUrl);vpDoc=parseH(vpHtml)}catch(e){logT('VideoPage: '+e.message,'fail')}}

        setProgress(75,'Player');
        analysisResult.playerStructure=vpDoc?analyzePlayer(vpDoc,base):{qualityMap:{},sources:[],jsConfigs:[],jsonEncodings:[],videoUrlTemplates:[]};

        setProgress(80,'Whitelist');
        analysisResult.workerWhitelist=buildWhitelist(base,dom,analysisResult.playerStructure,analysisResult.videoCards);

        setProgress(83,'URL format');
        analysisResult.urlFormat=detectUrlFormat(html+(vpHtml||''),base);

        setProgress(86,'Compat');
        analysisResult.compatibility=assessCompat(jsReq,prot,analysisResult.videoCards,analysisResult.playerStructure);

        setProgress(90,'Flow');
        analysisResult.parserFlow=buildParserFlow(base,analysisResult.navigation,analysisResult.videoCards,analysisResult.playerStructure,prot);

        setProgress(94,'Synth');
        analysisResult.architecture={siteType:jsReq==='yes'?'C':analysisResult.videoCards.found?'A':'B',jsRequired:jsReq,frameworks:fw,protection:prot,domInfo:dom,recommendation:{method:jsReq==='yes'?'Headless':'CSS+XPath',tools:jsReq==='yes'?'Puppeteer':'Cheerio/BS4',transport:prot.cloudflare?'Worker':'Прокси/прямой'}};

        analysisResult._summary={jsRequired:jsReq,encoding:analysisResult.encoding.charset,videoCardsFound:analysisResult.videoCards.totalCardsFound,qualitiesFound:Object.keys(analysisResult.playerStructure.qualityMap).length,categoriesCount:analysisResult.navigation.categories.totalCount,whitelistDomains:analysisResult.workerWhitelist.required.length,extractionStrategies:analysisResult.parserFlow.videoPage.extractionStrategies.length,frameworks:fw,protection:{cloudflare:prot.cloudflare,drm:prot.drm,ageGate:prot.ageGate?.type||null}};

        analysisResult._transportLog=transportLog;
        displayResults(analysisResult);setProgress(100,'✅');setStatus('✅ Готово!','success');
    }catch(e){setStatus('❌ '+e.message,'error');analysisResult._transportLog=transportLog;displayResults(analysisResult)}
    finally{if(btn){btn.disabled=false;btn.textContent='🚀 Полный анализ'}}}

// ================================================================
// DISPLAY
// ================================================================
function displayResults(d){$('results').style.display='block';const j=JSON.stringify(d,null,2);$('jsonFormatted').innerHTML=synHL(j);$('jsonRaw').value=j;$('archReport').innerHTML=genArch(d);$('btnCopyJson').disabled=false;$('btnCopyArch').disabled=false;$('btnCopyWhitelist').disabled=false}

function genArch(d){
    if(!d.architecture&&!d.directTest)return'<p style="color:#555">Нет данных</p>';
    if(d.directTest)return'';// direct test renders itself
    const a=d.architecture;let h='';

    // Compatibility
    if(d.compatibility?.length){h+='<div class="compat-block"><h3>🧪 Совместимость</h3><div class="compat-grid">';d.compatibility.forEach(c=>{h+=`<div class="compat-item"><span class="compat-icon">${c.icon}</span><div class="compat-text"><strong>${esc(c.label)}</strong><span class="hint">${esc(c.hint)}</span></div></div>`});h+='</div></div>'}

    // Worker Whitelist
    if(d.workerWhitelist?.required?.length){h+='<div class="wl-block"><h3>📡 Worker Whitelist (ALLOWED_TARGETS)</h3>';d.workerWhitelist.required.forEach(dm=>{h+=`<div class="wl-domain"><code>${esc(dm.domain)}</code><span class="role">${esc(dm.role)}</span></div>`});h+=`<div class="wl-code" onclick="copyWhitelist()" title="Клик = копировать">${esc(d.workerWhitelist.code)}</div></div>`}

    // Quality Map
    if(d.playerStructure&&Object.keys(d.playerStructure.qualityMap).length){h+='<div class="ab"><h3 class="gt">🎬 Quality Map</h3><table class="qm-table"><tr><th>Quality</th><th>URL</th><th>Source</th><th>Method</th><th>Domain</th></tr>';
        for(const[q,info]of Object.entries(d.playerStructure.qualityMap)){h+=`<tr><td><strong>${esc(q)}</strong></td><td><code>${esc((info.url||'').substring(0,80))}</code></td><td>${esc(info.source)}</td><td>${esc(info.method)}</td><td><code>${esc(info.domain)}</code></td></tr>`}
        h+='</table></div>'}

    // Parser Flow
    if(d.parserFlow){const pf=d.parserFlow;h+='<div class="ab"><h3 class="wt">🔗 Parser Flow</h3><div class="pf-chain">';
        h+=`<div class="pf-step"><strong>📄 Каталог</strong><code>${esc(pf.catalog?.cardSelector||'?')}</code><br>${pf.catalog?.cardCount||0} cards</div><span class="pf-arrow">→</span>`;
        h+=`<div class="pf-step"><strong>🔗 Карточка</strong><code>${esc(pf.card?.linkSelector||'?')}</code><br>Pattern: <code>${esc(pf.card?.linkPattern||'?')}</code></div><span class="pf-arrow">→</span>`;
        h+=`<div class="pf-step"><strong>▶️ Видео</strong>`;
        (pf.videoPage?.extractionStrategies||[]).forEach(s=>{h+=`<br>${'⭐'.repeat(s.priority)||'☆'} <code>${esc(s.method)}</code>`});
        h+='</div></div>';
        // Required headers
        if(pf.requiredHeaders&&Object.keys(pf.requiredHeaders).length){h+='<table class="st"><tr><th>Header</th><th>Value</th></tr>';for(const[k,v]of Object.entries(pf.requiredHeaders)){h+=`<tr><td><strong>${esc(k)}</strong></td><td><code>${esc(v)}</code></td></tr>`}h+='</table>'}
        h+='</div>'}

    // Video URL Templates
    if(d.playerStructure?.videoUrlTemplates?.length){h+='<div class="ab"><h3>📐 Video URL Templates</h3><table class="st"><tr><th>Template</th><th>Domain</th><th>Variables</th></tr>';
        d.playerStructure.videoUrlTemplates.forEach(t=>{h+=`<tr><td><code>${esc(t.template)}</code></td><td><code>${esc(t.domain)}</code></td><td>${(t.variables||[]).map(v=>`<span class="tag">${esc(v)}</span>`).join('')}</td></tr>`});h+='</table></div>'}

    // JS Player Configs
    if(d.playerStructure?.jsConfigs?.length){h+='<div class="ab"><h3>🎮 JS Player Config</h3>';d.playerStructure.jsConfigs.forEach(c=>{h+=`<div style="margin-bottom:8px"><strong style="color:#00d4ff">${esc(c.type)}</strong><br>`;c.fields.forEach(f=>{h+=`<code style="color:#ffaa44;font-size:10px">${esc(f.quality)}</code>: <code style="color:#00ff88;font-size:10px">${esc((f.value||'').substring(0,70))}</code><br>`});h+=`Regex: <code style="color:#888;font-size:10px">${esc(c.extractionHint)}</code></div>`});h+='</div>'}

    // Age Gate
    if(a.protection?.ageGate?.detected){const ag=a.protection.ageGate;h+=`<div class="age-g"><h4>🔞 Age Gate <span class="gt-badge ${ag.type}">${esc(ag.type)}</span></h4><p>${esc(ag.note)}</p>${ag.cookieName?`<div class="age-detail">Cookie: <code>${esc(ag.cookieName)}=${esc(ag.cookieValue||'1')}</code></div>`:''}</div>`}

    // URL Scheme
    const nav=d.navigation;if(nav){h+='<div class="url-scheme"><h3>🗺️ URL-схема</h3>';
        if(nav.search.exampleUrls?.length){h+=`<div class="us-section"><h4>🔍 Поиск («${esc(d._meta.testWord)}»)</h4><table class="us-table"><tr><th>Вариант</th><th>URL</th></tr>`;nav.search.exampleUrls.forEach(u=>{h+=`<tr><td>${esc(u.label)}</td><td><code>${esc(u.url)}</code></td></tr>`});h+='</table></div>'}
        if(nav.categories.merged.length){h+=`<div class="us-section"><h4>📁 Категории (${nav.categories.merged.length})</h4><div class="us-cat-grid">`;nav.categories.merged.forEach(c=>{h+=`<div class="us-cat-item"><span class="cat-name">${esc(c.name)}</span><span class="cat-slug">${esc(c.slug)}</span></div>`});h+='</div></div>'}
        h+='</div>'}

    // Selectors
    if(d.videoCards?.found){h+=`<div class="ab"><h3>🎯 Селекторы (${d.videoCards.totalCardsFound})</h3><table class="st"><tr><th>Поле</th><th>CSS</th><th>XPath</th><th>Пример</th></tr>`;
        const s=d.videoCards.structure;
        h+=`<tr><td><strong>📦 Card</strong></td><td><code>${esc(d.videoCards.cardSelector)}</code></td><td><code>${esc(d.videoCards.cardXPath||'')}</code></td><td>${d.videoCards.totalCardsFound}</td></tr>`;
        for(const[nm,f]of Object.entries(s)){if(!f.css)continue;h+=`<tr><td><strong>${esc(nm)}</strong></td><td><code>${esc(f.css)}</code></td><td><code>${esc(f.xpath||'')}</code></td><td style="font-size:10px;color:#888">${esc((f.example||'').substring(0,40))}</td></tr>`}
        h+='</table></div>'}

    // URL Format
    if(d.urlFormat?.cleanUrlRules?.length){h+='<div class="ab"><h3>🔧 URL Format / cleanUrl</h3><div class="acg">';
        d.urlFormat.cleanUrlRules.forEach(r=>{h+=`<div class="aci"><span class="aci-i">🔧</span><span class="aci-l">${esc(r)}</span></div>`});
        if(d.urlFormat.placeholders.length)d.urlFormat.placeholders.forEach(p=>{h+=`<div class="aci"><span class="aci-i">📌</span><span class="aci-l">Placeholder: ${esc(p)}</span></div>`});
        h+='</div></div>'}

    // Checklist
    const sm=d._summary||{};const checks=[
        {i:'📄',l:'Карточки',v:sm.videoCardsFound||0,c:sm.videoCardsFound?'ok':'fail'},
        {i:'🎬',l:'Качества',v:sm.qualitiesFound||0,c:sm.qualitiesFound?'ok':'fail'},
        {i:'📁',l:'Категории',v:sm.categoriesCount||0,c:sm.categoriesCount?'ok':'fail'},
        {i:'📡',l:'Whitelist',v:sm.whitelistDomains||0,c:sm.whitelistDomains?'ok':'n'},
        {i:'🔧',l:'Стратегии',v:sm.extractionStrategies||0,c:sm.extractionStrategies?'ok':'fail'},
        {i:'🛡️',l:'CF',v:a.protection?.cloudflare?'⚠️':'—',c:a.protection?.cloudflare?'warn':'n'},
        {i:'🔒',l:'DRM',v:a.protection?.drm?'❌':'—',c:a.protection?.drm?'fail':'n'},
    ];h+='<div class="ab"><h3>✅ Чеклист</h3><div class="acg">';checks.forEach(c=>{h+=`<div class="aci"><span class="aci-i">${c.i}</span><span class="aci-l">${esc(c.l)}</span><span class="aci-v ${c.c}">${c.v}</span></div>`});h+='</div></div>';

    // Transport
    if(d._transportLog?.length){h+='<div class="ab"><h3>🔌 Transport</h3><div class="transport-log">';d._transportLog.forEach(e=>{h+=`<div class="tle ${e.type}">[${e.time}] ${esc(e.message)}</div>`});h+='</div></div>'}
    return h}

// ================================================================
// UI
// ================================================================
function synHL(j){return j.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,m=>{let c='color:#ae81ff';if(/^"/.test(m))c=/:$/.test(m)?'color:#a6e22e':'color:#e6db74';else if(/true|false/.test(m))c='color:#66d9ef';else if(/null/.test(m))c='color:#f92672';return`<span style="${c}">${m}</span>`})}
function showTab(n){document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));const t=$('tab-'+n);if(t)t.classList.add('active');event?.target?.classList.add('active')}
function clip(t){navigator.clipboard.writeText(t).then(()=>setStatus('📋 OK','success')).catch(()=>{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');document.body.removeChild(a);setStatus('📋 OK','success')})}
function copyResults(){if(analysisResult)clip(JSON.stringify(analysisResult,null,2))}
function copyWhitelist(){if(analysisResult?.workerWhitelist?.code)clip(analysisResult.workerWhitelist.code);else setStatus('Нет данных','error')}
function copyArchitecture(){if(!analysisResult)return;const r=analysisResult;
    clip(JSON.stringify({urlScheme:r.navigation?.urlScheme,categories:r.navigation?.categories?.merged,sorting:r.navigation?.sorting?.fromJs,search:r.navigation?.search,selectors:r.videoCards?.found?r.videoCards.structure:null,cardSelector:r.videoCards?.cardSelector,playerStructure:r.playerStructure,qualityMap:r.playerStructure?.qualityMap,workerWhitelist:r.workerWhitelist,parserFlow:r.parserFlow,urlFormat:r.urlFormat,compatibility:r.compatibility,requiredHeaders:r.architecture?.protection?.requiredHeaders,ageGate:r.architecture?.protection?.ageGate},null,2));
    setStatus('🏗️ Архитектура!','success')}

document.addEventListener('DOMContentLoaded',()=>{
    const ui=$('targetUrl');if(ui)ui.addEventListener('keypress',e=>{if(e.key==='Enter')runFullAnalysis()});
    const ps=$('proxySelect');if(ps)ps.addEventListener('change',()=>{const h=$('proxyHint');if(h){const hints={'auto':'Прямой→Worker→прокси','':'Прямой','direct-test':'🧪 Тест: CORS, SSR, защита'};h.textContent=hints[ps.value]||''}});
    const wi=$('workerUrl');if(wi){const sv=localStorage.getItem('aWU');if(sv)wi.value=sv;else if(!wi.value)wi.value=DEFAULT_WORKER_URL;updW(!!wi.value.trim());wi.addEventListener('input',()=>updW(!!wi.value.trim()));wi.addEventListener('change',()=>{const v=wi.value.trim();if(v)localStorage.setItem('aWU',v);else localStorage.removeItem('aWU')})}
});
