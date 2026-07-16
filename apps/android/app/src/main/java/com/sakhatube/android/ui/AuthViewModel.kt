package com.sakhatube.android.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.sakhatube.android.data.AuthRepository
import com.sakhatube.android.data.AuthUiState
import com.sakhatube.android.data.DeletionUiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class AuthViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = AuthRepository(application.applicationContext)
    private val _state = MutableStateFlow<AuthUiState>(AuthUiState.Guest)
    val state: StateFlow<AuthUiState> = _state.asStateFlow()
    private val _deletionState = MutableStateFlow<DeletionUiState>(DeletionUiState.Idle)
    val deletionState: StateFlow<DeletionUiState> = _deletionState.asStateFlow()

    init {
        viewModelScope.launch {
            repository.restoreCurrentViewer()?.let { viewer ->
                _state.value = AuthUiState.SignedIn(viewer)
            }
        }
    }

    fun register(email: String, username: String, password: CharArray, displayName: String) = runAuth(
        inProgress = AuthUiState.Registering,
        success = { AuthUiState.VerificationRequired(it) }
    ) {
        try { repository.register(email, username, password, displayName) } finally { password.fill('\u0000') }
    }

    fun login(email: String, password: CharArray) = runAuth(
        inProgress = AuthUiState.SigningIn,
        success = { AuthUiState.SignedIn(it.viewer) }
    ) { try { repository.login(email, password) } finally { password.fill('\u0000') } }

    fun dismissError() { _state.value = AuthUiState.Guest }
    fun signOut() { repository.signOut(); _state.value = AuthUiState.Guest }

    fun startDeletion(email: String, accountEmail: String, message: String) {
        if (!email.trim().equals(accountEmail.trim(), ignoreCase = true)) {
            _deletionState.value = DeletionUiState.Error("Укажи e-mail текущего аккаунта для подтверждения.")
            return
        }
        viewModelScope.launch {
            _deletionState.value = DeletionUiState.Sending
            runCatching { repository.startDeletionRequest(email, accountEmail, message) }
                .onSuccess { _deletionState.value = DeletionUiState.Requested(it) }
                .onFailure { _deletionState.value = DeletionUiState.Error(it.message ?: "Не удалось отправить запрос.") }
        }
    }

    fun clearDeletionState() { _deletionState.value = DeletionUiState.Idle }

    private fun <T> runAuth(inProgress: AuthUiState, success: (T) -> AuthUiState, block: suspend () -> T) {
        viewModelScope.launch {
            _state.value = inProgress
            runCatching { block() }
                .onSuccess { _state.value = success(it) }
                .onFailure { _state.value = AuthUiState.Error(it.message ?: "Не удалось выполнить запрос.") }
        }
    }
}
