document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const analyzeBtn = document.getElementById('analyzeBtn');

    // Переключение вкладок
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    analyzeBtn.addEventListener('click', async () => {
        const url = document.getElementById('targetUrl').value;
        if (!url) return;

        // Эмуляция анализа
        analyzeUrl(url);
    });
});

function analyzeUrl(url) {
    const statusPanel = document.getElementById('statusPanel');
    const tokenWarning = document.getElementById('tokenWarning');
    const whitelistResult = document.getElementById('whitelistResult');
    const pathPattern = document.getElementById('pathPattern');
    
    statusPanel.classList.remove('hidden');
    
    // 1. Проверка на токены (aProt v4.0 логика)
    const hasTimeToken = /[\?&](t|expires|time|token|hash)=17/.test(url) || url.includes('remote_control.php');
    tokenWarning.style.display = hasTimeToken ? 'block' : 'none';

    // 2. Извлечение структуры пути
    const urlObj = new URL(url);
    pathPattern.innerText = urlObj.pathname.replace(/\d+/g, '{id}');

    // 3. Симуляция найденных CDN и эвристика разрешений
    const mockCDNs = [urlObj.hostname, 'uch3.vids69.com', 'cdn-provider.net'];
    whitelistResult.innerHTML = mockCDNs.map(cdn => 
        `<li>${cdn} <span style="color:var(--accent)">[REQUIRED]</span></li>`).join('');

    generateWorkerConfig(urlObj, mockCDNs);
}

function generateWorkerConfig(urlObj, cdns) {
    const codeArea = document.getElementById('workerCode');
    const config = {
        origin: urlObj.origin,
        allowed_targets: cdns,
        token_required: /remote|token|hash/.test(urlObj.search),
        extractQualities: `function extractQualities(html) {
    // Автосгенерировано v4.0
    const sources = html.match(/source src="([^"]+)"/g);
    return sources ? sources.map(s => s.match(/"([^"]+)"/)[1]) : [];
}`
    };

    codeArea.innerText = `// Configuration for Cloudflare Worker / Serverless
const CONFIG = ${JSON.stringify(config, null, 4)};

${config.extractQualities}

export default {
    async fetch(request) {
        // Логика проксирования с учетом ${config.token_required ? 'ОБЯЗАТЕЛЬНЫХ токенов' : 'прямых ссылок'}
    }
};`;
}

function copyConfig() {
    const text = document.getElementById('workerCode').innerText;
    navigator.clipboard.writeText(text);
    alert('Конфигурация скопирована!');
}
