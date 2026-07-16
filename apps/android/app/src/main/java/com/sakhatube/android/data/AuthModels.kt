package com.sakhatube.android.data

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

/**
 * The access token is kept only in a Keystore-backed encrypted preference. The
 * password and Firebase ID token are never persisted by SakhaTube.
 */
data class ViewerAccount(
    val id: String,
    val email: String,
    val username: String,
    val displayName: String,
    val status: String,
    val createdAt: String?
)

data class ViewerSession(
    val accessToken: String,
    val expiresInSeconds: Long,
    val viewer: ViewerAccount
)

sealed interface AuthUiState {
    data object Guest : AuthUiState
    data object Registering : AuthUiState
    data class VerificationRequired(val message: String) : AuthUiState
    data object SigningIn : AuthUiState
    data object VerifyingEmail : AuthUiState
    data class SignedIn(val viewer: ViewerAccount) : AuthUiState
    data class Error(val message: String) : AuthUiState
}

sealed interface DeletionUiState {
    data object Idle : DeletionUiState
    data object Sending : DeletionUiState
    data class Requested(val message: String) : DeletionUiState
    data class Error(val message: String) : DeletionUiState
}

interface ViewerSessionStore {
    fun current(): ViewerSession?
    fun save(session: ViewerSession)
    fun clear()
}

/**
 * Stores the short-lived SakhaTube access token with a key held in Android
 * Keystore. This is deliberately not a refresh-token store: when the 15-minute
 * viewer session expires, the app returns to the sign-in screen.
 */
class EncryptedViewerSessionStore(context: Context) : ViewerSessionStore {
    private val preferences = EncryptedSharedPreferences.create(
        context.applicationContext,
        SESSION_FILE,
        MasterKey.Builder(context.applicationContext)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    override fun current(): ViewerSession? {
        val expiresAt = preferences.getLong(KEY_EXPIRES_AT, 0L)
        if (expiresAt <= System.currentTimeMillis()) {
            clear()
            return null
        }
        val token = preferences.getString(KEY_ACCESS_TOKEN, null)?.trim().orEmpty()
        val id = preferences.getString(KEY_VIEWER_ID, null)?.trim().orEmpty()
        val email = preferences.getString(KEY_EMAIL, null)?.trim().orEmpty()
        val username = preferences.getString(KEY_USERNAME, null)?.trim().orEmpty()
        val displayName = preferences.getString(KEY_DISPLAY_NAME, null)?.trim().orEmpty()
        if (token.isEmpty() || id.isEmpty() || email.isEmpty() || username.isEmpty() || displayName.isEmpty()) {
            clear()
            return null
        }
        return ViewerSession(
            accessToken = token,
            expiresInSeconds = ((expiresAt - System.currentTimeMillis()) / 1_000L).coerceAtLeast(1L),
            viewer = ViewerAccount(
                id = id,
                email = email,
                username = username,
                displayName = displayName,
                status = preferences.getString(KEY_STATUS, null).orEmpty(),
                createdAt = preferences.getString(KEY_CREATED_AT, null)
            )
        )
    }

    override fun save(session: ViewerSession) {
        // A server must always return a bounded lifetime. Persisting a missing
        // or non-positive expiry would accidentally turn a short token into a
        // permanent login.
        if (session.expiresInSeconds <= 0L || session.accessToken.isBlank()) {
            clear()
            return
        }
        val cappedLifetimeSeconds = session.expiresInSeconds.coerceAtMost(MAX_PERSISTED_LIFETIME_SECONDS)
        val expiresAt = System.currentTimeMillis() + cappedLifetimeSeconds * 1_000L
        preferences.edit()
            .putString(KEY_ACCESS_TOKEN, session.accessToken)
            .putLong(KEY_EXPIRES_AT, expiresAt)
            .putString(KEY_VIEWER_ID, session.viewer.id)
            .putString(KEY_EMAIL, session.viewer.email)
            .putString(KEY_USERNAME, session.viewer.username)
            .putString(KEY_DISPLAY_NAME, session.viewer.displayName)
            .putString(KEY_STATUS, session.viewer.status)
            .putString(KEY_CREATED_AT, session.viewer.createdAt)
            .apply()
    }

    override fun clear() {
        preferences.edit().clear().apply()
    }

    private companion object {
        const val SESSION_FILE = "sakhatube.viewer-session.v1"
        const val KEY_ACCESS_TOKEN = "accessToken"
        const val KEY_EXPIRES_AT = "expiresAt"
        const val KEY_VIEWER_ID = "viewerId"
        const val KEY_EMAIL = "email"
        const val KEY_USERNAME = "username"
        const val KEY_DISPLAY_NAME = "displayName"
        const val KEY_STATUS = "status"
        const val KEY_CREATED_AT = "createdAt"
        // Access tokens are currently issued for 15 minutes. The upper bound is
        // defence in depth in case a malformed response is ever received.
        const val MAX_PERSISTED_LIFETIME_SECONDS = 60L * 60L
    }
}
