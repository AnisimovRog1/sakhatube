package com.sakhatube.android.data

import android.net.Uri
import com.sakhatube.android.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class AuthRepository(
    private val baseUrl: String = BuildConfig.AUTH_BASE_URL,
    private val sessionStore: ViewerSessionStore = InMemoryViewerSessionStore()
) {
    suspend fun register(email: String, password: CharArray, displayName: String?): String = withContext(Dispatchers.IO) {
        val body = JSONObject().apply {
            put("email", email.trim())
            put("password", password.concatToString())
            displayName?.trim()?.takeIf { it.isNotEmpty() }?.let { put("displayName", it) }
        }
        request("/v1/auth/register", "POST", body, expectedCodes = setOf(202)).optString(
            "message",
            "Проверь почту и подтверди адрес."
        )
    }

    suspend fun login(email: String, password: CharArray): ViewerSession = withContext(Dispatchers.IO) {
        val response = request("/v1/auth/login", "POST", JSONObject().apply {
            put("email", email.trim())
            put("password", password.concatToString())
        })
        response.toSession().also(sessionStore::save)
    }

    suspend fun verifyEmail(verificationLink: String): ViewerSession = withContext(Dispatchers.IO) {
        val link = parseVerificationLink(verificationLink)
        val response = request("/v1/auth/verify-email", "POST", JSONObject().apply {
            put("accountId", link.accountId)
            put("token", link.token)
        })
        response.toSession().also(sessionStore::save)
    }

    suspend fun restoreCurrentViewer(): ViewerAccount? = withContext(Dispatchers.IO) {
        val session = sessionStore.current() ?: return@withContext null
        val response = request("/v1/auth/me", "GET", null, bearerToken = session.accessToken)
        response.optJSONObject("viewer")?.toViewer()
    }

    /**
     * Starts a privacy request only. The server sends a one-time e-mail link;
     * the app must never imply that the account has already been erased.
     */
    suspend fun startDeletionRequest(email: String, accountEmail: String, message: String?): String = withContext(Dispatchers.IO) {
        val response = request("/v1/privacy/deletion-requests", "POST", JSONObject().apply {
            put("email", email.trim())
            put("accountEmail", accountEmail.trim())
            message?.trim()?.takeIf { it.isNotEmpty() }?.let { put("message", it) }
            put("confirmation", true)
        }, expectedCodes = setOf(202))
        if (!response.optBoolean("verificationRequired", false)) {
            throw IOException("Сервис не запросил подтверждение. Попробуй позже.")
        }
        "Письмо отправлено. Перейди по одноразовой ссылке из e-mail — только тогда запрос будет передан в обработку."
    }

    fun signOut() = sessionStore.clear()

    private fun request(
        path: String,
        method: String,
        body: JSONObject?,
        bearerToken: String? = null,
        expectedCodes: Set<Int> = setOf(200)
    ): JSONObject {
        val endpoint = "${baseUrl.trim().removeSuffix("/")}$path"
        val url = runCatching { URL(endpoint) }.getOrElse { throw IOException("Адрес входа настроен неверно.", it) }
        if (url.protocol != "https") throw IOException("Вход доступен только по защищённому соединению.")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 12_000
            readTimeout = 15_000
            doInput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "SakhaTube-Android/0.1")
            bearerToken?.let { setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) {
                doOutput = true
                setRequestProperty("Content-Type", "application/json; charset=utf-8")
            }
        }
        return try {
            if (body != null) connection.outputStream.bufferedWriter().use { it.write(body.toString()) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val json = stream?.bufferedReader()?.use { it.readText() }?.let(::JSONObject)
            if (status !in expectedCodes) {
                throw IOException(json?.optString("message")?.takeIf { it.isNotBlank() }
                    ?: "Не удалось выполнить запрос (код $status).")
            }
            json ?: throw IOException("Сервис вернул пустой ответ.")
        } catch (error: IOException) {
            throw error
        } catch (error: Exception) {
            throw IOException("Сервис вернул некорректный ответ.", error)
        } finally {
            connection.disconnect()
        }
    }
}

private data class VerificationLink(val accountId: String, val token: String)

private fun parseVerificationLink(raw: String): VerificationLink {
    val uri = Uri.parse(raw.trim())
    val accountId = uri.getQueryParameter("account")?.trim().orEmpty()
    val token = uri.getQueryParameter("token")?.trim().orEmpty()
    if (uri.scheme != "https" || uri.path != "/verify-email" || accountId.isEmpty() || !token.matches(Regex("[A-Za-z0-9_-]{43}"))) {
        throw IOException("Вставь полную ссылку из письма подтверждения.")
    }
    return VerificationLink(accountId, token)
}

private fun JSONObject.toSession(): ViewerSession {
    val token = optString("accessToken").trim()
    val viewer = optJSONObject("viewer")?.toViewer()
    if (token.isEmpty() || viewer == null) throw IOException("Сервис не подтвердил сессию.")
    return ViewerSession(token, optLong("expiresIn", 0L), viewer)
}

private fun JSONObject.toViewer(): ViewerAccount? {
    val id = optString("id").trim()
    val email = optString("email").trim()
    val displayName = optString("displayName").trim()
    if (id.isEmpty() || email.isEmpty() || displayName.isEmpty()) return null
    return ViewerAccount(id, email, displayName, optString("status").trim(), optString("createdAt").trim().ifBlank { null })
}
