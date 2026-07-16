package com.sakhatube.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sakhatube.android.data.AuthRepository
import com.sakhatube.android.data.AuthUiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel(
    private val repository: AuthRepository = AuthRepository()
) : ViewModel() {
    private val _state = MutableStateFlow<AuthUiState>(AuthUiState.Guest)
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    fun register(email: String, password: CharArray, displayName: String) = runAuth(
        inProgress = AuthUiState.Registering,
        success = { AuthUiState.VerificationRequired(it) }
    ) {
        try { repository.register(email, password, displayName) } finally { password.fill('\u0000') }
    }

    fun login(email: String, password: CharArray) = runAuth(
        inProgress = AuthUiState.SigningIn,
        success = { AuthUiState.SignedIn(it.viewer) }
    ) { try { repository.login(email, password) } finally { password.fill('\u0000') } }

    fun verifyEmail(verificationLink: String) = runAuth(
        inProgress = AuthUiState.VerifyingEmail,
        success = { AuthUiState.SignedIn(it.viewer) }
    ) { repository.verifyEmail(verificationLink) }

    fun dismissError() { _state.value = AuthUiState.Guest }
    fun signOut() { repository.signOut(); _state.value = AuthUiState.Guest }

    private fun <T> runAuth(inProgress: AuthUiState, success: (T) -> AuthUiState, block: suspend () -> T) {
        viewModelScope.launch {
            _state.value = inProgress
            runCatching { block() }
                .onSuccess { _state.value = success(it) }
                .onFailure { _state.value = AuthUiState.Error(it.message ?: "Не удалось выполнить запрос.") }
        }
    }
}
