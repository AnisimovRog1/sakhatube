package com.sakhatube.android.data

import com.sakhatube.android.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Requests a short-lived, entitlement-checked playback session from SakhaTube.
 * This class deliberately never receives object-storage URLs or source files.
 */
class PlaybackRepository(private val baseUrl: String = BuildConfig.CATALOG_BASE_URL) {
    suspend fun createSession(contentId: String): PlaybackSessionResult = withContext(Dispatchers.IO) {
        val response = request("/v1/playback/sessions", "POST", JSONObject().put("contentId", contentId))
        if (response.status !in 200..299) return@withContext response.toFailure()

        val sessionId = response.json?.optString("sessionId").orEmpty().trim()
        val rawManifestUrl = response.json?.optString("manifestUrl").orEmpty().trim()
        if (sessionId.isEmpty() || rawManifestUrl.isEmpty()) return@withContext PlaybackSessionResult.Unavailable(
            "Сервис не выдал безопасную сессию просмотра. Попробуй ещё раз."
        )

        val manifestUrl = gatewayManifestUrl(rawManifestUrl)
            ?: return@withContext PlaybackSessionResult.Unavailable("Адрес просмотра настроен небезопасно.")
        PlaybackSessionResult.Ready(PlaybackSession(sessionId, manifestUrl))
    }

    suspend fun reportEvent(contentId: String, sessionId: String, event: String, positionMs: Long? = null, errorCode: String? = null) =
        withContext(Dispatchers.IO) {
            val body = JSONObject().apply {
                put("contentId", contentId)
                put("sessionId", sessionId)
                put("event", event)
                positionMs?.let { put("positionMs", it) }
                errorCode?.takeIf { it.isNotBlank() }?.let { put("errorCode", it.take(80)) }
            }
            // Analytics must never break playback or surface an error to the viewer.
            runCatching { request("/v1/events/playback", "POST", body) }
        }

    private fun RequestResponse.toFailure(): PlaybackSessionResult {
        val payload = json
        return when (payload?.optString("error")) {
        "ENTITLEMENT_REQUIRED" -> PlaybackSessionResult.Paywall(
            payload?.optString("message").orEmpty().ifBlank { "Для просмотра нужен тариф или покупка." }
        )
        "PLAYBACK_NOT_READY" -> PlaybackSessionResult.Processing(
            payload?.optString("message").orEmpty().ifBlank { "Видео ещё обрабатывается." }
        )
        "NOT_FOUND" -> PlaybackSessionResult.Unavailable(
            payload?.optString("message").orEmpty().ifBlank { "Этот материал сейчас недоступен." }
        )
        else -> PlaybackSessionResult.Unavailable(
            json?.optString("message")?.takeIf { it.isNotBlank() }
                ?: "Не удалось подготовить просмотр (код $status)."
        )
        }
    }

    private fun gatewayManifestUrl(raw: String): String? {
        // The player may use only the short-lived same-origin gateway path.
        // Reject storage URLs, redirects, fragments, and traversal outright.
        if (!raw.startsWith("/v1/playback/") || raw.contains("..") || raw.contains('#')) return null
        val base = runCatching { URL(baseUrl.trim().removeSuffix("/")) }.getOrNull() ?: return null
        if (base.protocol != "https" || base.host.isNullOrBlank()) return null
        val resolved = runCatching { URL(base, raw) }.getOrNull() ?: return null
        return resolved.takeIf {
            it.protocol == base.protocol && it.host == base.host && it.port == base.port &&
                it.path.startsWith("/v1/playback/") && it.query == null && it.ref == null
        }?.toString()
    }

    private fun request(path: String, method: String, body: JSONObject?): RequestResponse {
        val endpoint = "${baseUrl.trim().removeSuffix("/")}$path"
        val url = runCatching { URL(endpoint) }.getOrElse { throw IOException("Адрес просмотра настроен неверно.", it) }
        if (url.protocol != "https") throw IOException("Просмотр доступен только по защищённому соединению.")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 12_000
            readTimeout = 15_000
            doInput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json; charset=utf-8")
            setRequestProperty("User-Agent", "SakhaTube-Android/0.1")
            doOutput = body != null
        }
        return try {
            body?.let { connection.outputStream.bufferedWriter().use { writer -> writer.write(it.toString()) } }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val json = stream?.bufferedReader()?.use { it.readText() }?.takeIf { it.isNotBlank() }?.let(::JSONObject)
            RequestResponse(status, json)
        } catch (error: IOException) {
            throw error
        } catch (error: Exception) {
            throw IOException("Сервис вернул некорректный ответ.", error)
        } finally {
            connection.disconnect()
        }
    }
}

data class PlaybackSession(val sessionId: String, val manifestUrl: String)

sealed interface PlaybackSessionResult {
    data class Ready(val session: PlaybackSession) : PlaybackSessionResult
    data class Paywall(val message: String) : PlaybackSessionResult
    data class Processing(val message: String) : PlaybackSessionResult
    data class Unavailable(val message: String) : PlaybackSessionResult
}

private data class RequestResponse(val status: Int, val json: JSONObject?)
