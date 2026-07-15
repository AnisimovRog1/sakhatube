# SakhaTube for Android

Нативный каркас на Kotlin и Jetpack Compose для Google Play. Он читает только публичный каталог SakhaTube и намеренно **не** содержит фальшивых входа, подписок, платежей, трекеров или персонализации.

## Что уже есть

- `compileSdk` и `targetSdk` 36, `minSdk` 26;
- публичный `GET /v1/catalog/home` по HTTPS;
- только опубликованные карточки из API;
- понятные состояния загрузки, пустого каталога и ошибки с повтором;
- адаптивная сетка каталога для телефона и широких экранов;
- профиль гостя с местами для ссылок на политику, условия и удаление аккаунта;
- запрет cleartext-трафика, системное хранилище сертификатов и отключённые резервные копии;
- нет разрешений, кроме `INTERNET`; нет SDK аналитики и рекламы.

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
