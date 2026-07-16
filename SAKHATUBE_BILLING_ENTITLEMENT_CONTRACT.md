# SakhaTube — контракт биллинга и прав просмотра

Статус: **контракт и fail-closed защита готовы; интеграция с магазинами не реализована.**

Этот документ задаёт единственный допустимый путь от покупки к просмотру. Он не является инструкцией «включить платежи» и не означает, что StoreKit 2, Google Play Billing, Apple App Store Server API, RTDN или Google Play Developer API уже подключены.

## Непреложное правило

Клиент сообщает только о намерении или результате покупки. Сервер **не верит** флагу `isPaid`, идентификатору продукта из клиента, скриншоту, локальному чеку или UI-состоянию. Право просмотра выдаётся только после серверной проверки с магазином и сохранения неизменяемой записи.

Пока валидатор и обработчики уведомлений не существуют, production остаётся в статусе `blocked_not_implemented`. Даже `PAYMENTS_ENABLED=true` не открывает подписочный или купленный каталог и не выдаёт entitlement.

## Каталог продуктов

До начала разработки владелец продукта заводит записи ниже в App Store Connect и Play Console, затем вносит их в защищённую server-side конфигурацию. Идентификаторы нельзя принимать от мобильного клиента.

| Поле | Требование |
| --- | --- |
| `productKey` | Внутренний стабильный ключ, например `premium_monthly` |
| `kind` | Только `subscription` или `one_time_purchase` |
| `appleProductId` | Реальный ID из App Store Connect |
| `googlePlayProductId` | Реальный ID из Play Console |
| `contentScope` | `all_premium`, `series:<id>` или иной серверный scope |
| `territories` | Разрешённые территории согласно правам на контент |
| `active` | Включается только после sandbox/closed-test проверки |

Запрещено включать продукт, если любой из двух store ID отсутствует, дублируется или не совпадает с опубликованной конфигурацией магазина.

## Модель событий покупки

Каждое событие хранится отдельно от entitlement и никогда не перезаписывается.

```json
{
  "id": "uuid",
  "platform": "ios | android",
  "environment": "sandbox | production",
  "eventType": "purchase | renewal | restore | revoke | refund | expire",
  "accountId": "uuid",
  "productKey": "premium_monthly",
  "storeTransactionId": "строка из магазина",
  "originalTransactionId": "строка или null",
  "storePayloadHash": "sha256, без сырого чека",
  "validatedAt": "ISO-8601",
  "validationSource": "apple_server_api | google_play_developer_api | app_store_notification | google_rtdn",
  "status": "validated | rejected | superseded",
  "idempotencyKey": "platform + environment + storeTransactionId"
}
```

Сырые receipts/JWS/purchase tokens допускаются только во временном зашифрованном хранилище на время проверки, не в audit log, аналитике или клиентских ответах. Повтор одного `idempotencyKey` не создаёт второе право.

## Entitlement

Только валидированный store event может создать или изменить entitlement:

```json
{
  "id": "uuid",
  "accountId": "uuid",
  "productKey": "premium_monthly",
  "scope": "all_premium",
  "state": "active | grace_period | expired | revoked",
  "startsAt": "ISO-8601",
  "endsAt": "ISO-8601 или null",
  "sourceEventId": "uuid",
  "updatedAt": "ISO-8601"
}
```

Плеер проверяет entitlement на сервере перед выдачей каждого защищённого HLS manifest/CDN token. При отсутствии, истечении, отзыве, ошибке проверки или недоступности биллинговой БД ответ — отказ (`403`), не «оптимистический доступ».

## Границы валидации

1. iOS передаёт на сервер только данные, требуемые для проверки StoreKit 2 transaction/JWS; Android — purchase token и известный серверу product key.
2. Сервер проверяет подпись, bundle/package, environment, product, transaction ID, владельца, дату, статус возврата/отзыва и идемпотентность через официальные Apple/Google server API.
3. Сервер записывает validated/rejected event транзакционно, затем пересчитывает entitlement.
4. Apple App Store Server Notifications и Google RTDN принимаются на отдельных HTTPS endpoint-ах с проверкой подписи/аутентичности, дедупликацией и повторной сверкой с API магазина. Уведомление само по себе не выдаёт доступ.
5. Невалидный payload, неизвестный product ID, несовпадающий app identifier, повтор события, ошибка внешнего API или таймаут → event `rejected`/retry queue; entitlement не выдаётся.

## Обязательные endpoint-ы будущей реализации

| Endpoint | Назначение | Доступ |
| --- | --- | --- |
| `POST /v1/billing/ios/transactions` | Передать StoreKit 2 transaction на серверную сверку | Подтверждённый viewer |
| `POST /v1/billing/android/purchases` | Передать Google Play purchase token | Подтверждённый viewer |
| `POST /v1/billing/apple/notifications` | App Store Server Notifications v2 | Только Apple, signature verify |
| `POST /v1/billing/google/rtdn` | Google Pub/Sub RTDN consumer | Только проверенный Pub/Sub |
| `GET /v1/me/entitlements` | Показать серверные права без receipt/token | Подтверждённый viewer |
| `POST /v1/billing/restore` | Пересверить покупки, не доверяя клиенту | Подтверждённый viewer |

Ни один из этих endpoint-ов пока не добавлен намеренно: незавершённая интеграция не должна выглядеть как работающая покупка.

## Критерии включения production-платежей

- [ ] Реальные продукты в обоих сторах, цены и территории согласованы с правами каталога.
- [ ] Server-side secrets/KMS, Apple ключи и Google service account заведены только в production secret manager.
- [ ] Реализованы server API validation, Apple notifications, Google RTDN и идемпотентное хранилище событий.
- [ ] Проверены purchase, renewal, cancel, refund, revoke, grace period, restore и duplicate delivery в Apple sandbox/TestFlight и Google closed test.
- [ ] Плееры получают только краткоживущий playback token после active entitlement.
- [ ] Финансовые и приватностные сроки хранения утверждены юристом; Data safety/App Privacy обновлены по факту.
- [ ] Отдельный security review подтвердил, что сырой receipt/purchase token не попадает в логи, audit или аналитику.

До выполнения всех пунктов `PAYMENTS_ENABLED` оставляют `false`.
