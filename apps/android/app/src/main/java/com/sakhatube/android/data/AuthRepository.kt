package com.sakhatube.android.data

import com.sakhatube.android.BuildConfig
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.UserProfileChangeRequest
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
    suspend fun register(email: String, username: String, password: CharArray, displayName: String?): String = withContext(Dispatchers.IO) {
        val result = Tasks.await(FirebaseAuth.getInstance().createUserWithEmailAndPassword(email.trim(), password.concatToString()))
        val user = result.user ?: throw IOException("Firebase не вернул аккаунт.")
        Tasks.await(user.updateProfile(UserProfileChangeRequest.Builder().setDisplayName(displayName?.trim().takeUnless { it.isNullOrEmpty() } ?: username.trim()).build()))
        val idToken = Tasks.await(user.getIdToken(true)).token ?: throw IOException("Firebase не выдал ID-токен.")
        request("/v1/auth/firebase/register-pending", "POST", JSONObject().apply {
            put("idToken", idToken)
            put("username", username.trim())
            displayName?.trim()?.takeIf { it.isNotEmpty() }?.let { put("displayName", it) }
        })
        profileDrafts().edit().putString("username.${user.uid}", username.trim()).putString("displayName.${user.uid}", displayName?.trim()).apply()
        Tasks.await(user.sendEmailVerification())
        FirebaseAuth.getInstance().signOut()
        "Мы отправили письмо для подтверждения e-mail. Подтверди адрес и затем войди."
    }

    suspend fun login(email: String, password: CharArray): ViewerSession = withContext(Dispatchers.IO) {
        val result = Tasks.await(FirebaseAuth.getInstance().signInWithEmailAndPassword(email.trim(), password.concatToString()))
        exchangeVerifiedFirebaseUser(result.user ?: throw IOException("Firebase не вернул аккаунт."))
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

    fun signOut() {
        sessionStore.clear()
        FirebaseAuth.getInstance().signOut()
    }

    private fun exchangeVerifiedFirebaseUser(user: com.google.firebase.auth.FirebaseUser): ViewerSession {
        Tasks.await(user.reload())
        val refreshed = FirebaseAuth.getInstance().currentUser ?: throw IOException("Не удалось обновить аккаунт Firebase.")
        if (!refreshed.isEmailVerified) {
            Tasks.await(refreshed.sendEmailVerification())
            throw IOException("Подтверди e-mail по ссылке из письма, затем войди снова.")
        }
        val idToken = Tasks.await(refreshed.getIdToken(true)).token ?: throw IOException("Firebase не выдал ID-токен.")
        val drafts = profileDrafts()
        val username = drafts.getString("username.${refreshed.uid}", null)
        val displayName = drafts.getString("displayName.${refreshed.uid}", null)
        val response = request("/v1/auth/firebase/exchange", "POST", JSONObject().apply {
            put("idToken", idToken)
            username?.let { put("username", it) }
            displayName?.let { put("displayName", it) }
        })
        return response.toSession().also {
            sessionStore.save(it)
            drafts.edit().remove("username.${refreshed.uid}").remove("displayName.${refreshed.uid}").apply()
        }
    }

    private fun profileDrafts() = FirebaseApp.getInstance().applicationContext
        .getSharedPreferences("sakhatube.firebase.profile-drafts", android.content.Context.MODE_PRIVATE)

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

private fun JSONObject.toSession(): ViewerSession {
    val token = optString("accessToken").trim()
    val viewer = optJSONObject("viewer")?.toViewer()
    if (token.isEmpty() || viewer == null) throw IOException("Сервис не подтвердил сессию.")
    return ViewerSession(token, optLong("expiresIn", 0L), viewer)
}

private fun JSONObject.toViewer(): ViewerAccount? {
    val id = optString("id").trim()
    val email = optString("email").trim()
    val username = optString("username").trim()
    val displayName = optString("displayName").trim()
    if (id.isEmpty() || email.isEmpty() || username.isEmpty() || displayName.isEmpty()) return null
    return ViewerAccount(id, email, username, displayName, optString("status").trim(), optString("createdAt").trim().ifBlank { null })
}
