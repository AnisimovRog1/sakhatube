package com.sakhatube.android.data

/**
 * Viewer identity kept only for the current app process.
 * This project does not yet include AndroidX Security Crypto, so credentials and
 * bearer tokens are deliberately not written to disk.
 */
data class ViewerAccount(
    val id: String,
    val email: String,
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

interface ViewerSessionStore {
    fun current(): ViewerSession?
    fun save(session: ViewerSession)
    fun clear()
}

/** Memory-only by design until an approved encrypted-token storage is added. */
class InMemoryViewerSessionStore : ViewerSessionStore {
    @Volatile private var session: ViewerSession? = null
    override fun current(): ViewerSession? = session
    override fun save(session: ViewerSession) { this.session = session }
    override fun clear() { session = null }
}
