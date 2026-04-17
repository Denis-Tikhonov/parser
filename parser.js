// parser.js — версия 4.0.0
// Основные функции анализа, сбор whitelist, UI, вкладки, копирование

const $=id=>document.getElementById(id);

let analysisResult=null, transportLog=[];

// Обновление статуса
const setStatus=(m,t='loading')=>{const e=$('status');if(e){e.textContent=m;e.className='status '+t}}
// Обновление прогресса
const setProgress=(p,t,s)=>{const c=$('progress-container'),b=$('progress-bar'),x=$('progress-text');if(!c)return;c.style.display='block';b.style.width=p+'%';x.textContent=t||p+'%';b.className='progress-bar '+s||''}
// Копировать в буфер
function clip(text){navigator.clipboard.writeText(text).then(()=>setStatus('📋 OK','success')).catch(()=>{const t=document.createElement('textarea');t.value=text;document.body.appendChild(t);t.select();document.execCommand('copy');document.body.removeChild(t);setStatus('📋 OK','success')})}

// Основная логика
async function runFullAnalysis() {
  const ui=$('targetUrl');
  const targetUrl=ui.value.trim();
  if(!targetUrl){setStatus('❌ URL!','error');return;}
  try{new URL(targetUrl);}catch{setStatus('❌ Bad URL','error');return;}
  // Начинаем анализ
  $('results').style.display='none';
  setStatus('🔍 Анализ...', 'loading');
  resetProgress();

  // Собираем данные
  const analysis = {
    _meta: { analyzedUrl: targetUrl, analyzedAt: new Date().toISOString(), mode:'full', tool:'4.0.0' },
    dom: {},
    scripts: {},
    video: {},
    whitelist: [],
  };
  
  // Fetch HTML
  setProgress(10, 'Загружаю HTML...');
  let html='';
  try{
    const resp=await fetch(targetUrl);
    html=await resp.text();
  } catch(e){ setStatus('❌ Ошибка загрузки HTML', 'error'); return; }
  // Анализ DOM
  setProgress(20, 'Анализ DOM...');
  const parser=new DOMParser();
  const doc=parser.parseFromString(html,'text/html');

  // Обнаружение скриптов
  const scriptsArr=Array.from(doc.querySelectorAll('script[src]')).map(s=>s.src);
  analysis.dom.externalScripts=scriptsArr;

  // Обнаружение видео URL
  const sources=extractQualities(html);
  analysis.video.sources=sources;

  // Обнаружение API (по regex)
  analysis.scripts.apiEndpoints=extractApiEndpoints(html);

  // Обнаружение доменов из видео
  analysis.dom.videoDomains=Array.from(new Set(sources.map(s=>new URL(s.url).hostname))).filter(d=>d);

  // Обнаружение доменов из скриптов
  analysis.dom.scriptDomains=Array.from(new Set(scriptsArr.map(s=>{try{return new URL(s).hostname;}catch{return null;}}).filter(Boolean)));

  // Генерация whitelist
  analysis.whitelist=generateWhitelist(analysis);

  // Визуализация
  displayResults(analysis);
  // Копирование
  document.getElementById('btnCopyJson').onclick=()=>clip(JSON.stringify(analysis, null, 2));
  document.getElementById('btnCopyArch').onclick=()=>clip(JSON.stringify({domains: analysis.whitelist}, null, 2));
  // Обновление вкладок
  document.querySelector('.tab.active').classList.remove('active');
  document.querySelector('.tab').classList.add('active');
  showTab('arch');

  setProgress(100, 'Готово');
  setStatus('✅ Анализ завершен', 'success');
  $('results').style.display='block';
}

// Восстановление прогресса
function resetProgress(){const p=$('progress-bar');if(p)p.style.width='0%';}
function setProgress(p,t,s=''){const bar=$('progress-bar');const txt=$('progress-text');if(bar){bar.style.width=p+'%';txt.textContent=t; bar.className='progress-bar '+s;}}

// Вкладки
function showTab(name){document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));document.querySelectorAll('.tab').forEach(e=>e.classList.remove('active'));const t=$('tab-'+name);if(t)t.classList.add('active');if(event?.target)event.target.classList.add('active');}

// 1. extractQualities — извлечение видео
function extractQualities(html) {
  const result={};
  // 1. <source> с size
  const reSource=/<source[^>]+src="([^"]+)"[^>]+size="([^"]+)"/gi;
  let m;
  while((m=reSource.exec(html))!==null){
    const url=m[1], size=m[2];
    if(url.includes('.mp4')) result[size + 'p']=url;
  }

  // 2. og:video
  const ogMatches=html.match(/<meta[^>]+property="og:video"[^>]+content="([^"]+\.mp4)"/gi);
  if(ogMatches){
    ogMatches.forEach(m => {
      const url=m.match(/content="([^"]+)"/i)[1];
      const qualityMatch=url.match(/_(\d+)\.mp4/);
      const label=qualityMatch?qualityMatch[1]+'p':'HD';
      result[label]=url;
    });
  }

  // 3. get_file fallback
  const getFileRe=/(https?:\/\/top\.porno365tube\.win\/get_file\/[^"']+\.mp4)/g;
  let gf;
  while((gf=getFileRe.exec(html))!==null){
    const url=gf[1];
    if(!result[url]) result['auto']=url;
  }

  return result;
}

// 2. extractApiEndpoints — собирает API URL
function extractApiEndpoints(html){
  const re=/https?:\/\/[^\s"']+/g;
  const matches=new Set();
  let m;
  while((m=re.exec(html))!==null){
    matches.add(m[0]);
  }
  return Array.from(matches);
}

// 3. generateWhitelist — сбор доменов
function generateWhitelist(results){
  const domains=new Set();

  // 1. Основной URL
  const url=document.getElementById('targetUrl').value.trim();
  if(url){try{domains.add(new URL(url).hostname);}catch{;}}

  // 2. Видео CDN
  if(results.video?.sources){
    results.video.sources.forEach(s=>{
      try{domains.add(new URL(s.url).hostname);}catch{}});
  }

  // 3. Скрипты
  if(results.dom?.externalScripts){
    results.dom.externalScripts.forEach(s=>{
      try{domains.add(new URL(s).hostname);}catch{}});
  }

  // 4. API
  if(results.scripts?.apiEndpoints){
    results.scripts.apiEndpoints.forEach(e=>{
      try{domains.add(new URL(e).hostname);}catch{}});
  }

  return Array.from(domains).filter(d=>d);
}

// 4. displayResults
function displayResults(d){
  // Архитектура
  const archDiv=$('archReport');
  archDiv.innerHTML=genArch(d);
}

// 5. genArch — отображение
function genArch(d){
  // Простая генерация
  const domains=d.whitelist||[];
  return `
    <div style="border:1px solid #444; padding:10px; border-radius:8px;">
      <h3>Whitelist Domains</h3>
      <pre>${domains.join(', ')}</pre>
    </div>
  `;
}

// 6. Кнопка копирования whitelist
function copyWhitelist(){
  const txt=document.querySelector('#archReport pre').innerText;
  clip(txt);
}
