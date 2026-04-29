# 🔍 Site Structure Analyzer v5.0.0

Браузерный инструмент для анализа HTML-структуры веб-сайтов с выводом результатов в JSON.
Работает полностью на клиентской стороне (JavaScript), развёртывается на GitHub Pages.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![GitHub Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-brightgreen)
![No Backend](https://img.shields.io/badge/backend-none-lightgrey)
![Version](https://img.shields.io/badge/version-5.0.0-blue)

---

## 🚀 Что нового в v5.0.0

### Мажорное обновление — полная совместимость с UNIVERSAL_TEMPLATE v1.4.0

| #   | Функция                           | Описание                                                                                                             |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | **S-стратегии (S1-S28)**          | Маппинг всех 28 стратегий шаблона. Вывод `MATCHED_STRATEGIES` и `RECOMMENDED_BLOCK` (1-4 tier)                       |
| 2   | **NAME генератор**                | Автоматическая генерация NAME из HOST по правилу шаблона + готовые строки для menu.json, domainMap, Worker whitelist |
| 3   | **VIDEO_RULES в формате шаблона** | Готовый массив `{label, re, type}` для прямой вставки в парсер                                                       |
| 4   | **buildUrl паттерны**             | Автоопределение URL-форматов: search, category, channel, pagination, sorting                                         |
| 5   | **Расширенная детекция плееров**  | Flowplayer, Plyr, JSON-LD, DASH .mpd, Cloudflare Stream, Flashvars, MediaSource, Lazy video, PostMessage             |
| 6   | **Worker Verdict**                | Чёткий вердикт: нужен ли Worker, для чего (CORS / cookies / redirect / resolve-page / headless)                      |
| 7   | **CDN TTL/Expire**                | Анализ exp_time, sign, tag из CDN URL. Показывает время жизни ссылки и статус expired                                |
| 8   | **Debug Report (14 паттернов)**   | Таблица совпадений с теми же 14 паттернами что проверяет шаблон в debugReport                                        |
| 9   | **cleanUrl правила**              | Расширено: Base64 decode, strip-cache-params (rnd, br, _), strip-function-prefix                                     |
| 10  | **Ранжированные CARD_SELECTORS**  | 20 CSS-селекторов с приоритетом и статусом usable                                                                    |
| 11  | **Кнопка 🔄 Redirect**             | Анализ CDN URL вручную — HEAD через Worker, expire, sign, размер, resumable                                          |
| 12  | **Template Integration**          | Готовые строки для вставки: menu.json, domainMap, ALLOWED_TARGETS                                                    |

---

## 📋 Что анализирует

| #   | Раздел                           | Описание                                                   |
| --- | -------------------------------- | ---------------------------------------------------------- |
| 1   | **Кодировка**                    | UTF-8, windows-1251 и т.д.                                 |
| 2   | **Главная страница и пагинация** | Тип пагинации (?page=N, /page/N/), примеры URL             |
| 3   | **Поиск**                        | URL поиска, формы, параметры                               |
| 4   | **Сортировка**                   | Варианты сортировки (новые, популярные, рейтинг)           |
| 5   | **Категории**                    | Список категорий/тегов с URL                               |
| 6   | **Карточки контента**            | Селекторы названия, ссылки, превью, длительности, качества |
| 7   | **Страница просмотра**           | Источники видео (.mp4, .m3u8), iframe-плееры, конфиги JS   |
| 8   | **Похожий контент**              | Блок "похожие видео" на странице просмотра                 |
| 9   | **S-стратегии**                  | Какие из 28 стратегий шаблона сработают                    |
| 10  | **KVS Engine**                   | Определение KVS-движка, license_code, kt_player decode     |
| 11  | **Redirect Chain**               | /get_file/ → 302 → CDN, resolve через Worker               |
| 12  | **Worker Whitelist**             | Список доменов для ALLOWED_TARGETS                         |
| 13  | **Защита**                       | Cloudflare, DRM, Age Gate, Referer check                   |

---

## 📁 Структура файлов
site-analyzer/
├── index.html      # Интерфейс (3KB)
├── style.css       # Стили (7KB)
├── parser.js       # Ядро анализатора (48KB)
└── README.md       # Документация

---

## 🚀 Быстрый старт

### Вариант 1: Форк (самый быстрый)

1. Нажмите кнопку **Fork** в правом верхнем углу репозитория
2. Перейдите в **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** / **/ (root)**
5. Нажмите **Save**
6. Через 1-2 минуты сайт доступен по адресу:
   `https://YOUR_USERNAME.github.io/site-analyzer/`

### Вариант 2: Локальный запуск

```bash
npx serve .
# или
python -m http.server 8080
# или
php -S localhost:8080

```

Откройте http://localhost:8080 в браузере.

⚠️ Открытие index.html напрямую через file:// может не работать из-за CORS-политик браузера. Используйте локальный сервер.

# 🔧 Настройка Worker
## Для полноценного анализа рекомендуется Cloudflare Worker с эндпоинтами:

Эндпоинт	Назначение
/?url=	CORS-прокси для загрузки страниц
/resolve?url=	Следование по redirect chain (HEAD)
/resolve-page?url=	Загрузка страницы + извлечение video_url + следование по redirect (для KVS)
Worker URL вводится в поле ⚡ Worker на странице анализатора.

# 📊 Система S-стратегий
## Анализатор определяет какие из 28 стратегий извлечения видео (из UNIVERSAL_TEMPLATE) применимы к сайту:

Block	Tier	Стратегии	Сложность
1	⭐ Simple	S1-S7: VIDEO_RULES, direct mp4, og:video, HLS, get_file, source size/label	Regex
2	⭐⭐ Medium	S8-S17: DOMParser, dataEncodings, html5player, flowplayer, KVS, Plyr, JW, Flashvars	DOM + JSON
3	⭐⭐⭐ Complex	S18-S25: JSON-LD, DASH, CF Stream, redirect, PostMessage, JWT, JS object	Multi-step
4	⭐⭐⭐⭐ Heavy	S26-S28: MediaSource, Lazy video, API endpoints	Headless/Worker
В Config выводится RECOMMENDED_BLOCK — минимальный tier достаточный для сайта.

# ⚡ Worker Verdict
Анализатор автоматически определяет нужен ли Worker и для чего:

Mode	Описание
none	Прямой fetch возможен
cors-proxy	Только CORS bypass
follow-redirect	Нужно следовать по 302
resolve-page	KVS: нужен /resolve-page для session-bound URLs
headless	Cloudflare Turnstile — нужен headless browser
impossible	DRM — парсинг невозможен

# 🔄 Кнопка Redirect
Кнопка 🔄 рядом с кнопкой анализа позволяет вручную проанализировать CDN URL (финальную ссылку после редиректа).

## Анализирует:

Domain — CDN сервер
Resumable — поддержка Accept-Ranges
Size — размер файла
Quality — качество из имени файла (_720p)
Expire — время жизни ссылки (exp_time)
Sign — подпись URL
Tag — привязка к сайту
CDN домен автоматически добавляется в Whitelist.

# 🧩 Template Integration
Config содержит готовые строки для интеграции с UNIVERSAL_TEMPLATE:

## json

Копировать код
{
  "_templateIntegration": {
    "menuJson": "{ \"title\": \"hdtube.porn\", \"playlist_url\": \"hdtub\" }",
    "domainMap": "'hdtube.porn': 'hdtub'",
    "workerWhitelist": "'hdtube.porn',"
  }
}

NAME генерируется автоматически по правилу шаблона:

https://hdtube.porn → hdtub
https://pornobriz.com → porno
https://zbporn.com → zbpor

📋 Config Output
Вкладка ⚙️ Config содержит готовый JSON для создания парсера:

## json

Копировать код
{
  "HOST": "https://example.com",
  "NAME": "examp",
  "SITE_NAME": "example.com",
  "BUILD_URL": {
    "search": "https://example.com/?q={query}",
    "category": "https://example.com/category/{slug}",
    "pagination": "?page={N}"
  },
  "CARD_SELECTORS": {
    "container": ".video-item",
    "link": ".video-item a[href*=\"/video/\"]",
    "title": ".video-item .title",
    "thumbnail": ".video-item img",
    "thumbnailAttr": "data-src",
    "duration": ".video-item .duration"
  },
  "VIDEO_RULES": [
    { "label": "480p", "re": "video_url\\s*[:=]...", "type": "kt_player" }
  ],
  "S_STRATEGIES": {
    "matched": [{"s": 1, "name": "VIDEO_RULES", "block": 1}],
    "recommendedBlock": 1
  },
  "WORKER_VERDICT": {
    "required": true,
    "mode": "resolve-page",
    "reasons": [{"reason": "KVS session-bound URLs", "type": "resolve-page"}]
  },
  "WORKER_WHITELIST": ["example.com", "cdn.example.com"]
}

## 🏗️ Архитектура вкладки
Вкладка 🏗️ Архитектура отображает визуальные блоки:

Блок	Описание
🧪 Совместимость	SSR, Cards, Video URLs, Redirect, KVS, CF, DRM, Age Gate
⚡ Worker Verdict	Нужен ли Worker, для чего, какой mode
📊 S-Strategies	Список сработавших стратегий с Block tier
🔍 Debug Report	14 паттернов с количеством совпадений
🎮 Extended Players	Flowplayer, Plyr, JSON-LD, DASH и т.д.
📡 Worker Whitelist	Домены для ALLOWED_TARGETS с ролями
🔄 Redirect Chain	KVS engine, /get_file/, resolved URLs
🔗 CDN Redirect	Анализ CDN URL (expire, sign, size)
🎬 Quality Map	Таблица качеств с URL, source, method
🧩 Template Integration	NAME, menu.json, domainMap строки
🔗 Parser Flow	Визуальная цепочка: Catalog → Card → Video
🔧 buildUrl Patterns	URL-шаблоны для search/cat/sort/pagination
🎮 VIDEO_RULES	Готовый массив для шаблона
🔑 kt_player Decode	license_code, algorithm, decode snippet
🧹 cleanUrl Rules	Правила очистки URL
🗺️ URL Scheme	Полная карта URL сайта
🎯 Card Selectors	CSS-селекторы + ранжированные альтернативы
📑 Sample Cards	Примеры спарсенных карточек
✅ Summary	Итоговая таблица


# 🔄 Changelog
## v5.0.0 (2025-01-XX)
[NEW] S-стратегии S1-S28 маппинг с RECOMMENDED_BLOCK
[NEW] NAME генератор по правилу UNIVERSAL_TEMPLATE
[NEW] Template Integration (menu.json, domainMap, Worker whitelist)
[NEW] VIDEO_RULES в формате шаблона {label, re, type}
[NEW] buildUrl паттерны (search, category, channel, pagination, sorting)
[NEW] Расширенная детекция: Flowplayer, Plyr, JSON-LD, DASH, CF Stream, Flashvars, MediaSource, Lazy video, PostMessage
[NEW] Worker Verdict с причинами и mode
[NEW] CDN TTL/Expire анализ (exp_time, sign, tag)
[NEW] Debug Report — 14 паттернов как в шаблоне
[NEW] cleanUrl правила: Base64, strip-cache-params, strip-function-prefix
[NEW] Ранжированные CARD_SELECTORS (20 селекторов с приоритетом)
[NEW] Кнопка 🔄 Redirect — анализ CDN URL
[UPD] Frameworks detection: +Flowplayer, +Plyr
[UPD] Config: S_STRATEGIES, EXTENDED_PLAYERS, DEBUG_REPORT, WORKER_VERDICT, BUILD_URL
[UPD] genArch: новые визуальные блоки
## v4.2.1
Redirect chain detection
KVS engine detection
/resolve support
license_code + kt_player decode
sampleCards
## v4.0.0
Вкладки Карточки и Видео
Worker integration
CORS auto-detection
## v3.0.0
Первая публичная версия

# 📜 Лицензия
MIT License. Свободное использование, модификация и распространение.
