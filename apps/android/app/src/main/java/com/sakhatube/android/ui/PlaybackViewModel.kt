package com.sakhatube.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sakhatube.android.data.PlaybackRepository
import com.sakhatube.android.data.PlaybackSession
import com.sakhatube.android.data.PlaybackSessionResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed interface PlaybackUiState {
    data object Idle : PlaybackUiState
    data object Loading : PlaybackUiState
    data class Ready(val session: PlaybackSession) : PlaybackUiState
    data class Paywall(val message: String) : PlaybackUiState
    data class Processing(val message: String) : PlaybackUiState
    data class Unavailable(val message: String) : PlaybackUiState
}

class PlaybackViewModel(private val repository: PlaybackRepository = PlaybackRepository()) : ViewModel() {
    private val _state = MutableStateFlow<PlaybackUiState>(PlaybackUiState.Idle)
    val state: StateFlow<PlaybackUiState> = _state.asStateFlow()

    fun open(contentId: String) = viewModelScope.launch {
        _state.value = PlaybackUiState.Loading
        _state.value = try {
            when (val result = repository.createSession(contentId)) {
                is PlaybackSessionResult.Ready -> PlaybackUiState.Ready(result.session)
                is PlaybackSessionResult.Paywall -> PlaybackUiState.Paywall(result.message)
                is PlaybackSessionResult.Processing -> PlaybackUiState.Processing(result.message)
                is PlaybackSessionResult.Unavailable -> PlaybackUiState.Unavailable(result.message)
            }
        } catch (error: Exception) {
            PlaybackUiState.Unavailable(error.message ?: "Не удалось подключиться к просмотру.")
        }
    }

    fun retry(contentId: String) = open(contentId)

    fun report(contentId: String, sessionId: String, event: String, positionMs: Long? = null, errorCode: String? = null) {
        viewModelScope.launch { repository.reportEvent(contentId, sessionId, event, positionMs, errorCode) }
    }
}
