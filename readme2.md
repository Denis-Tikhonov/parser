# 📖 README — Site Structure Analyzer v4.2.1

---

## 📋 Оглавление

1. [Что это](#что-это)
2. [Архитектура связки](#архитектура-связки)
3. [Установка и запуск](#установка-и-запуск)
4. [Интерфейс](#интерфейс)
5. [Режимы анализа](#режимы-анализа)
6. [Пошаговая инструкция](#пошаговая-инструкция)
7. [Вкладки результатов](#вкладки-результатов)
8. [Структура JSON](#структура-json)
9. [Структура Config](#структура-config)
10. [Redirect Chain и KVS](#redirect-chain-и-kvs)
11. [kt_player и license_code](#kt_player-и-license_code)
12. [Worker Whitelist](#worker-whitelist)
13. [Примеры использования](#примеры-использования)
14. [Ошибки и решения](#ошибки-и-решения)
15. [Changelog](#changelog)

---

## Что это

**Site Structure Analyzer v4.2.1** — инструмент для глубокого анализа видео-сайтов. Его задача — автоматически определить структуру сайта и сгенерировать готовый **парсер-конфиг** для Lampa.

### Что анализирует

| Компонент          | Что определяет                                                             |
| ------------------ | -------------------------------------------------------------------------- |
| **Каталог**        | Карточки видео, селекторы, пагинация, категории, каналы, поиск, сортировка |
| **Видео-страница** | Плеер, качества (Quality Map), способ извлечения URL, внешние JS           |
| **Редиректы**      | Цепочки 302, /get_file/ паттерны, KVS engine, финальные CDN-URL            |
| **Защита**         | Cloudflare, DDoS-Guard, Age Gate, Referer, DRM, cookies                    |
| **kt_player**      | license_code, алгоритм деобфускации, авто-генерация decode-функции         |

### Что генерирует

- **JSON** — полный отчёт со всеми данными анализа
- **Config** — готовый конфиг для Lampa-парсера (копируется в код)
- **Whitelist** — список доменов для Worker (ALLOWED_TARGETS)

---

## Архитектура связки


┌─────────────────────────────────────────────────────┐
│  Site Structure Analyzer v4.2.1                      │
│  (браузер — index.html + parser.js + style.css)      │
│                                                       │
│  Анализирует HTML → генерирует Config + JSON          │
└──────────────┬────────────────────────────────────────┘
│ fetch через Worker
▼
┌─────────────────────────────────────────────────────┐
│  Cloudflare Worker v1.5.x                            │
│  - Проксирует HTML-страницы для анализа              │
│  - /resolve — определяет финальный URL (302 chain)   │
│  - /proxy?follow=1 — проксирует с follow-redirect    │
└──────────────┬────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────┐
│  Целевой сайт                                        │
│  (каталог, видео-страницы, CDN, /get_file/ и т.д.)   │
└─────────────────────────────────────────────────────┘
│
▼
┌─────────────────────────────────────────────────────┐
│  Lampa + adult-парсер (adultJS)                      │
│  Использует Config для работы с сайтом               │
└─────────────────────────────────────────────────────┘

---

## Установка и запуск

### Файлы


analyzer/
├── index.html      ← главная страница
├── style.css       ← стили
└── parser.js       ← вся логика анализа

markdown

Копировать код

### Запуск

**Вариант 1 — локально:**

Открыть index.html в браузере (Chrome/Edge/Firefox)


**Вариант 2 — на хостинге:**

Загрузить 3 файла на любой хостинг (GitHub Pages, Netlify, свой сервер)

css


**Вариант 3 — через VS Code Live Server:**

Открыть папку в VS Code → правый клик на index.html → Open with Live Server


### Требования

- Современный браузер (Chrome 90+, Firefox 88+, Edge 90+)
- Worker URL (для обхода CORS при анализе внешних сайтов)
- Интернет-соединение

---

## Интерфейс

### Поля ввода

| Поле         | Назначение                                 | Пример                        |
| ------------ | ------------------------------------------ | ----------------------------- |
| **⚡ Worker** | URL Cloudflare Worker для проксирования    | `https://myproxy.workers.dev` |
| **URL**      | Адрес страницы для анализа                 | `https://site.com/videos/`    |
| **Слово**    | Тестовое слово для проверки поиска         | `wife`                        |
| **🎬 Видео**  | Переключить в режим анализа видео-страницы | checkbox                      |

### Транспорт

| Режим                             | Описание                                                     |
| --------------------------------- | ------------------------------------------------------------ |
| **🔄 Авто**                        | Пробует: прямой → Worker → allorigins → corsproxy → codetabs |
| **🔗 Прямой**                      | Только direct fetch (работает для same-origin)               |
| **🧪 Тест**                        | Быстрый тест совместимости без полного анализа               |
| **allorigins/corsproxy/codetabs** | Фиксированный публичный CORS-прокси                          |

### Кнопки

| Кнопка                | Действие                                              |
| --------------------- | ----------------------------------------------------- |
| **🚀 Анализ каталога** | Анализ страницы каталога (карточки, навигация, поиск) |
| **🎬 Анализ видео**    | Анализ видео-страницы (плеер, качества, редиректы)    |
| **📋 JSON**            | Копировать полный JSON отчёт                          |
| **⚙️ Config**          | Копировать парсер-конфиг                              |
| **📡 Whitelist**       | Копировать список доменов для Worker                  |

---

## Режимы анализа

### Режим 1: Каталог (🚀)

**Когда:** checkbox 🎬 выключен

**Что делает:**
1. Скачивает HTML страницы каталога
2. Ищет карточки видео (3 алгоритма поиска)
3. Извлекает селекторы (container, link, title, thumbnail, duration)
4. Находит категории, каналы, сортировку
5. Определяет паттерн поиска
6. Проверяет защиту (CF, Age Gate, Referer)
7. Определяет SSR/SPA

**URL для анализа:** главная страница или страница со списком видео

https://site.com/
https://site.com/videos/
https://site.com/latest-updates/


### Режим 2: Видео (🎬)

**Когда:** checkbox 🎬 включён

**Что делает:**
1. Скачивает HTML видео-страницы
2. Анализирует плеер (`<video>`, `<source>`, og:video)
3. Парсит JS-конфиги (kt_player, jwplayer, xvideos-style)
4. Ищет JSON-encodings (dataEncodings, sources)
5. Скачивает и анализирует внешние JS (video*.js)
6. Ищет kt_player.js → анализирует алгоритм decode
7. Определяет redirect-цепочки (/get_file/, signed URLs)
8. Вызывает Worker /resolve для определения финальных URL
9. Строит Quality Map, URL Templates
10. Генерирует Worker Whitelist (включая CDN из resolved chain)

**URL для анализа:** конкретная страница с видео

https://site.com/videos/some-video-title/
https://site.com/watch/12345/


### Режим 3: Каталог + Видео (полный)

**Порядок действий:**
1. Вставить URL каталога → нажать 🚀
2. Включить 🎬 → вставить URL видео → нажать 🎬
3. Результаты объединяются — Config содержит ВСЁ

Индикатор внизу покажет:
- `📦 Каталог ✓` — сделан только каталог
- `📦 Каталог + 🎬 Видео → полный Config` — объединены оба

### Режим 4: Тест (🧪)

**Когда:** Транспорт = "🧪 Тест без прокси"

**Что делает:** быстрая проверка — можно ли анализировать сайт:
- Direct fetch работает?
- SSR рендеринг есть?
- Карточки находятся?
- Cloudflare блокирует?
- KVS engine?

---

## Пошаговая инструкция

### Шаг 1: Настроить Worker


Вставить URL Worker в поле ⚡ Worker
Зелёный значок ✦ = Worker настроен
Worker сохраняется в localStorage
shell

Копировать код

### Шаг 2: Анализ каталога


Вставить URL каталога: https://site.com/
Ввести тестовое слово для поиска (или оставить "wife")
Транспорт: Авто
Нажать 🚀 Анализ каталога
Дождаться 100% прогресса
shell


### Шаг 3: Анализ видео


Включить чекбокс 🎬 Видео
Вставить URL видео-страницы
Нажать 🎬 Анализ видео
Дождаться 100%
shell


### Шаг 4: Забрать результаты


Вкладка "🏗️ Архитектура" — визуальный отчёт
Кнопка "⚙️ Config" — копировать конфиг
Кнопка "📡 Whitelist" — копировать домены для Worker
Кнопка "📋 JSON" — полный дамп
bash


---

## Вкладки результатов

### 🏗️ Архитектура

Визуальный отчёт со всеми блоками:

| Блок               | Содержимое                                                 |
| ------------------ | ---------------------------------------------------------- |
| 🧪 Совместимость    | SSR, Cards, Video URLs, Redirect, KVS, CF, DRM, Age        |
| 📡 Worker Whitelist | Домены + готовый код ALLOWED_TARGETS                       |
| 🔄 Redirect Chain   | Паттерны, KVS маркеры, resolved URLs с визуальной цепочкой |
| 🎬 Quality Map      | Таблица: качество → URL → source → method → domain         |
| 🔗 Parser Flow      | Визуальная цепочка: Catalog → Card → Video                 |
| 📐 URL Templates    | Шаблоны видео-URL с переменными                            |
| 🎮 JS Player        | Тип плеера, regex для извлечения                           |
| 🔑 kt_player Decode | license_code, алгоритм, готовый JS-код декодера            |
| 📜 External JS      | Внешние скрипты с видео-данными                            |
| 🔞 Age Gate         | Тип, cookie, обход                                         |
| 🔧 Stack            | Рекомендация: метод, инструменты, транспорт                |
| 🗺️ URL Scheme       | Поиск, категории, каналы, сортировка, пагинация            |
| 🎯 Card Selectors   | CSS-селекторы для каждого поля карточки                    |
| 📑 Sample Cards     | Реальные данные из первых карточек                         |
| ✅ Summary          | Краткая сводка всех находок                                |

### ⚙️ Config

JSON-конфиг для парсера с подсветкой синтаксиса.

### JSON

Полный JSON-отчёт с подсветкой.

### Raw

Сырой JSON для копирования.

---

## Структура JSON

Полный JSON-отчёт (режим catalog+video):

```json
{
  "_meta": {
    "analyzedUrl": "https://site.com/",
    "baseUrl": "https://site.com",
    "analyzedAt": "2025-07-03T...",
    "mode": "catalog+video",
    "testWord": "wife",
    "tool": "v4.2.1",
    "videoPageUrl": "https://site.com/videos/xxx/"
  },

  "encoding": { "charset": "UTF-8" },

  "mainPagePaths": ["/", "/latest-updates/"],

  "searchPattern": {
    "paramName": "q",
    "pattern": "https://site.com/?q={query}",
    "formAction": "/search/",
    "method": "GET"
  },

  "searchExamples": [
    { "label": "Search: wife", "url": "https://site.com/?q=wife" }
  ],

  "videoCards": {
    "found": true,
    "cardSelector": ".video-item",
    "totalCardsFound": 32,
    "cardSelectors": {
      "container": ".video-item",
      "link": ".video-item a[href*='/videos/']",
      "title": ".video-item .title",
      "thumbnail": ".video-item img",
      "thumbnailAttr": "data-src",
      "duration": ".video-item .duration"
    },
    "linkPattern": "/videos/{slug}/",
    "sampleCards": [
      {
        "title": "Some Video Title",
        "link": "https://site.com/videos/some-video/",
        "thumbnail": "https://cdn.site.com/thumbs/123.jpg",
        "duration": "12:34"
      }
    ]
  },

  "navigation": {
    "categories": {
      "merged": [
        { "name": "Amateur", "slug": "amateur" }
      ],
      "totalCount": 45
    },
    "channels": { "merged": [], "totalCount": 0 },
    "sorting": {
      "fromJs": [
        { "label": "newest", "param": "sort=newest" }
      ]
    }
  },

  "architecture": {
    "jsRequired": "no",
    "frameworks": ["jQuery"],
    "recommendation": {
      "method": "CSS+XPath",
      "tools": "Cheerio",
      "transport": "Worker"
    }
  },

  "videoPage": {
    "url": "https://site.com/videos/xxx/",
    "title": "Some Video Title",
    "player": "videojs",
    "qualityMap": {
      "480p": { "url": "...", "source": "js-config", "method": "kt_player", "domain": "..." },
      "720p": { "url": "...", "source": "js-config", "method": "kt_player", "domain": "..." }
    },
    "videoUrlTemplates": [
      { "template": "https://.../get_file/{id}/{hash}/_{quality}.mp4/", "variables": ["{id}", "{hash}", "{quality}"] }
    ],
    "jsConfigs": [
      { "type": "kt_player", "fields": [...], "regex": "video_url\\s*[:=]..." }
    ],
    "redirectChain": {
      "hasRedirect": true,
      "requiresFollow": true,
      "getFilePattern": true,
      "patterns": [
        { "type": "kvs_get_file", "workerMode": "follow" }
      ]
    },
    "kvsEngine": {
      "isKvs": true,
      "confidence": 0.8,
      "markers": {
        "getFile": true, "flashvars": true, "videoUrl": true,
        "videoAlt": true, "licenseCode": true, "ktPlayer": true
      }
    },
    "redirectResolution": [
      {
        "original": "https://site.com/get_file/6/abc.../video.mp4/",
        "final": "https://nvms2.cdn.example.com/.../video.mp4?sign=...",
        "chain": ["url1", "url2", "url3"],
        "redirectCount": 2,
        "contentType": "video/mp4",
        "resumable": true
      }
    ]
  },

  "protection": {
    "cloudflare": false,
    "ageGate": { "detected": true, "type": "cookie-flag", "cookieName": "age_verified" },
    "requiredHeaders": { "Cookie": "age_verified=1" }
  },

  "workerWhitelist": {
    "required": [
      { "domain": "site.com", "role": "site" },
      { "domain": "cdn.example.com", "role": "CDN (chain)" },
      { "domain": "nvms2.cdn.example.com", "role": "CDN (resolved)" }
    ]
  },

  "compatibility": [
    { "key": "ssr", "icon": "✅", "label": "SSR", "status": "ok" },
    { "key": "redir", "icon": "⚠️", "label": "Redirect chain", "status": "warn" }
  ],

  "parserConfig": { "..." : "см. ниже" }
}

Структура Config
Config — выжимка из JSON, готовая для вставки в парсер:

json

Копировать код
{
  "HOST": "https://site.com",
  "NAME": "site",
  "mainPagePath": "/",

  "SEARCH_PARAM": "q",
  "searchPattern": "https://site.com/?q={query}",

  "CATEGORIES": [
    { "title": "Amateur", "slug": "amateur" }
  ],
  "SORT_OPTIONS": [
    { "label": "newest", "value": "newest" }
  ],

  "CARD_SELECTORS": {
    "container": ".video-item",
    "link": ".video-item a[href*='/videos/']",
    "title": ".video-item .title",
    "thumbnail": ".video-item img",
    "thumbnailAttr": "data-src",
    "duration": ".video-item .duration"
  },

  "QUALITY_MAP": {
    "480p": { "url": "...", "source": "js-config", "method": "kt_player" },
    "720p": { "url": "...", "source": "js-config", "method": "kt_player" }
  },

  "VIDEO_RULES": [
    { "type": "kt_player", "regex": "video_url\\s*[:=]..." }
  ],

  "REDIRECT": {
    "mode": "follow",
    "maxRedirects": 5,
    "engine": "KVS",
    "kvsConfidence": 0.8,
    "note": "Worker must follow 302 redirects for video URLs"
  },

  "REDIRECT_RESOLVED": [
    {
      "original": "https://site.com/get_file/...",
      "final": "https://nvms2.cdn.example.com/...",
      "hops": 2,
      "resumable": true
    }
  ],

  "KT_DECODE": {
    "licenseCode": "347FF8w0w862$",
    "algorithm": "license_code.substr(i,1) → parseInt → % 9 → shift(forward)",
    "chunkSize": 1,
    "modulo": 9,
    "direction": "forward",
    "decodeSnippet": "function decodeVideoUrl(hash, licenseCode) { ... }"
  },

  "REQUIRED_HEADERS": {
    "Cookie": "age_verified=1",
    "Referer": "https://site.com/"
  },

  "WORKER_WHITELIST": [
    "site.com",
    "cdn.example.com",
    "nvms2.cdn.example.com"
  ]
}

Redirect Chain и KVS
Что такое KVS
KVS (Kernel Video Sharing) — популярный движок для видео-сайтов.

Признаки KVS:

URL видео содержат /get_file/{id}/{hash}/
Плеер: kt_player
JS-переменные: video_url, video_alt_url, license_code
Проблема редиректов
KVS-сайты не отдают видео напрямую:

bash

Копировать код
Шаг 1: https://site.com/get_file/6/abc123/video_720p.mp4/
        ↓ 302
Шаг 2: https://cdn.privatehost.com/.../video.mp4?sign=xxx
        ↓ 302
Шаг 3: https://nvms2.cdn.privatehost.com/.../video.mp4?sign=xxx
        ✅ 200 OK — video/mp4

Как анализатор определяет
detectRedirectPattern() — ищет паттерны в video URL
detectKvsEngine() — 7 маркеров с confidence score
resolveRedirectChain() — вызывает Worker /resolve
Что нужно в Worker
Worker должен поддерживать /resolve endpoint:

bash

Копировать код
GET /resolve?url=https://site.com/get_file/6/abc.../video.mp4/

Response:
{
  "original": "...",
  "final": "https://nvms2.cdn.example.com/.../video.mp4?sign=...",
  "redirects": 2,
  "chain": ["url1", "url2", "url3"],
  "contentType": "video/mp4",
  "resumable": true
}

kt_player и license_code
Что это
kt_player использует обфускацию video URL. Для декодирования нужен license_code.

Как анализатор работает
extractLicenseCode() — ищет license_code в HTML/JS
detectKtPlayerScript() — находит URL kt_player.js
analyzeKtDecodeFunction() — парсит алгоритм из JS
buildKtDecodeSnippet() — генерирует готовый decode-код
Сгенерированный decode
javascript
Выполнить код

Копировать код
function decodeVideoUrl(hash, licenseCode) {
  licenseCode = licenseCode || "347FF8w0w862$";
  var codes = [];
  for (var i = 0; i < licenseCode.length; i += 1) {
    codes.push(parseInt(licenseCode.substr(i, 1)) % 9);
  }
  var decoded = '';
  for (var j = 0; j < hash.length; j++) {
    decoded += String.fromCharCode(hash.charCodeAt(j) - codes[j % codes.length]);
  }
  return decoded;
}


Worker Whitelist
Анализатор автоматически собирает все домены для Worker:

Источник	Роль
URL каталога	site — основной сайт
Quality Map	video — домен видео-файлов
Thumbnails	thumb CDN — миниатюры
Redirect chain	CDN (chain) — промежуточные
Resolved final	CDN (resolved) — финальный CDN
Результат:

javascript
Выполнить код

Копировать код
const ALLOWED_TARGETS = [
  "www.hdtube.porn",           // site
  "cdn.privatehost.com",       // CDN (chain)
  "nvms2.cdn.privatehost.com", // CDN (resolved)
];


Примеры использования
Простой сайт
makefile

Копировать код
URL: https://simplesite.com/
Результат: Cards ✅, Video ✅ 720p/480p, Redirect: нет

KVS-сайт с редиректами
makefile

Копировать код
URL: https://www.hdtube.porn/
Результат: Cards ✅, KVS 80%, Redirect 2 hops, KT Decode ✅
Whitelist: site + cdn.privatehost.com + nvms2.cdn.privatehost.com

Сайт с Cloudflare
makefile

Копировать код
URL: https://cf-protected.com/
Результат: ❌ CF Turnstile → Headless / Puppeteer

Ошибки и решения
Ошибка	Причина	Решение
All blocked	CORS + Worker не работает	Проверить Worker URL
W404 / W500	Worker ошибка	Проверить деплой Worker
Empty	SPA, JS-rendered	Сайт требует Headless
Cards: not found	Нестандартная вёрстка	Проверить через DevTools
Worker /resolve not available	Worker без /resolve	Добавить endpoint
KT: ❌ not found	kt_player.js не найден	Проверить URL вручную
Changelog
v4.2.1 (текущая)
🔄 Redirect Chain Detection
🏭 KVS Engine Detection (7 маркеров)
📡 Worker /resolve support
🔑 kt_player Decode (auto-generate decode function)
📡 Whitelist auto-expand (resolved CDN domains)
Config: REDIRECT, REDIRECT_RESOLVED, KT_DECODE
Визуальная цепочка 302 → 302 → 200
KVS маркеры (✓/✗)
Direct test: KVS + /get_file/ проверка
v4.2.0
Card detection v2 (aggressive fallbacks)
mainPagePath, searchPattern, sampleCards
Clean JSON (no duplicates)
v4.1.x
Quality Map, URL Templates
External JS analysis
Worker Whitelist, Parser Flow
Age Gate detection
Лицензия
Свободное использование для создания парсеров Lampa.