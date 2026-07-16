# SakhaTube — готовность к App Store и Google Play

Дата проверки: 15 июля 2026. Это рабочий контрольный список: он фиксирует реальное состояние проекта, а не обещает автоматическое одобрение. Решение о выпуске всегда принимают Apple и Google по фактическому бинарнику, метаданным и каталогу.

Для команды релиза подготовлен отдельный [пакет подачи в сторы](release/STORE_SUBMISSION_PACK.md): поля карточек, матрица скриншотов, карта данных и порядок выдачи reviewer access. Он намеренно не содержит секретов и не заменяет реальные юридические/сторные данные.

## Что уже сделано

| Область | Состояние | Доказательство / результат |
| --- | --- | --- |
| iOS-основа | Готова к следующему этапу | SwiftUI-клиент, Release использует HTTPS production API, добавлены App Icon и `PrivacyInfo.xcprivacy`. |
| Android-основа | Готова к сборке | Kotlin + Compose, `targetSdk 36`, HTTPS-only, guest catalogue, adaptive UI, adaptive icon, нет трекеров и лишних разрешений; добавлен Gradle Wrapper 8.11.1. |
| Legal URL | Есть | Публичные `/privacy`, `/terms`, `/community-rules`, `/support`, `/delete-account` и формы обращений. |
| Права на контент | Защищено на сервере | Публикация требует возраст, основание прав, правообладателя, документ, территории, сроки, языки и юридическое подтверждение. |
| Защита витрины | Есть | Public API не выдаёт внутренние номера договоров, правообладателя и данные проверки. В production демо-материал не попадёт в каталог. |
| Безопасная публикация | Есть | Статусы: черновик → проверка → юридическое подтверждение → публикация. При истечении прав отложенный выход автоматически блокируется. |
| Защита платного каталога | Есть | В production подписка и разовая покупка скрыты, пока явно не включён проверенный платёжный контур. Это не заменяет StoreKit и Google Play Billing. |
| Viewer-auth | Подготовлен | Регистрация создаёт неподтверждённый аккаунт; сессия появляется только после одноразового e-mail подтверждения. Токен хранится только как хеш, а в production не возвращается API. |
| Тесты API | Пройдены | Тесты покрывают права, публикацию, подтверждённое удаление и e-mail, почтовую доставку, PII в обращениях, multipart-upload, rate limit и demo-media. |
| Автоматическая проверка | Готова | GitHub Actions запускает API-тесты и проверку server/legal/release-файлов на каждый push и pull request. |

## Блокеры перед загрузкой в сторы

### 1. Реальный контент и юридический оператор

- [ ] Внести юридическое лицо/ИП, страну, privacy e-mail, support e-mail и процессоров данных в тексты legal-страниц.
- [ ] Утвердить реальные сроки хранения логов, обращений, покупок и аналитики; добавить автоматическую очистку по этим срокам.
- [ ] Для каждого коммерческого видео приложить реальный договор/лицензию, территорию и срок. `demo` не является коммерческим основанием.
- [ ] Перед релизом заменить Railway legal URL на HTTPS-домен юридического оператора.

### 2. Аккаунты, удаление и приватность

- [x] Добавить viewer-auth с защищёнными сессиями и обязательным подтверждением e-mail.
- [x] Веб-запрос на удаление требует одноразового подтверждения; токен хранится только как хеш и не возвращается в production.
- [x] Подготовлена безопасная доставка одноразовой ссылки через Railway secret `MAILER_WEBHOOK_URL` (и, при необходимости, `MAILER_WEBHOOK_BEARER_TOKEN`); production не примет запрос без этой настройки.
- [ ] Подключить выбранный почтовый сервис, секреты `EMAIL_VERIFICATION_SECRET` / `MAILER_WEBHOOK_URL` и домен отправителя на Railway; затем добавить регистрацию, вход и удаление аккаунта в iOS и Android.
- [ ] Описать фактические данные в Apple App Privacy и Google Data safety после подключения всех SDK/серверных событий.
- [ ] Передать legal-тексты юристу: текущие страницы — честная техническая основа, но не заменяют юридическую экспертизу.

### 3. Видео и доступ

- [ ] Построить pipeline: private upload → antivirus/probe → transcode → HLS/CMAF → poster/subtitles → QC → publish.
- [ ] Подключить AVPlayer/Media3 к настоящему HLS и проверке entitlement до выдачи манифеста/сегментов.
- [ ] Сделать отдельную обработку вертикальных 9:16 Shorts и измерять first frame / buffer rate на реальных устройствах.
- [ ] Использовать короткоживущие CDN tokens или DRM для премиального каталога.

### 4. Деньги

- [ ] Настроить продукты в App Store Connect и Play Console.
- [ ] Реализовать StoreKit 2 и Google Play Billing: покупка, автопродление, отмена, restore purchases.
- [ ] Добавить серверную проверку Apple JWS / App Store Server Notifications и Google Play Developer API / RTDN.
- [ ] Выдавать право просмотра только сервером после валидации магазина.

Точный будущий контракт событий, валидации и fail-closed поведения: [SAKHATUBE_BILLING_ENTITLEMENT_CONTRACT.md](SAKHATUBE_BILLING_ENTITLEMENT_CONTRACT.md). Сейчас это не интеграция: включение одной переменной не открывает платный каталог.

### 5. Нативная поставка и безопасность

- [ ] Настроить Android release signing через secrets и Play App Signing; проверить, что `com.sakhatube.app` свободен до первого AAB.
- [ ] Выбрать Apple Team, зарегистрировать bundle ID, создать signing и реальный archive/TestFlight build.
- [ ] Подключить OIDC + MFA для сотрудников Studio, ротацию сессий, Redis/WAF, резервные копии и тест восстановления.
- [ ] Прогнать iOS/Android на реальных устройствах, плохой сети, офлайн-сценариях и accessibility.

### 6. Комментарии и пользовательский контент

Не включать публичные комментарии, пока не готовы:

- [ ] жалоба рядом с материалом и комментарием;
- [ ] блокировка пользователя и антиспам;
- [ ] очередь модерации, Community Rules, канал эскалации и сроки реакции.

## Очередность до релиза

1. Внести реальные реквизиты оператора и получить права на первый каталог.
2. Закрыть media pipeline + entitlement, затем реальные нативные плееры.
3. Добавить аккаунты/удаление, покупки и серверную валидацию.
4. Подписать iOS/AAB, пройти TestFlight и закрытый Play track.
5. Заполнить App Privacy, Data safety, возрастные анкеты, reviewer access и только после этого отправлять на review.

## Railway: что добавить перед production

Шаблон имён переменных без секретов: [release/railway.env.example](release/railway.env.example). Критично задать `PUBLIC_APP_URL`, `MAILER_WEBHOOK_URL`, сильные `JWT_SECRET` и `DELETION_VERIFICATION_SECRET`. `PAYMENTS_ENABLED` должен оставаться `false`, пока покупки не проверяются сервером.

## Официальные правила

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Apple: App Privacy details](https://developer.apple.com/app-store/app-privacy-details/)
- [Apple: удаление аккаунта](https://developer.apple.com/support/offering-account-deletion-in-your-app/)
- [Google Play: target API](https://developer.android.com/google/play/requirements/target-sdk)
- [Google Play: Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Google Play: account deletion](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en-EN)
- [Google Play: User Generated Content](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en)
