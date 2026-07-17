# SakhaTube — проектный гайд

> Дополняет глобальный `~/.claude/CLAUDE.md` (железные правила, пайплайн, субагенты) — он действует всегда.
> Это **не клиентский проект агентства**, это собственный продукт Игоря. Разработка до этого велась через Codex CLI — история коммитов и вся документация ниже это отражают.

---

## ЧТО ЭТО

SakhaTube — видеостриминговая платформа (RU / EN / саха тыла), запуск ориентирован на 14.07.2026 (см. `SAKHATUBE_DELIVERY_ROADMAP.md`). Фокус — просмотр без принудительной регистрации + полноценная CMS (Studio) для контента.

- **GitHub:** `github.com/AnisimovRog1/sakhatube` (public), аккаунт `AnisimovRog1`
- **Локально:** `~/Documents/SakhaTube` — это единственный рабочий чекаут, `git remote origin` совпадает с GitHub, ветка `main`.
- ⚠️ Есть похожая по имени папка `~/Desktop/Clients/SakhaTube` — это НЕ этот проект, а пустой scaffold агентского шаблона (`_starter`), несвязанная git-история, нет ни строчки реального кода. Игнорировать её при работе над SakhaTube.
- Xcode (`apps/ios`) и Android Studio (`apps/android`) собирают проект именно из этой папки — DerivedData/build-артефакты на это указывают.

---

## РЕАЛЬНЫЙ СТЕК (не путать с эталонным стеком агентства — тут другой)

- **Веб-фронт:** ванильные `index.html` / `app.js` / `styles.css`, без сборщика и фреймворка.
- **Studio (админка):** отдельные `admin.html` / `admin.js` / `admin.css`. Есть локальный demo-режим (in-memory) и серверный режим с реальной авторизацией.
- **Backend:** Node.js 22 + **Fastify 5** (`server/app.js`, `server/index.js`) — НЕ Express, глобальное правило про Express 4 тут неприменимо. Плагины: `@fastify/jwt`, `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`, `@fastify/multipart`, `@fastify/static`.
- **БД:** PostgreSQL через `server/postgres-store.js` (свой адаптер, без ORM). Демо-режим — in-memory (`server/media-store.js`), включается флагом `ALLOW_DEMO_STORE`, только для Railway preview.
- **Auth:** Firebase Auth (`firebase-admin`, `firebase-auth.js`) + `@fastify/jwt` на бэкенде.
- **Медиа:** `@aws-sdk/client-s3` (S3-совместимое хранилище) + `ffmpeg-static`/`ffprobe`. Отдельный **worker-сервис** (`worker/`, свой `package.json`/Dockerfile) — приватный процессинг HLS-рендишенов, забирает `incoming/.../source.*`, никогда не отдаёт публичные ссылки напрямую (см. `worker/README.md` — там прямо прописаны инварианты, не нарушать).
- **iOS:** нативный SwiftUI, `apps/ios/SakhaTube.xcodeproj`.
- **Android:** нативный Kotlin + Jetpack Compose, `apps/android`.
- **Деплой:** Railway, `Dockerfile`-based build, healthcheck `GET /health`.
- **CI:** `.github/workflows/quality.yml` — на каждый push/PR в main гоняет: `npm run test:api`, синтаксис-чек `server/app.js` и `server/postgres-store.js`, `npm --prefix worker test`, валидацию `release/store-submission-checklist.json`, debug-сборки Android (`assembleDebug`, `compileSdk 36`) и iOS (`xcodebuild ... Debug -sdk iphonesimulator`, без подписи).

---

## ЗАПУСК / ТЕСТЫ

```bash
# Веб-фронт — просто открыть index.html (без зависимостей)
# API
npm install
cp .env.example .env      # заполнить перед первым запуском
npm run dev:api           # node --watch server/index.js
npm run test:api          # node --test test/*.test.js

# Worker
npm --prefix worker install
npm --prefix worker test
```

---

## СТАДИЯ ПРОЕКТА (пересмотрено 17.07.2026 по итогам полного аудита кода — 4 параллельных прохода по всей кодовой базе)

**Реальная готовность «показать живое видео платящему юзеру» ~35-45%** (не 70%, как считали доки изначально — см. `.vault`/чат с аудитом). Бизнес-готовность ~30% подтверждена аудитом.

Код необычно дисциплинирован (параметризованный SQL, RBAC на каждом роуте, честный fail-closed биллинг, 38 тестов), но покрывает преимущественно auth/RBAC/безопасность/приватность — не само видео и не сами деньги. **Медиа-воркер (`worker/src/runner.mjs`) — пустой каркас, ffmpeg нигде реально не вызывается**; единственный играющий контент (демо CC-клипы) собран офлайн-скриптами в обход всего заявленного pipeline. Studio-админка не имеет production-логина для сотрудников (только dev-токен, выключен в проде).

- Фаза 1 (веб-прототип) — почти готова: карусель, каталог, «For You», офлайн, профиль, поиск, плеер. Остались: страницы сериалов, экраны покупки, error/empty states, полная a11y и локализация на 3 языках.
- Фаза 2 (продакшн Studio) — частично: интерактивный прототип есть, но без реальной auth/ролей/publishing workflow/аудит-лога.
- Фаза 3 (бэкенд-инфра) — частично: локальный API с in-memory storage работает, но Postgres/Redis в проде, HLS-пайплайн и CDN — не развёрнуты полностью.
- iOS/Android клиенты технически рабочие (HTTPS API, HLS playback), но: bundle ID не зарегистрирован, нет сборок с подписью, Apple/Google billing не подключены на сервере (покупки не открывают контент по-настоящему).
- **Блокеры до паблика:** юрлицо + реальный контент-каталог (сейчас demo-материалы), платежи end-to-end, подпись мобильных сборок, media pipeline (антивирус/транскодинг/QC), финализация юртекстов и store-метаданных (App Privacy / Data Safety).

Подробности по каждому пункту — в соответствующем `SAKHATUBE_*.md` в корне репо, не дублировать их содержимое сюда.

---

## КЛЮЧЕВЫЕ ДОКИ (читать по месту, не пересказывать)

- `SAKHATUBE_PRODUCT_BLUEPRINT.md` — продуктовое видение
- `SAKHATUBE_DELIVERY_ROADMAP.md` — фазы, статусы, критерии готовности
- `SAKHATUBE_ADMIN_BACKEND_SPEC.md` — спека Studio/админки
- `SAKHATUBE_BILLING_ENTITLEMENT_CONTRACT.md` — контракт биллинга/энтайтлментов
- `SAKHATUBE_MEDIA_UPLOAD_SETUP.md`, `FIREBASE_NATIVE_SETUP.md` — сетап медиа и Firebase на нативных клиентах
- `SAKHATUBE_STORE_READINESS.md` — чеклист готовности к сторам
- `SAKHATUBE_LOCALIZATION.md` — локализация RU/EN/sah
- `release/STORE_SUBMISSION_PACK.md`, `release/store-submission-checklist.json` — пакет на сабмишн

---

## GOTCHAS

- `.env` обязателен для API (`.env.example` → `.env`), в проде — `DATABASE_URL` (Postgres), `JWT_SECRET` длинный и случайный, `ALLOW_DEMO_STORE=false`.
- Секреты, которые **никогда** не должны попасть в git (уже в `.gitignore`, но проверять при коммитах): `apps/android/app/google-services.json`, `apps/ios/SakhaTube/GoogleService-Info.plist`, `.env*` (кроме `.env.example`).
- В `~/Downloads` лежит `sakhatube-auth-firebase-adminsdk-*.json` (Firebase Admin SDK service account key) — это чувствительный серверный секрет, не для git, не для случайного вывода в чат/логи.
- `worker/` — приватный сервис, не веб-сервер, не должен создавать публичные ссылки/ACL — инварианты см. `worker/README.md`.
- `compileSdk 36` для Android — намеренно, CI ставит нужный SDK явно, не понижать без причины.

---

## VAULT

`.vault/` — только что создан, пустой каркас (перенесён из шаблона). Реальным содержимым (architecture/database/flows/api_endpoints/gotchas) пока не заполнен — заполнять по мере работы, крупные записи подтверждать с Игорем.
