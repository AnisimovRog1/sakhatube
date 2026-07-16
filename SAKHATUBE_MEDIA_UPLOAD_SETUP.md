# Защищённая загрузка видео в Studio

Этот шаг принимает **исходный файл** в приватный префикс `incoming/`. Файл ещё не воспроизводится у зрителей и не считается опубликованным: после загрузки он получает статус `queued`, пока отдельный worker не выполнит проверку, транскодирование и HLS/CMAF.

## Что настроить в Railway

В сервисе API должны быть заданы `DATABASE_URL`, сильный `JWT_SECRET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` и `S3_REGION`. Эти значения нельзя хранить в Git, JavaScript или в Studio.

## Обязательное CORS-правило bucket

Браузер отправляет части файла прямо в bucket по короткоживущим подписанным URL. Для домена закрытой Studio добавьте одно строгое CORS-правило:

- разрешённый Origin: только будущий HTTPS-домен Studio (в разработке — нужный localhost);
- Methods: `PUT`, `GET`, `HEAD`;
- Expose headers: `ETag`;
- Allowed headers: только необходимые заголовки загрузки;
- не используйте `*` для production Studio.

Без `ETag` Studio намеренно не завершит upload: она не сможет безопасно подтвердить части в S3.

## Границы доступа

- `content_editor` и `superadmin` могут начать, завершить и отменить upload;
- файл до 50 GiB разбивается на части по 16 MiB, одновременно передаются не более трёх частей;
- приняты только MP4, MOV и WebM;
- отмена закрывает multipart-сессию в хранилище и сохраняет аудит;
- исходники под `incoming/` никогда не выдаются через публичный `/v1/media`.

## Что ещё обязательно до реального показа

1. OIDC + MFA для Studio и отдельный закрытый домен.
2. Malware scan, проверка прав, метаданных и субтитров.
3. Очередь worker-задач: ffprobe, транскодирование, постеры, HLS/CMAF и QC.
4. Приватный CDN с entitlement и короткоживущими ссылками на обработанные версии.
5. Мониторинг очереди, повтор задач, бэкапы и проверка восстановления.

## Контракт готовой HLS-версии и выдача просмотра

После успешной проверки worker создаёт отдельную запись `media_asset` для контента. Только такая запись может быть выдана зрителю:

```json
{
  "kind": "hls",
  "relation": "rendition",
  "status": "ready",
  "contentType": "application/vnd.apple.mpegurl",
  "metadata": {
    "playback": {
      "hls": {
        "state": "ready",
        "prefix": "renditions/<release-id>/",
        "manifestKey": "renditions/<release-id>/master.m3u8",
        "generatedAt": "2026-07-16T00:00:00.000Z"
      }
    }
  }
}
```

`manifestKey` и `prefix` — внутренние ключи bucket: Studio, клиент и публичный API их не получают. Worker обязан записать все сегменты до статуса `ready`; все URI внутри HLS должны быть относительными. Абсолютные и root-relative ссылки сервер отклонит, чтобы они не обходили проверку доступа.

Клиент запрашивает `POST /v1/playback/sessions` с `contentId`. Для опубликованного бесплатного контента с готовой HLS-версией сервер вернёт только короткоживущий `sessionId`, `expiresIn` и gateway-адрес `manifestUrl`. Gateway проверяет сессию на каждом запросе к manifest/segment. Он не является CDN-заменой: перед production нужно перенести ту же проверку entitlement в private CDN/token-auth edge.

Для `subscription` и `purchase` сервер всегда отвечает `403 ENTITLEMENT_REQUIRED`, пока не появятся StoreKit/Google Play Billing и серверная верификация покупок. Не меняйте этот ответ на «временную ссылку» или обходной доступ.
