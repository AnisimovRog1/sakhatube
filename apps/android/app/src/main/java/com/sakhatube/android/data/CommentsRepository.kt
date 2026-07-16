package com.sakhatube.android.data

import android.content.Context
import com.sakhatube.android.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

data class ViewerComment(
    val id: String,
    val authorName: String,
    val text: String,
    val createdAt: String,
    val status: String? = null
)

/**
 * Deliberately small API client for moderated comments. The only credential it
 * uses is the short-lived session held in the Android Keystore-backed store.
 */
class CommentsRepository(
    context: Context,
    private val baseUrl: String = BuildConfig.CATALOG_BASE_URL,
    private val sessionStore: ViewerSessionStore = EncryptedViewerSessionStore(context)
) {
    private val consentStore = CommentCommunityConsentStore(context.applicationContext)
    suspend fun approved(contentId: String): List<ViewerComment> = withContext(Dispatchers.IO) {
        // The feed stays public, but an authenticated viewer must send their
        // short-lived session so the server can filter authors they blocked.
        request("/v1/content/$contentId/comments?limit=50", "GET", null, sessionStore.current()?.accessToken)
            .optJSONArray("items").toComments()
    }

    suspend fun post(contentId: String, text: String): ViewerComment = withContext(Dispatchers.IO) {
        if (!hasAcceptedCommunityRules()) {
            throw IOException("Перед публикацией прими правила сообщества.")
        }
        val token = requireToken()
        request("/v1/content/$contentId/comments", "POST", JSONObject().put("text", text.trim()), token)
            .optJSONObject("item").toComment() ?: throw IOException("Сервис не подтвердил комментарий.")
    }

    suspend fun report(commentId: String, reason: String): Unit = withContext(Dispatchers.IO) {
        request("/v1/comments/$commentId/report", "POST", JSONObject().put("reason", reason), requireToken(), setOf(202))
        Unit
    }

    suspend fun delete(commentId: String): Unit = withContext(Dispatchers.IO) {
        request("/v1/comments/$commentId/delete", "POST", null, requireToken(), setOf(204))
        Unit
    }

    /**
     * The API deliberately accepts a comment id rather than exposing the
     * author's internal account id in the public comments response. The server
     * resolves the author and creates the viewer-specific block there.
     */
    suspend fun blockAuthor(commentId: String): Unit = withContext(Dispatchers.IO) {
        request("/v1/comments/$commentId/block", "POST", null, requireToken(), setOf(201))
        Unit
    }

    fun currentViewerId(): String? = sessionStore.current()?.viewer?.id
    fun currentViewer(): ViewerAccount? = sessionStore.current()?.viewer
    fun isSignedIn(): Boolean = sessionStore.current() != null
    fun hasAcceptedCommunityRules(): Boolean = currentViewerId()?.let(consentStore::hasAccepted) == true
    suspend fun acceptCommunityRules(): Unit = withContext(Dispatchers.IO) {
        val viewerId = currentViewerId()
            ?: throw IOException("Войди в аккаунт, чтобы принять правила.")
        request(
            "/v1/community-rules/acceptance",
            "POST",
            JSONObject().put("version", COMMUNITY_RULES_VERSION).put("accepted", true),
            requireToken()
        )
        // Never unlock local posting from a checkbox alone: this write is made
        // only after the server has stored its versioned acceptance record.
        consentStore.accept(viewerId)
    }

    private fun requireToken(): String = sessionStore.current()?.accessToken
        ?: throw IOException("Войди в аккаунт, чтобы продолжить.")

    private fun request(path: String, method: String, body: JSONObject?, token: String?, expected: Set<Int> = setOf(200, 201)): JSONObject {
        val url = runCatching { URL("${baseUrl.trim().removeSuffix("/")}$path") }
            .getOrElse { throw IOException("Адрес комментариев настроен неверно.", it) }
        if (url.protocol != "https") throw IOException("Комментарии доступны только по защищённому соединению.")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = method; connectTimeout = 12_000; readTimeout = 15_000; doInput = true
            setRequestProperty("Accept", "application/json"); setRequestProperty("User-Agent", "SakhaTube-Android/0.1")
            token?.let { setRequestProperty("Authorization", "Bearer $it") }
            if (body != null) { doOutput = true; setRequestProperty("Content-Type", "application/json; charset=utf-8") }
        }
        return try {
            if (body != null) connection.outputStream.bufferedWriter().use { it.write(body.toString()) }
            val status = connection.responseCode
            val raw = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            val json = raw.takeIf { it.isNotBlank() }?.let { runCatching { JSONObject(it) }.getOrNull() }
            if (status !in expected) throw IOException(json?.optString("message")?.takeIf { it.isNotBlank() } ?: "Не удалось выполнить действие (код $status).")
            json ?: JSONObject()
        } finally { connection.disconnect() }
    }
}

/**
 * Consent is local and scoped to the public SakhaTube account ID, so signing
 * out or switching accounts never applies another viewer's acknowledgement.
 * The policy version is part of the key: changed rules require consent again.
 */
private class CommentCommunityConsentStore(context: Context) {
    private val preferences = context.getSharedPreferences("sakhatube.comment-community-consent", Context.MODE_PRIVATE)

    fun hasAccepted(viewerId: String): Boolean = preferences.getLong(key(viewerId), 0L) > 0L
    fun accept(viewerId: String) { preferences.edit().putLong(key(viewerId), System.currentTimeMillis()).apply() }

    private fun key(viewerId: String) = "community-rules.$COMMUNITY_RULES_VERSION.$viewerId"
}

private const val COMMUNITY_RULES_VERSION = "2026-07-16"

private fun JSONArray?.toComments(): List<ViewerComment> = buildList {
    if (this@toComments != null) for (index in 0 until length()) optJSONObject(index).toComment()?.let(::add)
}

private fun JSONObject?.toComment(): ViewerComment? {
    if (this == null) return null
    val id = optString("id").trim(); val author = optString("authorName").trim(); val text = optString("text").trim()
    if (id.isEmpty() || author.isEmpty() || text.isEmpty()) return null
    return ViewerComment(id, author, text, optString("createdAt").trim(), optString("status").trim().ifBlank { null })
}
