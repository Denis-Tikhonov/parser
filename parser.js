// ================================================================
// SITE STRUCTURE ANALYZER v4.1.0
// Merge catalog+video, Quality Map, CDN Whitelist, Parser Flow,
// Channels, External JS, parserConfig, URL Templates, Referer,
// Required Headers, JSON Encodings, URL Format, cleanUrlRules
// ================================================================
const DEFAULT_WORKER_URL="https://zonaproxy.777b737.workers.dev";
let analysisResult=null,catalogData=null,videoPageData=null,transportLog=[];
const logT=(m,t='info')=>transportLog.push({time:new Date().toLocaleTimeString(),message:m,type:t});
const $=id=>document.getElementById(id);const setStatus=(m,t='loading')=>{const e=$('status');if(e){e.textContent=m;e.className='status '+t}};
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
function updMerge(){const el=$('mergeIndicator');if(!el)return;if(catalogData&&videoPageData){el.textContent='📦 Каталог + 🎬 Видео → полный parserConfig';el.className='merge-indicator has-both';el.style.display='block'}else if(catalogData){el.textContent='📦 Каталог ✓ → для VIDEO_RULES включите 🎬 Видео';el.className='merge-indicator has-catalog';el.style.display='block'}else el.style.display='none'}
function genXP(el){if(!el||el.nodeType!==1)return'';if(el.id)return`//*[@id="${el.id}"]`;const p=[];let c=el;while(c&&c.nodeType===1){let t=c.tagName.toLowerCase();if(c.className&&typeof c.className==='string'){const cl=c.className.trim().split(/\s+/)[0];if(cl&&cl.length>2){p.unshift(`//${t}[contains(@class,"${cl}")]`);break}}let i=1,s=c.previousElementSibling;while(s){if(s.tagName===c.tagName)i++;s=s.previousElementSibling}p.unshift(`/${t}[${i}]`);c=c.parentElement}return p.join('')}
function sXP(el){if(!el||el.nodeType!==1)return'';const t=el.tagName.toLowerCase();if(el.id)return`//*[@id="${el.id}"]`;if(el.className&&typeof el.className==='string'){const c=el.className.trim().split(/\s+/)[0];if(c)return`//${t}[contains(@class,"${c}")]`}return`//${t}`}

// ---- Transport ----
const getW=()=>{const i=$('workerUrl');return i?i.value.trim().replace(/\/$/,''):''};
const updW=h=>{const b=$('workerStatusBadge');if(b){b.textContent=h?'✦':'○';b.className='worker-badge '+(h?'active':'inactive')}};
function updCI(s,d){const el=$('corsIndicator');if(!el)return;const m={'trying-direct':['🔗','trying'],'direct-ok':['✅','direct-ok'],'trying-worker':['⚡','trying'],'worker-ok':['✅W','worker-ok'],'cors-detected':['🛡️CORS','cors-blocked'],'trying-proxy':['🔄'+(d||''),'cors-blocked'],'proxy-ok':['✅'+(d||''),'proxy-ok'],'all-failed':['❌','all-failed'],hidden:['','']};const v=m[s]||m.hidden;el.textContent=v[0];el.className='cors-indicator '+v[1];el.style.display=s==='hidden'?'none':'block'}
const proxies=()=>[{n:'allorigins',u:'https://api.allorigins.win/raw?url='},{n:'corsproxy',u:'https://corsproxy.io/?'},{n:'codetabs',u:'https://api.codetabs.com/v1/proxy?quest='}];
const isCE=e=>{if(!e)return false;const m=(e.message||'').toLowerCase();return m.includes('failed to fetch')||m.includes('networkerror')||m.includes('load failed')||e.name==='TypeError'};
async function fD(url){const a=new AbortController,t=setTimeout(()=>a.abort(),10000);try{const r=await fetch(url,{signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('HTTP '+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}
async function fW(url){const w=getW();if(!w)throw new Error('No W');const a=new AbortController,t=setTimeout(()=>a.abort(),15000);try{const r=await fetch(w+'/?url='+encodeURIComponent(url)+'&ua='+encodeURIComponent(getUA()),{signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('W'+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}
async function fP(url,pfx){const a=new AbortController,t=setTimeout(()=>a.abort(),15000);try{const r=await fetch(pfx+encodeURIComponent(url),{signal:a.signal});clearTimeout(t);if(!r.ok)throw new Error('HTTP '+r.status);const h=await r.text();if(h.length<50)throw new Error('Empty');return h}catch(e){clearTimeout(t);throw e}}
async function fetchPage(url){const mode=($('proxySelect')||{}).value||'auto',w=getW();if(mode===''||mode==='direct-test'){return fD(url)}if(mode==='auto'){try{logT('Direct');updCI('trying-direct');const h=await fD(url);logT('✅','success');updCI('direct-ok');return h}catch(e){logT(isCE(e)?'CORS':e.message,'warning')}if(w){try{logT('Worker');updCI('trying-worker');const h=await fW(url);logT('✅W','success');updCI('worker-ok');return h}catch(e){logT('W:'+e.message,'fail')}}updCI('cors-detected');const px=proxies();for(let i=0;i<px.length;i++){try{logT(px[i].n);updCI('trying-proxy',px[i].n);const h=await fP(url,px[i].u);logT('✅'+px[i].n,'success');updCI('proxy-ok',px[i].n);return h}catch(e){logT('❌'+px[i].n,'fail')}}updCI('all-failed');throw new Error('All blocked')}if(w){try{return await fW(url)}catch(e){logT('W:'+e.message,'warning')}}return fP(url,mode)}
const parseH=h=>new DOMParser().parseFromString(h,'text/html');

// ================================================================
// ANALYZERS
// ================================================================
function aDom(doc){return{totalElements:doc.querySelectorAll('*').length,scripts:doc.querySelectorAll('script').length,images:doc.querySelectorAll('img').length,links:doc.querySelectorAll('a[href]').length,externalScripts:Array.from(doc.querySelectorAll('script[src]')).map(s=>s.getAttribute('src')).filter(Boolean)}}
function aFW(doc,html){const f=[],src=html+Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n');[['React',['data-reactroot','ReactDOM']],['Next.js',['__NEXT_DATA__']],['Vue.js',['__vue__','data-v-']],['jQuery',['jquery','jQuery']],['Cloudflare',['challenges.cloudflare.com']],['DDoS-Guard',['ddos-guard']],['JW Player',['jwplayer']],['Video.js',['videojs']],['HLS.js',['hls.js','Hls.']]].forEach(([n,ps])=>{for(const p of ps)if(src.includes(p)){f.push(n);break}});return uniq(f)}
function aEnc(doc){const mc=doc.querySelector('meta[charset]');return{charset:mc?mc.getAttribute('charset').toUpperCase():'N/A'}}
function aProt(doc,html,base){const r={cloudflare:false,cloudflareTurnstile:false,ddosGuard:false,recaptcha:false,drm:false,drmDetails:[],authRequired:false,refererProtected:false,ageGate:null,cookies:[],requiredHeaders:{}};const lc=html.toLowerCase(),src=Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n'),cb=lc+src.toLowerCase();
if(lc.includes('challenges.cloudflare.com')){r.cloudflare=true;r.cloudflareTurnstile=cb.includes('turnstile')||cb.includes('cf-turnstile')}
if(lc.includes('ddos-guard'))r.ddosGuard=true;
if(cb.includes('recaptcha')||cb.includes('hcaptcha'))r.recaptcha=true;
[{n:'Widevine',p:['widevine']},{n:'PlayReady',p:['playready']},{n:'FairPlay',p:['fairplay']},{n:'EME',p:['requestmedialkeysystemaccess','encrypted-media']}].forEach(d=>{d.p.forEach(p=>{if(cb.includes(p)){r.drm=true;r.drmDetails.push(d.n)}})});r.drmDetails=uniq(r.drmDetails);
if(doc.querySelectorAll('form[action*="login"],form[action*="signin"],form[action*="auth"]').length)r.authRequired=true;
if(cb.includes('referer')||cb.includes('document.referrer'))r.refererProtected=true;
const cp=/(?:document\.cookie\s*=\s*['"`])([^'"`=;]+)/gi;let cm;while((cm=cp.exec(src)))r.cookies.push(cm[1]);r.cookies=uniq(r.cookies).slice(0,10);
const ageCN=['age_verified','disclaimer','over18','agegate','is_adult','mature','age_confirm'];let ageType=null,ageDet={};
for(const form of doc.querySelectorAll('form')){const act=(form.getAttribute('action')||'').toLowerCase(),meth=(form.getAttribute('method')||'').toUpperCase();if((act.includes('age')||act.includes('verify')||act.includes('disclaimer'))&&meth==='POST'){ageType='post-form';ageDet={action:form.getAttribute('action'),method:'POST',note:'POST-подтверждение'};break}}
if(!ageType)for(const cn of ageCN){if(cb.includes(cn)){ageType='cookie-flag';const vm=cb.match(new RegExp(cn+'\\s*[=:]\\s*["\']?([^"\'\\s;,}{]+)','i'));ageDet={cookieName:cn,cookieValue:vm?vm[1]:'1',note:`Cookie: ${cn}=${vm?vm[1]:'1'}`};break}}
if(!ageType){for(const s of['#age-verify','#age-gate','.age-verify','.age-gate'])try{if(doc.querySelector(s)){ageType='js-overlay';ageDet={selector:s,note:'CSS/JS-оверлей'};break}}catch{}}
if(!ageType&&/(?:мне\s*(?:уже\s*)?18|i\s*am\s*(?:over\s*)?18|18\+)/i.test(doc.body?.textContent||'')){ageType='js-overlay';ageDet={note:'Текст 18+'}}
if(ageType)r.ageGate={detected:true,type:ageType,impact:ageType==='js-overlay'?'none':ageType==='cookie-flag'?'low':'medium',...ageDet};
r.requiredHeaders={};if(r.ageGate?.cookieName)r.requiredHeaders.Cookie=r.ageGate.cookieName+'='+(r.ageGate.cookieValue||'1');if(r.refererProtected)r.requiredHeaders.Referer=(base||'')+'/';r.requiredHeaders['User-Agent']=getUA();
return r}
function aJSD(doc,html,cf,fw){let jsReq='no';const root=doc.querySelector('#app,#root,#__next');if(root&&root.children.length<=3)jsReq='yes';const dt=doc.querySelectorAll('*').length;if(dt<80)jsReq='yes';if(cf)jsReq='no';if(fw.some(f=>['JW Player','Video.js','HLS.js'].includes(f))&&jsReq==='no')jsReq='partial';return jsReq}
function parseJsNav(doc,html,base){const all=Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n'),cb=all+'\n'+html;const r={categories:{fromJs:[],fromHtml:[],merged:[]},channels:{fromJs:[],fromHtml:[],merged:[],urlPattern:null},sorting:{fromJs:[]},search:{paramNames:[],testWord:getTestWord(),exampleUrls:[]},urlScheme:{}};const tw=getTestWord();
const jC=new Map();for(const pat of[/new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*[?&]c=([A-Za-z0-9_-]+(?:-\d+)?)/g,/new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*"[&?]c=([A-Za-z0-9_-]+(?:-\d+)?)"/g]){let m;while((m=pat.exec(cb))!==null){const n=m[1].trim(),s=m[2];if(n&&s&&!jC.has(s))jC.set(s,{name:n,slug:s,url:base+'/?c='+s})}pat.lastIndex=0}
let cm;const cP=/[?&]c=([A-Za-z0-9_-]+(?:-\d+)?)/g;while((cm=cP.exec(cb))!==null){const s=cm[1];if(!jC.has(s)&&s.length>1)jC.set(s,{name:s.replace(/[-_]/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),slug:s,url:base+'/?c='+s})}
r.categories.fromJs=[...jC.values()];
for(const sel of['a[href*="/c/"]','a[href*="?c="]','a[href*="/categories/"]'])try{const lnk=doc.querySelectorAll(sel);if(lnk.length>=3){lnk.forEach(a=>{const href=a.getAttribute('href'),nm=a.textContent.trim();if(href&&nm){let sl='';const cM=href.match(/[?&]c=([^&]+)/),pM=href.match(/\/c\/([^/?]+)/);sl=cM?cM[1]:pM?pM[1]:href.split('/').filter(Boolean).pop()||'';r.categories.fromHtml.push({name:nm,slug:sl,url:resolve(href,base)})}});break}}catch{}
const mm=new Map();r.categories.fromJs.forEach(c=>mm.set(c.slug,c));r.categories.fromHtml.forEach(c=>{if(!mm.has(c.slug))mm.set(c.slug,c)});r.categories.merged=[...mm.values()];r.categories.totalCount=r.categories.merged.length;r.categories.source=r.categories.fromJs.length>r.categories.fromHtml.length?'JavaScript':'HTML';
// Channels
const chM=new Map();[/new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*\/channels?\/([A-Za-z0-9_-]+)/g,/new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*\/pornstars?\/([A-Za-z0-9_-]+)/g,/new\s+\w+\s*\(\s*"([^"]+)"\s*,\s*[^)]*[?&]channel=([A-Za-z0-9_-]+)/g].forEach(pat=>{let m;while((m=pat.exec(cb))!==null){const n=m[1].trim(),s=m[2];if(n&&s&&!chM.has(s))chM.set(s,{name:n,slug:s})}pat.lastIndex=0});
r.channels.fromJs=[...chM.values()];
for(const sel of['a[href*="/channels/"]','a[href*="/channel/"]','a[href*="/pornstar"]'])try{const lnk=doc.querySelectorAll(sel);if(lnk.length>=2){lnk.forEach(a=>{const href=a.getAttribute('href'),nm=a.textContent.trim();if(href&&nm){const sl=href.split('/').filter(Boolean).pop()||'';if(!chM.has(sl))r.channels.fromHtml.push({name:nm,slug:sl,url:resolve(href,base)})}});break}}catch{}
const chMerge=new Map();r.channels.fromJs.forEach(c=>chMerge.set(c.slug,c));r.channels.fromHtml.forEach(c=>{if(!chMerge.has(c.slug))chMerge.set(c.slug,c)});r.channels.merged=[...chMerge.values()];r.channels.totalCount=r.channels.merged.length;
const chLink=doc.querySelector('a[href*="/channels/"],a[href*="/channel/"]');r.channels.urlPattern=chLink?((chLink.getAttribute('href')||'').includes('/channels/')?'/channels/{slug}':'/channel/{slug}'):null;
// Sorting
const jsS=new Map();const svP=/[?&]sort=([a-z0-9_-]+)/gi;while((cm=svP.exec(cb))!==null){const v=cm[1];if(!jsS.has(v))jsS.set(v,{label:v.replace(/[-_]/g,' '),param:'sort='+v})}r.sorting.fromJs=[...jsS.values()];
// Search
const fSP=new Set();[/[?&](search)=[^&"']+/gi,/[?&](k)=[^&"']+/gi,/[?&](q)=[^&"']+/gi].forEach(pat=>{let m;while((m=pat.exec(cb))!==null)fSP.add(m[1].toLowerCase());pat.lastIndex=0});
doc.querySelectorAll('form input').forEach(i=>{const nm=(i.getAttribute('name')||'').toLowerCase();if(['q','k','query','search','s'].includes(nm))fSP.add(nm)});
r.search.paramNames=[...fSP];const sP=r.search.paramNames[0]||'q',eTW=encodeURIComponent(tw);
r.search.exampleUrls.push({label:'Поиск: '+tw,url:base+'/?'+sP+'='+eTW});
r.sorting.fromJs.forEach(s=>r.search.exampleUrls.push({label:'Поиск+'+s.label,url:base+'/?'+s.param+'&'+sP+'='+eTW}));
r.urlScheme={base,search:{paramName:sP,pattern:base+'/?'+sP+'={query}'},category:{paramName:'c',pattern:base+'/?c={slug}'},channel:{pattern:r.channels.urlPattern?base+r.channels.urlPattern:null},sorting:{options:r.sorting.fromJs,pattern:base+'/?sort={value}'},pagination:{pattern:'&page={N}'},combinations:{searchSortPage:base+'/?sort={sort}&'+sP+'={query}&page={N}',catSortPage:base+'/?sort={sort}&c={slug}&page={N}'}};
return r}

// ================================================================
// CARDS
// ================================================================
function aCards(doc,base){const r={found:false,cardSelector:null,cardXPath:null,totalCardsFound:0,structure:{title:{css:null,xpath:null,example:null},link:{css:null,xpath:null,example:null,pattern:null},thumbnail:{css:null,xpath:null,attribute:null,example:null},duration:{css:null,xpath:null,example:null},quality:{css:null,xpath:null,example:null},views:{css:null,xpath:null,example:null}},sampleCards:[]};
const cS=['.video-item','.video-card','.thumb-item','.thumb','.video-thumb','.video_block','.video-block','.item','.video','.thumb_main','article','.card','[data-video-id]'];
let cards=[],uS='';for(const s of cS)try{const f=doc.querySelectorAll(s);if(f.length>=2&&Array.from(f).some(e=>e.querySelector('a[href]'))&&Array.from(f).some(e=>e.querySelector('img'))){cards=Array.from(f);uS=s;break}}catch{}
if(!cards.length)return r;r.found=true;r.cardSelector=uS;r.totalCardsFound=cards.length;r.cardXPath=genXP(cards[0]);
const tS=['.title','.name','a[title]','[class*="title"]','h3','h4','strong'];
const dS=['.duration','.time','[class*="duration"]'];
const imgA=['data-src','data-original','data-lazy-src','data-thumb','src'];
for(let i=0;i<Math.min(5,cards.length);i++){const card=cards[i],cd={};
for(const ts of tS)try{const el=card.querySelector(ts);if(el){const t=ts==='a[title]'?el.getAttribute('title'):el.textContent.trim();if(t&&t.length>2){if(!cd.title)cd.title=t;if(i===0){r.structure.title.css=`${uS} ${ts}`;r.structure.title.xpath=sXP(el);r.structure.title.example=t.substring(0,60)}break}}}catch{}
const lk=card.querySelector('a[href]');if(lk){cd.link=resolve(lk.getAttribute('href'),base);if(i===0){r.structure.link.css=`${uS} a[href]`;r.structure.link.xpath=sXP(lk);r.structure.link.example=cd.link;try{r.structure.link.pattern=new URL(cd.link).pathname.replace(/\/\d+\//g,'/{id}/').replace(/\/[a-z0-9_-]{8,}\/?$/i,'/{slug}/')}catch{}}}
card.querySelectorAll('img').forEach(img=>{if(cd.thumbnail)return;for(const at of imgA){const sv=img.getAttribute(at);if(sv&&!sv.startsWith('data:')&&sv.length>5){cd.thumbnail=resolve(sv,base);if(i===0){r.structure.thumbnail.css=`${uS} img`;r.structure.thumbnail.xpath=sXP(img);r.structure.thumbnail.attribute=at;r.structure.thumbnail.example=cd.thumbnail}break}}});
for(const ds of dS)try{const el=card.querySelector(ds);if(el){const t=el.textContent.trim();if(/\d{1,2}:\d{2}/.test(t)){cd.duration=t;if(i===0){r.structure.duration.css=`${uS} ${ds}`;r.structure.duration.xpath=sXP(el);r.structure.duration.example=t}break}}}catch{}
r.sampleCards.push(cd)}return r}

// ================================================================
// PLAYER STRUCTURE + QUALITY MAP (from v4.0.0)
// ================================================================
const PLAYER_SIGS=[{name:'uppod',pats:['uppod']},{name:'jwplayer',pats:['jwplayer']},{name:'videojs',pats:['videojs','video-js']},{name:'flowplayer',pats:['flowplayer']},{name:'plyr',pats:['plyr']}];
const JS_CFG_PATTERNS=[
{type:'kt_player',fields:[{re:/video_url\s*[:=]\s*['"]([^'"]+)['"]/,labelRe:/video_url_text\s*[:=]\s*['"]([^'"]+)['"]/,fb:'480p'},{re:/video_alt_url\s*[:=]\s*['"]([^'"]+)['"]/,labelRe:/video_alt_url_text\s*[:=]\s*['"]([^'"]+)['"]/,fb:'720p'}]},
{type:'xvideos',fields:[{re:/setVideoUrlHigh\s*\(\s*['"]([^'"]+)['"]\)/,fb:'720p'},{re:/setVideoUrlLow\s*\(\s*['"]([^'"]+)['"]\)/,fb:'480p'},{re:/setVideoHLS\s*\(\s*['"]([^'"]+)['"]\)/,fb:'HLS'}]},
{type:'jwplayer',fields:[{re:/file\s*:\s*['"]([^'"]+\.(?:mp4|m3u8)[^'"]*)['"]/,fb:'auto'}]}];
function analyzePlayer(doc,allJS,base){
const r={videoTag:null,sources:[],jsConfigs:[],jsonEncodings:[],qualityMap:{},videoUrlTemplates:[],player:null};
const vid=doc.querySelector('video');
if(vid){r.videoTag={id:vid.id||null,poster:vid.getAttribute('poster')?resolve(vid.getAttribute('poster'),base):null};
doc.querySelectorAll('video source,source').forEach(s=>{const src=s.getAttribute('src')||s.getAttribute('data-src');if(!src)return;const entry={src:resolve(src,base),type:s.getAttribute('type')||null,size:s.getAttribute('size')||null,label:s.getAttribute('label')||null,title:s.getAttribute('title')||null,dataQuality:s.getAttribute('data-quality')||null};const qa=entry.size||entry.label||entry.title||entry.dataQuality;
if(qa==='preview'){entry.skip=true}else{const ql=qa?(/^\d+$/.test(qa)?qa+'p':qa):null;entry.qualityDetected=ql;entry.detectionMethod=entry.size?'size-attr':entry.label?'label-attr':entry.title?'title-attr':'unknown';if(ql&&entry.src&&!r.qualityMap[ql])r.qualityMap[ql]={url:entry.src,source:'<source>',method:entry.detectionMethod,domain:hostOf(entry.src)}}r.sources.push(entry)})}
// og:video
doc.querySelectorAll('meta[property="og:video"],meta[property="og:video:url"]').forEach(m=>{const u=m.getAttribute('content');if(u&&u.includes('.mp4')){const rv=resolve(u,base),qm=u.match(/_(\d+)\.mp4/),lb=qm?qm[1]+'p':'HD';if(!r.qualityMap[lb])r.qualityMap[lb]={url:rv,source:'og:video',method:'filename-regex',domain:hostOf(rv)}}});
// JS configs
for(const cfg of JS_CFG_PATTERNS){const found=[];for(const f of cfg.fields){const m=allJS.match(f.re);if(m){let label=f.fb;if(f.labelRe){const lm=allJS.match(f.labelRe);if(lm)label=lm[1]}const url=resolve(m[1].replace(/\\\//g,'/'),base);found.push({field:f.re.source.substring(0,40),value:url,quality:label});if(!r.qualityMap[label])r.qualityMap[label]={url,source:'js-config',method:cfg.type,domain:hostOf(url)}}}if(found.length)r.jsConfigs.push({type:cfg.type,fields:found,extractionHint:cfg.type==='kt_player'?"video_url\\s*[:=]\\s*['\"]([^'\"]+)['\"]":cfg.type==='xvideos'?"setVideoUrlHigh\\(['\"]([^'\"]+)['\"]\\)":"file\\s*:\\s*['\"]([^'\"]+)['\"]"})}
// JSON Encodings
for(const vn of['dataEncodings','sources','media_sources','video_sources']){const idx=allJS.indexOf(vn);if(idx===-1)continue;const as=allJS.indexOf('[',idx);if(as===-1||as-idx>50)continue;try{let depth=0,ae=-1;for(let i=as;i<Math.min(allJS.length,as+5000);i++){if(allJS[i]==='[')depth++;else if(allJS[i]===']'){depth--;if(depth===0){ae=i;break}}}if(ae===-1)continue;JSON.parse(allJS.substring(as,ae+1)).forEach(item=>{const u=item.filename||item.file||item.src||item.url||'';const q=item.quality||item.label||item.res||item.height||'';if(!u)return;const url=(u.indexOf('//')===0?'https:':'')+u.replace(/\\\//g,'/');const key=String(q).toLowerCase()==='auto'?'auto':(q?q+'p':'auto');r.jsonEncodings.push({variable:vn,url,quality:key});if(!r.qualityMap[key])r.qualityMap[key]={url,source:'json-encoding',method:vn,domain:hostOf(url)}})}catch{}}
// HLS fallback
const hlsM=allJS.match(/(https?:\/\/[^\s"']+\.m3u8[^\s"']*)/);if(hlsM&&!r.qualityMap.HLS&&!r.qualityMap.auto)r.qualityMap.auto={url:hlsM[1],source:'js-regex',method:'m3u8-pattern',domain:hostOf(hlsM[1])};
// MP4 brute
if(!Object.keys(r.qualityMap).length){const mp4R=/(https?:\/\/[^\s"']+\.mp4[^\s"']*)/g;let mm,c=0;while((mm=mp4R.exec(allJS))&&c<3){const u=mm[1];if(u.includes('preview')||u.includes('thumb'))continue;const qm2=u.match(/_(\d+)\.mp4/);const lb=qm2?qm2[1]+'p':('src'+c);if(!r.qualityMap[lb]){r.qualityMap[lb]={url:u,source:'js-regex',method:'mp4-brute',domain:hostOf(u)};c++}}}
// Video URL Templates
for(const[q,info]of Object.entries(r.qualityMap)){try{const u=new URL(info.url);let tpl=u.pathname.replace(/\/\d{4,}\//g,'/{id}/').replace(/\/[a-f0-9]{16,}\//gi,'/{hash}/').replace(/_\d{3,4}\.mp4/,'_{quality}.mp4').replace(/\/\d+_/,'/{id}_');r.videoUrlTemplates.push({template:u.origin+tpl,example:info.url.substring(0,100),domain:info.domain,variables:tpl.match(/\{[^}]+\}/g)||[]})}catch{}}
const seen=new Set();r.videoUrlTemplates=r.videoUrlTemplates.filter(t=>{if(seen.has(t.template))return false;seen.add(t.template);return true});
// Player
const lcJS=allJS.toLowerCase();for(const p of PLAYER_SIGS)for(const pat of p.pats)if(lcJS.includes(pat)){r.player=p.name;break};
return r}
function isVideoScript(src){if(!src)return false;if(/jquery|react|vue|angular|bootstrap|analytics|tracking|ads|cdn|polyfill|webpack|chunk/i.test(src))return false;return/video\d+|clip\d+|media\d+|stream\d+|embed\d+|config\d+|player.*\d{3,}|setup.*\d{2,}/i.test(src)}

// ================================================================
// CDN WHITELIST (from v4.0.0)
// ================================================================
function buildWhitelist(base,dom,player,cards){const domains=new Map();domains.set(hostOf(base),{domain:hostOf(base),role:'site',required:true});
for(const[q,info]of Object.entries(player?.qualityMap||{})){const d=info.domain;if(d&&!domains.has(d))domains.set(d,{domain:d,role:'video CDN ('+q+')',required:true})}
(player?.sources||[]).forEach(s=>{const d=hostOf(s.src);if(d&&!domains.has(d))domains.set(d,{domain:d,role:'video source',required:true})});
(cards?.sampleCards||[]).forEach(c=>{const d=hostOf(c.thumbnail||'');if(d&&d!==hostOf(base)&&!domains.has(d))domains.set(d,{domain:d,role:'thumbnail CDN',required:false})});
(dom?.externalScripts||[]).forEach(s=>{const d=hostOf(s);if(d&&!domains.has(d))domains.set(d,{domain:d,role:'script',required:false})});
const list=[...domains.values()],required=list.filter(d=>d.required);
const code='const ALLOWED_TARGETS = [\n'+required.map(d=>`  "${d.domain}",  // ${d.role}`).join('\n')+'\n];';
return{domains:list,required,code}}

// ================================================================
// URL FORMAT (from v4.0.0)
// ================================================================
function detectUrlFormat(html){const r={backslashEscaped:false,protocolRelative:false,rootRelative:false,placeholders:[],cleanUrlRules:[]};
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
// PARSER FLOW (from v4.0.0)
// ================================================================
function buildParserFlow(base,nav,cards,player,prot){
const flow={catalog:{url:base,paginationPattern:nav?.urlScheme?.pagination?.pattern||'?page={N}',cardSelector:cards?.cardSelector,cardCount:cards?.totalCardsFound||0},card:{},videoPage:{extractionStrategies:[]},requiredHeaders:prot?.requiredHeaders||{}};
if(cards?.structure){const s=cards.structure;flow.card={linkSelector:s.link.css,linkPattern:s.link.pattern,titleSelector:s.title.css,thumbSelector:s.thumbnail.css,thumbAttribute:s.thumbnail.attribute,durationSelector:s.duration.css}}
if(player?.sources?.filter(s=>!s.skip).length)flow.videoPage.extractionStrategies.push({priority:3,method:'source-tags',hint:'<source src size/label>'});
if(player?.jsConfigs?.length)player.jsConfigs.forEach(c=>flow.videoPage.extractionStrategies.push({priority:2,method:'js-config-'+c.type,hint:c.extractionHint}));
if(player?.jsonEncodings?.length)flow.videoPage.extractionStrategies.push({priority:2,method:'json-encodings',hint:'JSON array filename/quality'});
if(Object.values(player?.qualityMap||{}).some(v=>v.source==='og:video'))flow.videoPage.extractionStrategies.push({priority:2,method:'og-video',hint:'<meta og:video>'});
if(Object.values(player?.qualityMap||{}).some(v=>v.method==='m3u8-pattern'))flow.videoPage.extractionStrategies.push({priority:1,method:'hls-regex',hint:'m3u8 URL'});
if(Object.values(player?.qualityMap||{}).some(v=>v.method==='mp4-brute'))flow.videoPage.extractionStrategies.push({priority:0,method:'mp4-brute',hint:'mp4 URLs in JS'});
flow.videoPage.extractionStrategies.sort((a,b)=>b.priority-a.priority);
return flow}

// ================================================================
// COMPATIBILITY
// ================================================================
function assessCompat(jsReq,prot,vc,player){const items=[];
items.push({key:'ssr',icon:jsReq==='no'?'✅':jsReq==='partial'?'⚠️':'❌',label:'HTML без JS',status:jsReq==='no'?'ok':'fail',hint:jsReq==='no'?'SSR':'Нужен JS'});
const hasTok=Object.values(player?.qualityMap||{}).some(v=>(v.url||'').includes('token'));
items.push({key:'url',icon:hasTok?'⚠️':Object.keys(player?.qualityMap||{}).length?'✅':'—',label:'URL стабилен',status:hasTok?'warn':'ok',hint:hasTok?'Токенизирован':'OK'});
items.push({key:'poster',icon:vc?.found?'✅':'❌',label:'Постеры',status:vc?.found?'ok':'fail',hint:vc?.found?vc.totalCardsFound+' шт':'Нет'});
const hasDirect=player?.sources?.some(s=>!s.skip);
items.push({key:'directV',icon:hasDirect?'✅':Object.keys(player?.qualityMap||{}).length?'⚠️':'❌',label:'Видео прямой',status:hasDirect?'ok':'warn',hint:hasDirect?'<source>':'Через JS'});
if(prot?.cloudflare)items.push({key:'cf',icon:prot.cloudflareTurnstile?'❌':'⚠️',label:prot.cloudflareTurnstile?'CF Turnstile':'CF Basic',status:prot.cloudflareTurnstile?'fail':'warn',hint:prot.cloudflareTurnstile?'Headless':'Worker'});
if(prot?.drm)items.push({key:'drm',icon:'❌',label:'DRM: '+prot.drmDetails.join(','),status:'fail',hint:'Невозможно'});
if(prot?.authRequired)items.push({key:'auth',icon:'❌',label:'Auth',status:'fail',hint:'Login'});
if(prot?.ageGate?.detected)items.push({key:'age',icon:prot.ageGate.impact==='none'?'✅':'⚠️',label:'Age ('+prot.ageGate.type+')',status:prot.ageGate.impact==='none'?'ok':'warn',hint:prot.ageGate.note||''});
if(prot?.refererProtected)items.push({key:'ref',icon:'⚠️',label:'Referer check',status:'warn',hint:'Нужен заголовок Referer'});
return items}

// ================================================================
// PARSER CONFIG GENERATOR (from v3.5 + v4.0.0)
// ================================================================
function generateParserConfig(cat,vid){const cfg={};const base=cat?cat._meta?.baseUrl:vid?baseOf(vid.url):'';
cfg.HOST=base;cfg.NAME=base.replace(/https?:\/\/(www\.)?/,'').replace(/\..*/,'').replace(/[^a-z0-9]/gi,'').substring(0,12)||'myparser';
if(cat?.navigation){const nav=cat.navigation;cfg.CATEGORIES=(nav.categories?.merged||[]).map(c=>({title:c.name,slug:c.slug}));cfg.CHANNELS=(nav.channels?.merged||[]).map(c=>({title:c.name,slug:c.slug}));cfg.SORT_OPTIONS=(nav.sorting?.fromJs||[]).map(s=>({label:s.label,value:s.param?.replace('sort=','')||null}));cfg.SEARCH_PARAM=nav.search?.paramNames?.[0]||'q';cfg.URL_PATTERNS={search:nav.urlScheme?.search?.pattern,category:nav.urlScheme?.category?.pattern,channel:nav.urlScheme?.channel?.pattern,pagination:nav.urlScheme?.pagination?.pattern,searchSortPage:nav.urlScheme?.combinations?.searchSortPage,catSortPage:nav.urlScheme?.combinations?.catSortPage}}
if(cat?.videoCards?.found){const vc=cat.videoCards;cfg.CARD_SELECTORS=[vc.cardSelector];cfg.CARD_FIELDS={};for(const[k,v]of Object.entries(vc.structure)){if(v.css)cfg.CARD_FIELDS[k]={selector:v.css,xpath:v.xpath,attribute:v.attribute||null,example:v.example}}}
if(vid?.playerStructure){const ps=vid.playerStructure;cfg.QUALITY_MAP=ps.qualityMap;cfg.VIDEO_URL_TEMPLATES=ps.videoUrlTemplates;cfg.PLAYER=ps.player;if(ps.jsConfigs?.length)cfg.VIDEO_RULES=ps.jsConfigs.map(c=>({type:c.type,regex:c.extractionHint,fields:c.fields.map(f=>({quality:f.quality,example:f.value?.substring(0,80)}))}));else cfg.VIDEO_RULES=[];cfg.JSON_ENCODINGS=ps.jsonEncodings?.length?uniq(ps.jsonEncodings.map(e=>e.variable)):[];
if(vid.externalJsPattern)cfg.EXTERNAL_JS_PATTERN=vid.externalJsPattern}else{cfg.VIDEO_RULES=[];cfg._videoNote='Для VIDEO_RULES → анализ видео-страницы'}
if(cat?.architecture?.protection?.requiredHeaders)cfg.REQUIRED_HEADERS=cat.architecture.protection.requiredHeaders;
if(vid?.urlFormat?.cleanUrlRules?.length)cfg.CLEAN_URL_RULES=vid.urlFormat.cleanUrlRules;
if(cat?.architecture?.protection?.ageGate?.detected){const ag=cat.architecture.protection.ageGate;cfg.AGE_GATE={type:ag.type};if(ag.cookieName)cfg.AGE_GATE.cookie=ag.cookieName+'='+(ag.cookieValue||'1')}
if(vid?.workerWhitelist)cfg.WORKER_WHITELIST=vid.workerWhitelist.required.map(d=>d.domain);
return cfg}

// ================================================================
// CATALOG ANALYSIS
// ================================================================
async function runCatalogAnalysis(){const ui=$('targetUrl'),url=ui?.value.trim();if(!url){setStatus('❌ URL!','error');return}try{new URL(url)}catch{setStatus('❌ Bad URL','error');return}
const base=baseOf(url),btn=$('btnAnalyze');if(btn){btn.disabled=true;btn.textContent='⏳'}$('results').style.display='none';updCI('hidden');updW(!!getW());transportLog=[];
const result={_meta:{analyzedUrl:url,baseUrl:base,analyzedAt:new Date().toISOString(),mode:'catalog',testWord:getTestWord(),tool:'v4.1.0'}};
try{setStatus('📥','loading');setProgress(10,'📡');let html;try{html=await fetchPage(url)}catch(e){setProgress(10,'❌','cors-error');setStatus('❌ '+e.message,'error');result._error={type:isCE(e)?'CORS':'FETCH',message:e.message};catalogData=result;analysisResult=buildFinalJSON();displayResults(analysisResult);return}
const doc=parseH(html);setProgress(20,'DOM');const dom=aDom(doc);setProgress(25,'FW');const fw=aFW(doc,html);setProgress(30,'Prot');const prot=aProt(doc,html,base);result.encoding=aEnc(doc);setProgress(40,'Nav');result.navigation=parseJsNav(doc,html,base);setProgress(50,'Cards');result.videoCards=aCards(doc,base);setProgress(58,'JSD');const jsReq=aJSD(doc,html,result.videoCards.found,fw);result.architecture={jsRequired:jsReq,frameworks:fw,protection:prot,domInfo:dom,recommendation:{method:jsReq==='yes'?'Headless':'CSS+XPath',tools:jsReq==='yes'?'Puppeteer':'Cheerio',transport:prot.cloudflare?'Worker':'Proxy'}};
result._summary={jsRequired:jsReq,videoCardsFound:result.videoCards.totalCardsFound,categoriesCount:result.navigation.categories.totalCount,channelsCount:result.navigation.channels.totalCount,sortingCount:result.navigation.sorting.fromJs.length,searchParams:result.navigation.search.paramNames,frameworks:fw};
result._transportLog=transportLog;catalogData=result;videoPageData=null;analysisResult=buildFinalJSON();displayResults(analysisResult);setProgress(100,'✅');setStatus('✅ Каталог! Для VIDEO_RULES → 🎬 Видео','success')}catch(e){setStatus('❌ '+e.message,'error')}finally{if(btn){btn.disabled=false;btn.textContent=isVideoMode()?'🎬 Анализ видео':'🚀 Анализ каталога'}updMerge()}}

// ================================================================
// VIDEO PAGE ANALYSIS
// ================================================================
async function runVideoAnalysis(){const ui=$('targetUrl'),url=ui?.value.trim();if(!url){setStatus('❌ URL!','error');return}try{new URL(url)}catch{setStatus('❌ Bad URL','error');return}
const base=catalogData?catalogData._meta.baseUrl:baseOf(url);

const btn=$('btnAnalyze');if(btn){btn.disabled=true;btn.textContent='🎬⏳'}updCI('hidden');transportLog=[];
const vd={analyzed:false,url,title:null,videoTitle:null,poster:null,metadata:{},playerStructure:null,externalScripts:[],urlFormat:null,workerWhitelist:null,parserFlow:null,compatibility:null};
try{setStatus('🎬 Видео...','loading');setProgress(15,'🎬','video-mode');
const html=await fetchPage(url);const doc=parseH(html);vd.analyzed=true;vd.title=doc.title;const h1=doc.querySelector('h1');if(h1)vd.videoTitle=h1.textContent.trim();
const ogImg=doc.querySelector('meta[property="og:image"]');if(ogImg)vd.poster=ogImg.getAttribute('content');
const allInline=Array.from(doc.querySelectorAll('script')).map(s=>s.textContent).join('\n');
setProgress(35,'🎬 Player...');
vd.playerStructure=analyzePlayer(doc,html+'\n'+allInline,base);
// External JS
setProgress(50,'🎬 ExtJS...');
const extSrcs=Array.from(doc.querySelectorAll('script[src]')).map(s=>s.getAttribute('src')).filter(Boolean);
const videoScripts=extSrcs.filter(isVideoScript).slice(0,3);
for(const vs of videoScripts){const full=resolve(vs,base);try{logT('ExtJS:'+vs);setProgress(55,'🎬 '+vs.split('/').pop(),'video-mode');const jsCode=await fetchPage(full);vd.externalScripts.push({src:vs,fetched:true,size:jsCode.length,videoFound:false});
const extPlayer=analyzePlayer(doc,jsCode,base);if(Object.keys(extPlayer.qualityMap).length){vd.externalScripts[vd.externalScripts.length-1].videoFound=true;
Object.assign(vd.playerStructure.qualityMap,extPlayer.qualityMap);vd.playerStructure.jsConfigs.push(...extPlayer.jsConfigs);vd.playerStructure.jsonEncodings.push(...extPlayer.jsonEncodings);vd.playerStructure.videoUrlTemplates.push(...extPlayer.videoUrlTemplates);if(extPlayer.player&&!vd.playerStructure.player)vd.playerStructure.player=extPlayer.player}}catch(e){vd.externalScripts.push({src:vs,fetched:false,error:e.message})}}
extSrcs.filter(s=>!isVideoScript(s)).slice(0,5).forEach(s=>vd.externalScripts.push({src:s,fetched:false,reason:'library'}));
if(videoScripts[0]){vd.externalJsPattern=videoScripts[0].replace(/\d+/g,'\\d+').replace(/\./g,'\\.')}
// URL Format
setProgress(70,'🎬 URL Format');
vd.urlFormat=detectUrlFormat(html+'\n'+allInline);
// Metadata
const durEl=doc.querySelector('.duration,.time,[class*="duration"],time');if(durEl)vd.metadata.duration=durEl.textContent.trim();
const viewEl=doc.querySelector('.views,[class*="view"]');if(viewEl)vd.metadata.views=viewEl.textContent.trim();
// Whitelist & flow
setProgress(80,'🎬 Whitelist');
const dom=aDom(doc);const prot=aProt(doc,html,base);
vd.workerWhitelist=buildWhitelist(base,dom,vd.playerStructure,catalogData?.videoCards);
vd.parserFlow=buildParserFlow(base,catalogData?.navigation,catalogData?.videoCards,vd.playerStructure,prot);
vd.compatibility=assessCompat(catalogData?.architecture?.jsRequired||'no',prot,catalogData?.videoCards,vd.playerStructure);
setProgress(90,'🎬 Done');
}catch(e){vd.error=e.message}
vd._transportLog=transportLog;videoPageData=vd;analysisResult=buildFinalJSON();displayResults(analysisResult);setProgress(100,'✅');setStatus(catalogData?'✅ Каталог + Видео = полный JSON':'✅ Видео','success');
if(btn){btn.disabled=false;btn.textContent='🎬 Анализ видео'}updMerge()}

// ================================================================
// DIRECT TEST (expanded from v4.0.0)
// ================================================================
async function runDirectTest(){const url=$('targetUrl')?.value.trim();if(!url)return setStatus('❌ URL!','error');const base=baseOf(url),btn=$('btnAnalyze');if(btn){btn.disabled=true;btn.textContent='🧪'}const checks=[];setStatus('🧪','loading');setProgress(10,'Direct...');
let html=null;try{const ac=new AbortController,t=setTimeout(()=>ac.abort(),12000);const r=await fetch(url,{signal:ac.signal});clearTimeout(t);if(r.ok){html=await r.text();checks.push({icon:'✅',label:'Прямой запрос',hint:`HTTP ${r.status}, ${(html.length/1024|0)}KB`})}else checks.push({icon:'❌',label:'Прямой запрос',hint:`HTTP ${r.status}`})}catch(e){checks.push({icon:'❌',label:'Прямой запрос',hint:isCE(e)?'CORS':e.message})}
if(html){const doc=parseH(html),dt=doc.querySelectorAll('*').length,lc=html.toLowerCase();
checks.push({icon:dt>100?'✅':'❌',label:'SSR',hint:`DOM ${dt}`});
if(lc.includes('challenges.cloudflare.com'))checks.push({icon:lc.includes('turnstile')?'❌':'⚠️',label:'Cloudflare',hint:lc.includes('turnstile')?'Turnstile':'Basic'});
if(lc.includes('ddos-guard'))checks.push({icon:'⚠️',label:'DDoS-Guard',hint:'Может блокировать'});
// Try video page
let vUrl=null;doc.querySelectorAll('a[href]').forEach(a=>{if(vUrl)return;const h=a.getAttribute('href')||'';if(h.includes('video')||h.includes('watch')||/\/\d{3,}\//.test(h))vUrl=resolve(h,base)});
if(vUrl){setProgress(50,'🧪 Video page...');
try{const ac2=new AbortController,t2=setTimeout(()=>ac2.abort(),12000);const r2=await fetch(vUrl,{signal:ac2.signal});clearTimeout(t2);if(r2.ok){const vh=await r2.text(),vd=parseH(vh);
const vTag=vd.querySelector('video[src],video source[src]');const ogV=vd.querySelector('meta[property="og:video"]');
if(vTag)checks.push({icon:'✅',label:'<video> tag',hint:'Прямой'});
else if(ogV)checks.push({icon:'✅',label:'og:video',hint:ogV.getAttribute('content')?.substring(0,50)});
else{const jsM=vh.match(/https?:\/\/[^\s"']+\.(?:mp4|m3u8)/i);checks.push({icon:jsM?'⚠️':'❌',label:jsM?'Video в JS':'Video не найден',hint:jsM?'Regex':'Нужен JS?'})}
checks.push({icon:'✅',label:'Video page',hint:`${(vh.length/1024|0)}KB`})}else checks.push({icon:'❌',label:'Video page',hint:`HTTP ${r2.status}`})}catch(e){checks.push({icon:'❌',label:'Video page',hint:isCE(e)?'CORS':e.message})}}}
const ok=checks.filter(c=>c.icon==='✅').length,fail=checks.filter(c=>c.icon==='❌').length;
const verdict=fail===0?{v:'ok',l:'✅ Совместим'}:ok>fail?{v:'partial',l:'⚠️ Частично'}:{v:'fail',l:'❌ Несовместим'};
analysisResult={_meta:{url,mode:'direct-test',tool:'v4.1.0'},directTest:{checks,verdict:verdict.v,verdictLabel:verdict.l}};
let h=`<div class="dt-block${verdict.v==='fail'?' fail':''}"><h3${verdict.v==='fail'?' class="fail-title"':''}>🧪 ${esc(url)}</h3><div class="dt-grid">`;
checks.forEach(c=>{h+=`<div class="dt-item"><span class="dt-icon">${c.icon}</span><div class="dt-text"><strong>${esc(c.label)}</strong><span class="dt-hint">${esc(c.hint)}</span></div></div>`});
h+=`</div><div class="dt-summary"><div class="verdict ${verdict.v}">${esc(verdict.l)}</div></div></div>`;
$('results').style.display='block';$('archReport').innerHTML=h;const j=JSON.stringify(analysisResult,null,2);$('jsonFormatted').innerHTML=synHL(j);$('jsonRaw').value=j;$('configFormatted').textContent='// direct-test';$('btnCopyJson').disabled=false;showTab('arch');setProgress(100,'✅');setStatus('🧪 Done','success');if(btn){btn.disabled=false;btn.textContent='🚀 Анализ каталога'}}

// ================================================================
// BUILD FINAL JSON (merge)
// ================================================================
function buildFinalJSON(){const r={};
if(catalogData){Object.assign(r,JSON.parse(JSON.stringify(catalogData)));r._meta.mode=videoPageData?'catalog+video':'catalog'}
if(videoPageData){if(!r._meta)r._meta={mode:'video',analyzedAt:new Date().toISOString(),tool:'v4.1.0'};if(videoPageData.url)r._meta.videoPageUrl=videoPageData.url;r.videoPage=videoPageData;if(!catalogData)r._meta.mode='video';else r._meta.mode='catalog+video';
// Merge compatibility from video analysis
if(videoPageData.compatibility)r.compatibility=videoPageData.compatibility;
if(videoPageData.workerWhitelist)r.workerWhitelist=videoPageData.workerWhitelist;
if(videoPageData.parserFlow)r.parserFlow=videoPageData.parserFlow;
if(videoPageData.urlFormat)r.urlFormat=videoPageData.urlFormat}
r.parserConfig=generateParserConfig(catalogData,videoPageData);
return r}

// ================================================================
// ROUTER
// ================================================================
async function runFullAnalysis(){const pm=($('proxySelect')||{}).value;if(pm==='direct-test')return runDirectTest();if(isVideoMode())return runVideoAnalysis();return runCatalogAnalysis()}

// ================================================================
// DISPLAY
// ================================================================
function displayResults(d){$('results').style.display='block';const j=JSON.stringify(d,null,2);$('jsonFormatted').innerHTML=synHL(j);$('jsonRaw').value=j;$('archReport').innerHTML=genArch(d);
const cfg=d.parserConfig?JSON.stringify(d.parserConfig,null,2):'// Нет';$('configFormatted').innerHTML=synHL(cfg);
$('btnCopyJson').disabled=false;$('btnCopyArch').disabled=false;$('btnCopyConfig').disabled=!d.parserConfig;$('btnCopyWhitelist').disabled=!(d.workerWhitelist||d.videoPage?.workerWhitelist)}

// ================================================================
// ARCHITECTURE RENDER
// ================================================================
function genArch(d){if(d.directTest)return d.archReport||$('archReport')?.innerHTML||'';
if(!d.architecture&&!d.videoPage)return d._error?`<div class="ab"><h3 style="color:#f44">❌ ${esc(d._error?.type)}</h3><p style="color:#aaa">${esc(d._error?.message)}</p></div>`:'';
let h='';const a=d.architecture;
// Compat
if(d.compatibility?.length){h+='<div class="compat-block"><h3>🧪 Совместимость</h3><div class="compat-grid">';d.compatibility.forEach(c=>{h+=`<div class="compat-item"><span class="compat-icon">${c.icon}</span><div class="compat-text"><strong>${esc(c.label)}</strong><span class="hint">${esc(c.hint)}</span></div></div>`});h+='</div></div>'}
// Whitelist
const wl=d.workerWhitelist||d.videoPage?.workerWhitelist;
if(wl?.required?.length){h+='<div class="wl-block"><h3>📡 Worker Whitelist</h3>';wl.required.forEach(dm=>{h+=`<div class="wl-domain"><code>${esc(dm.domain)}</code><span class="role">${esc(dm.role)}</span></div>`});h+=`<div class="wl-code" onclick="copyWhitelist()" title="Клик = копировать">${esc(wl.code)}</div></div>`}
// Quality Map
const ps=d.videoPage?.playerStructure;
if(ps&&Object.keys(ps.qualityMap).length){h+='<div class="ab"><h3 class="gt">🎬 Quality Map</h3><table class="qm-table"><tr><th>Q</th><th>URL</th><th>Source</th><th>Method</th><th>Domain</th></tr>';
for(const[q,info]of Object.entries(ps.qualityMap)){h+=`<tr><td><strong>${esc(q)}</strong></td><td><code>${esc((info.url||'').substring(0,70))}</code></td><td>${esc(info.source)}</td><td>${esc(info.method)}</td><td><code>${esc(info.domain)}</code></td></tr>`}h+='</table></div>'}
// Parser Flow
const pf=d.parserFlow||d.videoPage?.parserFlow;
if(pf){h+='<div class="ab"><h3 class="wt">🔗 Parser Flow</h3><div class="pf-chain">';
h+=`<div class="pf-step"><strong>📄 Каталог</strong><code>${esc(pf.catalog?.cardSelector||'?')}</code><br>${pf.catalog?.cardCount||0} cards</div><span class="pf-arrow">→</span>`;
h+=`<div class="pf-step"><strong>🔗 Карточка</strong><code>${esc(pf.card?.linkSelector||'?')}</code><br>Pattern: <code>${esc(pf.card?.linkPattern||'?')}</code></div><span class="pf-arrow">→</span>`;
h+=`<div class="pf-step"><strong>▶️ Видео</strong>`;
(pf.videoPage?.extractionStrategies||[]).forEach(s=>{h+=`<br>${'⭐'.repeat(s.priority)||'☆'} <code>${esc(s.method)}</code>`});
h+='</div></div>';
if(Object.keys(pf.requiredHeaders||{}).length){h+='<table class="st"><tr><th>Header</th><th>Value</th></tr>';for(const[k,v]of Object.entries(pf.requiredHeaders)){h+=`<tr><td><strong>${esc(k)}</strong></td><td><code>${esc(v)}</code></td></tr>`}h+='</table>'}h+='</div>'}
// Templates
if(ps?.videoUrlTemplates?.length){h+='<div class="ab"><h3>📐 Video URL Templates</h3><table class="st"><tr><th>Template</th><th>Domain</th><th>Vars</th></tr>';
ps.videoUrlTemplates.forEach(t=>{h+=`<tr><td><code>${esc(t.template)}</code></td><td><code>${esc(t.domain)}</code></td><td>${(t.variables||[]).map(v=>`<span class="tag">${esc(v)}</span>`).join('')}</td></tr>`});h+='</table></div>'}
// JS Configs
if(ps?.jsConfigs?.length){h+='<div class="ab"><h3>🎮 JS Player Config</h3>';ps.jsConfigs.forEach(c=>{h+=`<div style="margin-bottom:6px"><strong style="color:#0df">${esc(c.type)}</strong><br>`;c.fields.forEach(f=>{h+=`<code style="color:#fa4;font-size:9px">${esc(f.quality)}</code>: <code style="color:#0f8;font-size:9px">${esc((f.value||'').substring(0,60))}</code><br>`});h+=`Regex: <code style="color:#888;font-size:9px">${esc(c.extractionHint)}</code></div>`});h+='</div>'}
// External JS
if(d.videoPage?.externalScripts?.length){h+='<div class="ab"><h3>📜 External Scripts</h3><div class="ext-js-block">';d.videoPage.externalScripts.forEach(s=>{const st=s.fetched?(s.videoFound?'✅video':'⬜none'):(s.reason||'❌');h+=`<div class="ext-js-item"><code>${esc(s.src)}</code><span class="ejs-st" style="color:${s.videoFound?'#0f8':s.fetched?'#888':'#f66'}">${esc(st)}${s.size?' ('+((s.size/1024)|0)+'K)':''}</span></div>`});h+='</div></div>'}
// Age Gate
if(a?.protection?.ageGate?.detected){const ag=a.protection.ageGate;h+=`<div class="age-g"><h4>🔞 Age Gate <span class="gt-badge ${ag.type}">${esc(ag.type)}</span></h4><p>${esc(ag.note||'')}</p>${ag.cookieName?`<div class="age-detail">Cookie: <code>${esc(ag.cookieName)}=${esc(ag.cookieValue||'1')}</code></div>`:''}</div>`}
// Recommendation
if(a?.recommendation){h+=`<div class="ab"><h3 class="wt">🔧 Стек</h3><div class="arg"><span class="arl">Метод:</span><span class="arv"><code>${esc(a.recommendation.method)}</code></span><span class="arl">Tools:</span><span class="arv"><code>${esc(a.recommendation.tools)}</code></span><span class="arl">Transport:</span><span class="arv">${esc(a.recommendation.transport)}</span></div></div>`}
// URL Scheme
const nav=d.navigation;if(nav){h+='<div class="url-scheme"><h3>🗺️ URL-схема</h3>';
if(nav.search?.exampleUrls?.length){h+=`<div class="us-section"><h4>🔍 Поиск «${esc(d._meta?.testWord||'')}»</h4><table class="us-table"><tr><th>Вариант</th><th>URL</th></tr>`;nav.search.exampleUrls.forEach(u=>{h+=`<tr><td style="font-size:10px">${esc(u.label)}</td><td><code>${esc(u.url)}</code></td></tr>`});h+='</table></div>'}
const so=nav.sorting?.fromJs;if(so?.length){h+=`<div class="us-section"><h4>🔄 Sort (${so.length})</h4><table class="us-table"><tr><th>Label</th><th>Param</th></tr>`;so.forEach(s=>{h+=`<tr><td>${esc(s.label)}</td><td><code>${esc(s.param)}</code></td></tr>`});h+='</table></div>'}
if(nav.categories?.merged?.length){h+=`<div class="us-section"><h4>📁 Categories (${nav.categories.merged.length})</h4><div class="us-cat-grid">`;nav.categories.merged.forEach(c=>{h+=`<div class="us-cat-item"><span class="cat-name">${esc(c.name)}</span><span class="cat-slug">${esc(c.slug)}</span></div>`});h+='</div></div>'}
if(nav.channels?.merged?.length){h+=`<div class="us-section"><h4>📺 Channels (${nav.channels.merged.length})</h4><div class="us-cat-grid">`;nav.channels.merged.forEach(c=>{h+=`<div class="us-cat-item"><span class="cat-name">${esc(c.name)}</span><span class="cat-slug">${esc(c.slug)}</span></div>`});h+='</div></div>'}
h+='</div>'}
// Selectors
if(d.videoCards?.found){h+=`<div class="ab"><h3>🎯 Selectors (${d.videoCards.totalCardsFound})</h3><table class="st"><tr><th>Field</th><th>CSS</th><th>XPath</th><th>Example</th></tr>`;
h+=`<tr><td><strong>📦Card</strong></td><td><code>${esc(d.videoCards.cardSelector)}</code></td><td><code>${esc(d.videoCards.cardXPath||'')}</code></td><td>${d.videoCards.totalCardsFound}</td></tr>`;
for(const[nm,f]of Object.entries(d.videoCards.structure)){if(!f.css)continue;h+=`<tr><td><strong>${esc(nm)}</strong></td><td><code>${esc(f.css)}</code></td><td><code>${esc(f.xpath||'')}</code></td><td style="font-size:9px;color:#888">${esc((f.example||'').substring(0,35))}</td></tr>`}h+='</table></div>'}
// URL Format
const uf=d.urlFormat||d.videoPage?.urlFormat;
if(uf?.cleanUrlRules?.length){h+='<div class="ab"><h3>🔧 URL Format / cleanUrl</h3><div class="acg">';
uf.cleanUrlRules.forEach(r2=>{h+=`<div class="aci"><span class="aci-i">🔧</span><span class="aci-l">${esc(r2)}</span></div>`});
if(uf.placeholders?.length)uf.placeholders.forEach(p=>{h+=`<div class="aci"><span class="aci-i">📌</span><span class="aci-l">Placeholder: ${esc(p)}</span></div>`});h+='</div></div>'}
// Checklist
const sm=d._summary||{};const checks=[{i:'📄',l:'Cards',v:sm.videoCardsFound||0,c:sm.videoCardsFound?'ok':'fail'},{i:'📁',l:'Categories',v:sm.categoriesCount||0,c:sm.categoriesCount?'ok':'n'},{i:'📺',l:'Channels',v:sm.channelsCount||0,c:sm.channelsCount?'ok':'n'},{i:'🔄',l:'Sort',v:sm.sortingCount||0,c:sm.sortingCount?'ok':'n'},{i:'🔍',l:'Search',v:(sm.searchParams||[]).join(',')||'—',c:sm.searchParams?.length?'ok':'n'},{i:'🎬',l:'Qualities',v:ps?Object.keys(ps.qualityMap).length:0,c:ps&&Object.keys(ps.qualityMap).length?'ok':'n'},{i:'🎮',l:'Player',v:ps?.player||d.videoPage?.playerStructure?.player||'—',c:(ps?.player||d.videoPage?.playerStructure?.player)?'ok':'n'},{i:'📡',l:'Whitelist',v:wl?.required?.length||0,c:wl?.required?.length?'ok':'n'}];
h+='<div class="ab"><h3>✅ Summary</h3><div class="acg">';checks.forEach(c=>{h+=`<div class="aci"><span class="aci-i">${c.i}</span><span class="aci-l">${esc(c.l)}</span><span class="aci-v ${c.c}">${c.v}</span></div>`});h+='</div></div>';
// Transport
const tl=d._transportLog||d.videoPage?._transportLog;if(tl?.length){h+=`<div class="ab"><h3>🔌 Transport</h3><div class="transport-log">`;tl.forEach(e=>{h+=`<div class="tle ${e.type}">[${e.time}] ${esc(e.message)}</div>`});h+='</div></div>'}
return h}

// ================================================================
// UI
// ================================================================
function synHL(j){return j.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,m=>{let c='color:#ae81ff';if(/^"/.test(m))c=/:$/.test(m)?'color:#a6e22e':'color:#e6db74';else if(/true|false/.test(m))c='color:#66d9ef';else if(/null/.test(m))c='color:#f92672';return`<span style="${c}">${m}</span>`})}
function showTab(n){document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));const t=$('tab-'+n);if(t)t.classList.add('active');event?.target?.classList.add('active')}
function clip(t){navigator.clipboard.writeText(t).then(()=>setStatus('📋 OK','success')).catch(()=>{const a=document.createElement('textarea');a.value=t;document.body.appendChild(a);a.select();document.execCommand('copy');document.body.removeChild(a);setStatus('📋 OK','success')})}
function copyResults(){if(analysisResult)clip(JSON.stringify(analysisResult,null,2))}
function copyParserConfig(){if(analysisResult?.parserConfig){clip(JSON.stringify(analysisResult.parserConfig,null,2));setStatus('⚙️ Config!','success')}}
function copyWhitelist(){const wl=analysisResult?.workerWhitelist||analysisResult?.videoPage?.workerWhitelist;if(wl?.code){clip(wl.code);setStatus('📡 Whitelist!','success')}else setStatus('Нет данных','error')}
function copyArchitecture(){if(!analysisResult)return;const r=analysisResult;clip(JSON.stringify({urlScheme:r.navigation?.urlScheme,categories:r.navigation?.categories?.merged,channels:r.navigation?.channels?.merged,sorting:r.navigation?.sorting?.fromJs,search:r.navigation?.search,selectors:r.videoCards?.found?r.videoCards.structure:null,cardSelector:r.videoCards?.cardSelector,qualityMap:r.videoPage?.playerStructure?.qualityMap,videoUrlTemplates:r.videoPage?.playerStructure?.videoUrlTemplates,workerWhitelist:r.workerWhitelist||r.videoPage?.workerWhitelist,parserFlow:r.parserFlow||r.videoPage?.parserFlow,urlFormat:r.urlFormat||r.videoPage?.urlFormat,compatibility:r.compatibility,requiredHeaders:r.architecture?.protection?.requiredHeaders||r.videoPage?.parserFlow?.requiredHeaders,ageGate:r.architecture?.protection?.ageGate},null,2));setStatus('🏗️ Arch!','success')}

document.addEventListener('DOMContentLoaded',()=>{
const ui=$('targetUrl');if(ui)ui.addEventListener('keypress',e=>{if(e.key==='Enter')runFullAnalysis()});
const wi=$('workerUrl');if(wi){const sv=localStorage.getItem('aWU');if(sv)wi.value=sv;else if(!wi.value)wi.value=DEFAULT_WORKER_URL;updW(!!wi.value.trim());wi.addEventListener('input',()=>updW(!!wi.value.trim()));wi.addEventListener('change',()=>{const v=wi.value.trim();if(v)localStorage.setItem('aWU',v);else localStorage.removeItem('aWU')})}
const ck=$('videoModeCheck'),lb=$('videoModeLabel'),btn=$('btnAnalyze');if(ck&&lb&&btn){ck.addEventListener('change',()=>{lb.classList.toggle('active',ck.checked);btn.textContent=ck.checked?'🎬 Анализ видео':'🚀 Анализ каталога';btn.classList.toggle('video-mode',ck.checked)})}
updMerge()});
