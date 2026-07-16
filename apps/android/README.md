# SakhaTube for Android

Нативный каркас на Kotlin и Jetpack Compose для Google Play. Он читает только публичный каталог SakhaTube и намеренно **не** содержит фальшивых входа, подписок, платежей, трекеров или персонализации.

## Что уже есть

- `compileSdk` и `targetSdk` 36, `minSdk` 26;
- публичный `GET /v1/catalog/home` по HTTPS;
- только опубликованные карточки из API;
- понятные состояния загрузки, пустого каталога и ошибки с повтором;
- адаптивная сетка каталога для телефона и широких экранов;
- профиль гостя с местами для ссылок на политику, условия и удаление аккаунта;
- серверная основа viewer-auth уже есть; Android пока остаётся в гостевом режиме,
  пока не будет добавлен проверенный нативный вход и защищённое хранение сессии;
- запрет cleartext-трафика, системное хранилище сертификатов и отключённые резервные копии;
- нет разрешений, кроме `INTERNET`; нет SDK аналитики и рекламы;
- безопасный Google Play Billing-каркас: по умолчанию платежи выключены, а
  приложение никогда не выдаёт доступ локально.

## Настройка адресов

По умолчанию каталог берётся с Railway production API. Для другой среды или релизных юридических страниц передайте Gradle-свойства:

```bash
./gradlew :app:assembleDebug \
  -PSAKHATUBE_CATALOG_BASE_URL=https://api.example.com \
  -PSAKHATUBE_PRIVACY_URL=https://example.com/privacy \
  -PSAKHATUBE_TERMS_URL=https://example.com/terms \
  -PSAKHATUBE_ACCOUNT_DELETION_URL=https://example.com/delete-account
```

По умолчанию используются публичные HTTPS-страницы SakhaTube на Railway. Перед выпуском в магазины их необходимо заменить на домен юридического оператора и сверить текст с фактическими данными, SDK и сроками хранения.

## Сборка

Нужны JDK 17 и Android SDK Platform 36. В проект уже добавлен Gradle Wrapper 8.11.1:

```bash
cd apps/android
./gradlew :app:assembleDebug
```

Файл для загрузки в Google Play создаётся так:

```bash
cd apps/android
./gradlew :app:bundleRelease
```

Перед `bundleRelease` обязательно задайте уникальный `applicationId`, release signing/Play App Signing, реальные ссылки документов и пройдите закрытое тестирование. Этот каркас не является готовой к публикации подписочной видеоплатформой: до релиза ещё нужны viewer-auth, удаление аккаунта на сервере, HLS entitlement, Google Play Billing с серверной проверкой и UGC report/block, если запускаются комментарии.

## Google Play Billing

По умолчанию кнопка оплаты намеренно заблокирована. Включать её можно только
одновременно с серверной проверкой purchase token через Google Play Developer
API и серверной выдачей entitlement. До этого приложение не признаёт покупку
или восстановленную покупку доступом к видео.

После реализации серверной проверки и переключения защищённого флага в коде
задаются только в release-конфигурации:

```bash
./gradlew :app:bundleRelease \
  -PSAKHATUBE_PLAY_SUBSCRIPTION_PRODUCT_ID=sakhatube_monthly \
  -PSAKHATUBE_PLAY_BILLING_ENABLED=true \
  -PSAKHATUBE_PLAY_BILLING_SERVER_VERIFICATION_ENABLED=true
```

Эти флаги сами по себе ничего не открывают: в исходниках есть дополнительный
fail-closed предохранитель. Нужен отдельный серверный endpoint для отправки и
проверки purchase token и серверная выдача доступа; пока этого нет, приложение
не запустит оплату и не выдаст доступ.

## Подключение аккаунта зрителя

Сервер уже предоставляет базовые `POST /v1/auth/register`, `POST /v1/auth/login`
и `GET /v1/auth/me`. Android-приложение намеренно остаётся в гостевом режиме,
пока не добавлен полноценный экран входа, подтверждение e-mail и отзыв/ротация
сессии. Оно не имитирует вход и не сохраняет пароли либо токены. Полный безопасный
контракт зафиксирован в [AUTH_INTEGRATION.md](AUTH_INTEGRATION.md). После его завершения нужно хранить
только короткоживущую сессию в Android Keystore/EncryptedSharedPreferences,
никогда не хранить пароль, и очищать сессию при выходе, смене аккаунта и отказе
сервера в refresh.
