package com.sakhatube.android.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.sakhatube.android.data.CommentsRepository
import com.sakhatube.android.data.ViewerComment
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CommentsUiState(
    val loading: Boolean = true,
    val items: List<ViewerComment> = emptyList(),
    val error: String? = null,
    val notice: String? = null
)

class CommentsViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = CommentsRepository(application.applicationContext)
    private val _state = MutableStateFlow(CommentsUiState())
    val state: StateFlow<CommentsUiState> = _state.asStateFlow()

    fun signedIn() = repository.isSignedIn()
    fun viewerId() = repository.currentViewerId()

    fun load(contentId: String) = viewModelScope.launch {
        _state.value = _state.value.copy(loading = true, error = null)
        runCatching { repository.approved(contentId) }
            .onSuccess { _state.value = CommentsUiState(items = it) }
            .onFailure { _state.value = _state.value.copy(loading = false, error = it.message ?: "Не удалось загрузить комментарии.") }
    }

    fun post(contentId: String, text: String) = viewModelScope.launch {
        runCatching { repository.post(contentId, text) }
            .onSuccess { comment -> _state.value = _state.value.copy(items = listOf(comment) + _state.value.items, notice = "Комментарий отправлен на модерацию.", error = null) }
            .onFailure { _state.value = _state.value.copy(error = it.message ?: "Не удалось отправить комментарий.") }
    }

    fun report(commentId: String) = viewModelScope.launch {
        runCatching { repository.report(commentId, "other") }
            .onSuccess { _state.value = _state.value.copy(notice = "Жалоба отправлена модераторам.", error = null) }
            .onFailure { _state.value = _state.value.copy(error = it.message ?: "Не удалось отправить жалобу.") }
    }

    fun delete(commentId: String) = viewModelScope.launch {
        runCatching { repository.delete(commentId) }
            .onSuccess { _state.value = _state.value.copy(items = _state.value.items.filterNot { it.id == commentId }, notice = "Комментарий удалён.", error = null) }
            .onFailure { _state.value = _state.value.copy(error = it.message ?: "Не удалось удалить комментарий.") }
    }

    fun blockAuthor(commentId: String) = viewModelScope.launch {
        runCatching { repository.blockAuthor(commentId) }
            .onSuccess {
                // The service filters every current and future public comment
                // from this author for the signed-in viewer. Reload instead of
                // inferring author identity on-device.
                _state.value = _state.value.copy(
                    items = _state.value.items.filterNot { it.id == commentId },
                    notice = "Пользователь заблокирован. Его комментарии больше не будут показаны.",
                    error = null
                )
            }
            .onFailure { _state.value = _state.value.copy(error = it.message ?: "Не удалось заблокировать пользователя.") }
    }

    fun clearMessage() { _state.value = _state.value.copy(error = null, notice = null) }
}
