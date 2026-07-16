# SakhaTube — подключение Firebase Auth к нативным приложениям

Этот файл описывает один воспроизводимый путь подключения Firebase Auth без
размещения конфигураций или ключей в Git. Пока все пункты не сделаны, клиент
честно сообщает, что вход временно недоступен; Android также не позволит
создать release AAB.

## Что уже задано в исходниках

- Firebase project: задаёт владелец в своей консоли, а не исходники.
- iOS bundle ID: `com.sakhatube.app`.
- Android application ID: `com.sakhatube.app`.
- В консоли Firebase включён **Email/Password**.
- Сервер SakhaTube принимает Firebase ID token только через защищённые
  `/v1/auth/firebase/register-pending` и `/v1/auth/firebase/exchange`.

Не добавляйте в Firebase другой package/bundle ID «на глаз»: полученные
конфигурации должны соответствовать тем же идентификаторам, которые попадут в
подписанные бинарники.

## Android

1. В Firebase Console откройте **Project settings → Your apps → Add app →
   Android**.
2. Укажите package name `com.sakhatube.app`. SHA certificate fingerprints для
   email/password входа не обязательны; они понадобятся только при добавлении
   Google Sign-In или phone auth.
3. Скачайте `google-services.json` и поместите его ровно сюда:
   `apps/android/app/google-services.json`.
4. Не переименовывайте и не коммитьте файл: он уже добавлен в `.gitignore`.
5. Соберите debug и затем release AAB. Release намеренно остановится с
   понятной ошибкой, если файла нет.

## iOS

1. В той же Firebase Console добавьте **iOS app** с bundle ID
   `com.sakhatube.app`.
2. Скачайте `GoogleService-Info.plist` и поместите его сюда:
   `apps/ios/SakhaTube/GoogleService-Info.plist`.
3. В Xcode перетащите файл в группу **SakhaTube** и в диалоге добавления
   включите **Target Membership → SakhaTube**. Файл должен лежать в корне
   app bundle: после Archive его можно проверить как
   `SakhaTube.app/GoogleService-Info.plist`.
4. Не коммитьте файл: он уже добавлен в `.gitignore`.
5. Запустите на устройстве. Если файла нет, вход не падает, а показывает
   «Firebase ещё не настроен».

## Сервер Railway: отдельная обязательная часть

Клиентская конфигурация не позволяет серверу безопасно проверить ID token.
Перед включением регистрации в production владелец должен:

1. Создать **минимально привилегированный** service account для Firebase Admin
   SDK (не использовать личный аккаунт и не публиковать JSON-ключ). У него
   должно быть разрешение удалить пользователя Firebase Auth
   (`firebaseauth.users.delete`); без него SakhaTube намеренно не завершит
   удаление аккаунта локально.
2. Сохранить весь JSON только как защищённую Railway variable
   `FIREBASE_SERVICE_ACCOUNT_JSON`, а project id — в `FIREBASE_PROJECT_ID`.
3. Для web-клиента добавить в Railway public identifiers из Firebase Console:
   `FIREBASE_WEB_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_WEB_APP_ID`.
4. На Firebase Authentication → Settings → Authorized domains добавить только
   реальные HTTPS-домены SakhaTube. Не добавлять временные чужие домены и не
   включать небезопасный HTTP.
5. После deploy выполнить с чистого устройства: регистрация → письмо
   подтверждения → вход → выход → удаление аккаунта. Проверить, что при
   отозванном token сервер отказывает и что пользователь исчезает также из
   Firebase Authentication → Users. Если Firebase временно недоступен,
   SakhaTube вернёт 503 и оставит подтверждённый запрос доступным для повтора,
   не создавая ситуацию «локально удалён, но в Firebase остался».

## Перед TestFlight и Play

- Не добавлять service-account JSON, приватные ключи, upload keystore или
  `.p12` в проект, GitHub, скриншоты или App Review notes.
- Сверить App Privacy и Data safety с фактическими Firebase, Railway, почтовыми
  и аналитическими данными.
- Для Google Play и App Store reviewer access создать отдельного тестового
  пользователя без staff-прав и не передавать его пароль через Git.
- Firebase не заменяет Apple signing, Play App Signing, реальные юридические
  документы, права на видеокаталог, StoreKit/Play Billing и серверную проверку
  покупок.
