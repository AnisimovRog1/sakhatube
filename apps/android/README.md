# SakhaTube for Android

Нативный каркас на Kotlin и Jetpack Compose для Google Play. Он читает только публичный каталог SakhaTube и намеренно **не** содержит фальшивых входа, подписок, платежей, трекеров или персонализации.

## Что уже есть

- `compileSdk` и `targetSdk` 36, `minSdk` 26;
- публичный `GET /v1/catalog/home` по HTTPS;
- только опубликованные карточки из API;
- понятные состояния загрузки, пустого каталога и ошибки с повтором;
- адаптивная сетка каталога для телефона и широких экранов;
- профиль гостя с местами для ссылок на политику, условия и удаление аккаунта;
- нативный вход Firebase Email/Password и защищённое Keystore-хранилище сессии
  реализованы, но остаются выключенными до добавления официального
  `google-services.json` и серверного Firebase Admin config;
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

Нужны JDK 17 и Android SDK Platform 36 + Build-Tools 36.0.0. В проект уже
добавлен Gradle Wrapper 8.11.1. Если на машине их ещё нет (Android Studio не
ставили) — можно поставить локально, без Homebrew/sudo, только под этот проект:

```bash
# JDK 17 (Temurin), без системной установки
curl -sL "https://api.adoptium.net/v3/binary/latest/17/ga/mac/aarch64/jdk/hotspot/normal/eclipse" \
  -o /tmp/temurin17.tar.gz
mkdir -p ../../.tools && tar xzf /tmp/temurin17.tar.gz -C ../../.tools
export JAVA_HOME="$(pwd)/../../.tools/jdk-17*/Contents/Home"

# Android SDK cmdline-tools + platform 36 + build-tools 36.0.0
curl -sL "https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip" -o /tmp/cmdline-tools.zip
mkdir -p ../../.tools/android-sdk/cmdline-tools && unzip -q /tmp/cmdline-tools.zip -d ../../.tools/android-sdk/cmdline-tools
mv ../../.tools/android-sdk/cmdline-tools/cmdline-tools ../../.tools/android-sdk/cmdline-tools/latest
export ANDROID_HOME="$(pwd)/../../.tools/android-sdk"
yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --sdk_root="$ANDROID_HOME" \
  "platform-tools" "platforms;android-36" "build-tools;36.0.0"
echo "sdk.dir=$ANDROID_HOME" > local.properties

./gradlew :app:assembleDebug
```

`../../.tools/` is gitignored — this never touches system Java/Android Studio.

Файл для загрузки в Google Play создаётся так:

```bash
cd apps/android
./gradlew :app:bundleRelease
```

Перед `bundleRelease` добавьте официальный `app/google-services.json`: без него
сборка намеренно остановится (проверено `preReleaseBuild`). Release signing
(`app/build.gradle.kts`'s `signingConfigs`) is wired to `keystore/keystore.properties`,
also checked by `preReleaseBuild`; see "Подпись релиза" below для генерации.
Затем — реальные ссылки документов и закрытое тестирование. Этот каркас не
является готовой к публикации подписочной видеоплатформой: до релиза ещё нужны
Firebase Admin на сервере, проверка удаления аккаунта, HLS entitlement, Google
Play Billing с серверной проверкой и UGC report/block, если запускаются
комментарии.

## Подпись релиза

`keystore/` не коммитится (см. `.gitignore`). Сгенерировать upload-keystore один раз:

```bash
cd apps/android
mkdir -p keystore
keytool -genkeypair -v -keystore keystore/upload-keystore.jks -alias sakhatube-upload \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=SakhaTube, OU=Engineering, O=SakhaTube, L=Yakutsk, ST=Sakha, C=RU"
cat > keystore/keystore.properties <<EOF
keystore.storePassword=<пароль, который ввёл keytool>
keystore.keyPassword=<тот же пароль — PKCS12 не поддерживает разные>
keystore.keyAlias=sakhatube-upload
keystore.file=keystore/upload-keystore.jks
EOF
```

⚠️ **Уже сгенерирован на машине Игоря** (`~/Documents/SakhaTube/apps/android/keystore/`,
17.07.2026) — не существует больше нигде. Обязательно скопировать
`upload-keystore.jks` и `keystore.properties` в менеджер паролей/защищённое
облако до переустановки/потери этого Мака. При создании приложения в Play
Console включить **Play App Signing** — тогда этот файл станет только upload
key, и его потерю можно будет восстановить через поддержку Google; без Play
App Signing потеря файла означает невозможность когда-либо обновить
опубликованное приложение под тем же ID.

Проверка, что сборка реально подписана нужным сертификатом:

```bash
"$ANDROID_HOME/build-tools/36.0.0/apksigner" verify --print-certs \
  app/build/outputs/apk/release/app-release.apk
```

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
  -PSAKHATUBE_PLAY_SUBSCRIPTION_PRODUCT_KEY=premium_monthly \
  -PSAKHATUBE_PLAY_BILLING_ENABLED=true \
  -PSAKHATUBE_PLAY_BILLING_SERVER_VERIFICATION_ENABLED=true
```

Клиент отправляет purchase token только по HTTPS и только с короткой
авторизованной сессией SakhaTube. Эти флаги сами по себе ничего не открывают:
сервер сейчас намеренно отвечает отказом, пока не добавлена независимая проверка
Google Play Developer API, durable entitlement и обработка RTDN. До успешного
ответа сервера приложение не подтверждает покупку локально и не выдаёт доступ.

## Подключение аккаунта зрителя

Android использует Firebase Email/Password, проверяет ID token сервером
SakhaTube и хранит только свою сессию в Android Keystore. Пароль и Firebase
ID token не сохраняются. Точный порядок получения `google-services.json`,
настройки Firebase Admin в Railway и проверок на устройстве — в
[FIREBASE_NATIVE_SETUP.md](../../FIREBASE_NATIVE_SETUP.md). Полный безопасный
контракт сессии сохранён в [AUTH_INTEGRATION.md](AUTH_INTEGRATION.md).
