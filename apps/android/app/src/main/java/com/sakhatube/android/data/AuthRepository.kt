package com.sakhatube.android.data

import com.sakhatube.android.BuildConfig
import android.content.Context
import com.google.android.gms.tasks.Tasks
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.UserProfileChangeRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class AuthRepository(
    private val appContext: Context,
    private val baseUrl: String = BuildConfig.AUTH_BASE_URL,
    private val sessionStore: ViewerSessionStore = EncryptedViewerSessionStore(appContext)
) {
    private val refreshMutex = Mutex()
    suspend fun register(email: String, username: String, password: CharArray, displayName: String?): String = withContext(Dispatchers.IO) {
        val auth = firebaseAuth()
        val result = Tasks.await(auth.createUserWithEmailAndPassword(email.trim(), password.concatToString()))
        val user = result.user ?: throw IOException("Firebase не вернул аккаунт.")
        Tasks.await(user.updateProfile(UserProfileChangeRequest.Builder().setDisplayName(displayName?.trim().takeUnless { it.isNullOrEmpty() } ?: username.trim()).build()))
        val idToken = Tasks.await(user.getIdToken(true)).token ?: throw IOException("Firebase не выдал ID-токен.")
        // server/app.js returns 201 for a genuine new registration (the
        // normal case) and only 200 when the Firebase identity was already
        // linked to an existing pending account -- request() defaults to
        // expecting only 200, so every first-time sign-up was throwing here
        // despite the account, username reservation, and verification email
        // all having already succeeded server-side.
        request("/v1/auth/firebase/register-pending", "POST", JSONObject().apply {
            put("idToken", idToken)
            put("username", username.trim())
            displayName?.trim()?.takeIf { it.isNotEmpty() }?.let { put("displayName", it) }
        }, expectedCodes = setOf(200, 201))
        profileDrafts().edit().putString("username.${user.uid}", username.trim()).putString("displayName.${user.uid}", displayName?.trim()).apply()
        Tasks.await(user.sendEmailVerification())
        auth.signOut()
        "Мы отправили письмо для подтверждения e-mail. Подтверди адрес и затем войди."
    }

    suspend fun login(email: String, password: CharArray): ViewerSession = withContext(Dispatchers.IO) {
        val result = Tasks.await(firebaseAuth().signInWithEmailAndPassword(email.trim(), password.concatToString()))
        exchangeVerifiedFirebaseUser(result.user ?: throw IOException("Firebase не вернул аккаунт."))
    }

    /**
     * Returns a currently-valid access token, refreshing first if the stored
     * one has expired (sessionStore.current() goes null at that point) but a
     * refresh token is still on hand. Null means the viewer is genuinely
     * signed out. This is what makes a session survive past the 15-minute
     * access-token lifetime -- CommentsRepository/BillingVerificationTransport
     * call this instead of reading sessionStore directly, so a session that's
     * been open longer than 15 minutes doesn't silently start looking
     * signed-out. refreshMutex collapses concurrent callers (e.g. two
     * comment actions firing back to back right as the token expires) into a
     * single network refresh instead of racing two rotations against the
     * server's reuse-detection, which would revoke the whole session family.
     */
    suspend fun ensureValidAccessToken(): String? = withContext(Dispatchers.IO) {
        sessionStore.current()?.accessToken?.let { return@withContext it }
        if (sessionStore.currentRefreshToken() == null) return@withContext null
        refreshMutex.withLock {
            sessionStore.current()?.accessToken ?: run {
                refreshSession()
                sessionStore.current()?.accessToken
            }
        }
    }

    /**
     * Rotates the stored refresh token. Called both at app start
     * (mirroring ViewerSessionStore.restoreSession() on iOS) and reactively
     * by [ensureValidAccessToken] whenever the access token has expired.
     * A reused or expired refresh token always means "sign in again" — the
     * server has already revoked the whole session family in that case.
     */
    suspend fun refreshSession(): ViewerAccount? = withContext(Dispatchers.IO) {
        val refreshToken = sessionStore.currentRefreshToken() ?: return@withContext null
        try {
            val response = request("/v1/auth/refresh", "POST", JSONObject().put("refreshToken", refreshToken))
            val session = response.toSession()
            sessionStore.save(session)
            session.viewer
        } catch (error: ApiException) {
            // The server looked at this specific token and said no (expired,
            // already rotated, or the whole session family was revoked after a
            // reuse was detected) — there is nothing left to retry.
            if (error.statusCode == 401) sessionStore.clear()
            null
        } catch (_: IOException) {
            // No response from the server at all (offline, timeout, DNS...).
            // The refresh token itself was never judged invalid, so keep it —
            // wiping it here would force a full re-login just because the
            // network blipped during the one refresh attempt at app start.
            null
        }
    }

    /**
     * The profile UI requires the viewer to type DELETE before this call. The
     * server deletes the Firebase identity before local data, then revokes all
     * SakhaTube sessions. Local credentials are cleared only after success.
     */
    suspend fun deleteAccount(): Unit = withContext(Dispatchers.IO) {
        // Reads through ensureValidAccessToken() (refreshing first if the
        // 15-minute access token has expired), not sessionStore.current()
        // directly -- Profile keeps showing the account as signed in for as
        // long as the refresh token is valid, so a stale-session check here
        // threw "sign in first" on a screen that still looked signed in for
        // any session simply left open past 15 minutes.
        val accessToken = ensureValidAccessToken() ?: throw IOException("Сначала войди в аккаунт.")
        request("/v1/account/delete", "POST", JSONObject().put("confirmation", "DELETE"), bearerToken = accessToken)
        sessionStore.clear()
        FirebaseApp.initializeApp(appContext)?.let { FirebaseAuth.getInstance(it).signOut() }
        Unit
    }

    fun signOut() {
        sessionStore.clear()
        FirebaseApp.initializeApp(appContext)?.let { FirebaseAuth.getInstance(it).signOut() }
    }

    private fun exchangeVerifiedFirebaseUser(user: com.google.firebase.auth.FirebaseUser): ViewerSession {
        Tasks.await(user.reload())
        val auth = firebaseAuth()
        val refreshed = auth.currentUser ?: throw IOException("Не удалось обновить аккаунт Firebase.")
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

    private fun profileDrafts() = appContext.getSharedPreferences(
        "sakhatube.firebase.profile-drafts",
        android.content.Context.MODE_PRIVATE
    )

    private fun firebaseAuth(): FirebaseAuth {
        val firebaseApp = FirebaseApp.initializeApp(appContext)
            ?: throw IOException("Вход временно недоступен: Firebase ещё не настроен.")
        return FirebaseAuth.getInstance(firebaseApp)
    }

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
                throw ApiException(
                    json?.optString("message")?.takeIf { it.isNotBlank() } ?: "Не удалось выполнить запрос (код $status).",
                    statusCode = status
                )
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

/**
 * Carries the HTTP status so callers can tell "the server explicitly rejected
 * this" (e.g. 401 on a reused/expired refresh token) apart from a transient
 * network failure, which both used to surface as a bare IOException.
 */
private class ApiException(message: String, val statusCode: Int) : IOException(message)

private fun JSONObject.toSession(): ViewerSession {
    val token = optString("accessToken").trim()
    val refreshToken = optString("refreshToken").trim()
    val viewer = optJSONObject("viewer")?.toViewer()
    if (token.isEmpty() || refreshToken.isEmpty() || viewer == null) throw IOException("Сервис не подтвердил сессию.")
    return ViewerSession(token, refreshToken, optLong("expiresIn", 0L), viewer)
}

private fun JSONObject.toViewer(): ViewerAccount? {
    val id = optString("id").trim()
    val email = optString("email").trim()
    val username = optString("username").trim()
    val displayName = optString("displayName").trim()
    if (id.isEmpty() || email.isEmpty() || username.isEmpty() || displayName.isEmpty()) return null
    return ViewerAccount(id, email, username, displayName, optString("status").trim(), optString("createdAt").trim().ifBlank { null })
}
