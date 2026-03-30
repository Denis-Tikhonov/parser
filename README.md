# 🔍 Site Structure Analyzer

Браузерный инструмент для анализа HTML-структуры веб-сайтов с выводом результатов в JSON.
Работает полностью на клиентской стороне (JavaScript), развёртывается на GitHub Pages.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![GitHub Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-brightgreen)
![No Backend](https://img.shields.io/badge/backend-none-lightgrey)

---

## 📋 Что анализирует

| # | Раздел | Описание |
|---|--------|----------|
| 1 | **Кодировка** | UTF-8, windows-1251 и т.д. |
| 2 | **Главная страница и пагинация** | Тип пагинации (?page=N, /page/N/), примеры URL |
| 3 | **Поиск** | URL поиска, формы, параметры |
| 4 | **Сортировка** | Варианты сортировки (новые, популярные, рейтинг) |
| 5 | **Категории** | Список категорий/тегов с URL |
| 6 | **Карточки контента** | Селекторы названия, ссылки, превью, длительности, качества |
| 7 | **Страница просмотра** | Источники видео (.mp4, .m3u8), iframe-плееры, конфиги JS |
| 8 | **Похожий контент** | Блок "похожие видео" на странице просмотра |

---

## 🚀 Быстрый старт

### Вариант 1: Форк (самый быстрый)

1. Нажмите кнопку **Fork** в правом верхнем углу репозитория
2. Перейдите в **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** / **/ (root)**
5. Нажмите **Save**
6. Через 1-2 минуты сайт доступен по адресу: https://ВАШ_ЮЗЕРНЕЙМ.github.io/site-analyzer/

### Вариант 2: Ручное создание

```bash
# Клонируйте или создайте репозиторий
git clone https://github.com/YOUR_USERNAME/site-analyzer.git
cd site-analyzer

# Скопируйте файлы (index.html, style.css, parser.js, README.md)
# ... скопируйте файлы ...

# Запушьте
git add .
git commit -m "Initial commit: Site Structure Analyzer"
git push origin main

Затем включите GitHub Pages (см. раздел «Настройка GitHub Pages»).

### Вариант 3: Локальный запуск

# Любой статический сервер
npx serve .
# или
python -m http.server 8080
# или
php -S localhost:8080
Откройте http://localhost:8080 в браузере.

⚠️ Открытие index.html напрямую через file:// может не работать из-за CORS-политик браузера. Используйте локальный сервер.

