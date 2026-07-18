package com.sakhatube.android.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.sakhatube.android.data.CommentsRepository
import com.sakhatube.android.data.ViewerComment
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class CommentsUiState(
    val loading: Boolean = true,
    val items: List<ViewerComment> = emptyList(),
    val error: String? = null,
    val notice: String? = null,
    // The delete button is tappable continuously (unlike report/block, which
    // close their confirmation dialog on the same tap) -- without this, a
    // fast double-tap fired two DELETE requests for the same comment.
    val deletingIds: Set<String> = emptySet()
)

class CommentsViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = CommentsRepository(application.applicationContext)
    private val _state = MutableStateFlow(CommentsUiState())
    val state: StateFlow<CommentsUiState> = _state.asStateFlow()

    fun signedIn() = repository.isSignedIn()
    fun viewerId() = repository.currentViewerId()
    fun hasAcceptedCommunityRules() = repository.hasAcceptedCommunityRules()
    fun canDelete(comment: ViewerComment): Boolean =
        repository.currentViewer()?.displayName == comment.authorName
    fun canBlock(comment: ViewerComment): Boolean =
        comment.status == null && repository.currentViewer()?.displayName != comment.authorName && repository.isSignedIn()

    // Shared across every content item whose comment sheet is opened (same
    // reasoning as PlaybackViewModel.openJob) -- without cancelling the
    // previous load, switching content quickly could show item B's title
    // with item A's stale comment thread if A's response landed after B's.
    private var loadJob: Job? = null

    fun load(contentId: String) {
        loadJob?.cancel()
        loadJob = viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            runCatching { repository.approved(contentId) }
                .onSuccess { _state.value = CommentsUiState(items = it) }
                .onFailure { _state.value = _state.value.copy(loading = false, error = it.message ?: "Не удалось загрузить комментарии.") }
        }
    }

    fun post(contentId: String, text: String) = viewModelScope.launch {
        runCatching { repository.post(contentId, text) }
            .onSuccess { comment -> _state.value = _state.value.copy(items = listOf(comment) + _state.value.items, notice = "Комментарий отправлен на модерацию.", error = null) }
            .onFailure { _state.value = _state.value.copy(error = it.message ?: "Не удалось отправить комментарий.") }
    }

    fun acceptCommunityRulesAndPost(contentId: String, text: String, onPosted: () -> Unit) = viewModelScope.launch {
        runCatching {
            repository.acceptCommunityRules()
            repository.post(contentId, text)
        }.onSuccess { comment ->
            _state.value = _state.value.copy(
                items = listOf(comment) + _state.value.items,
                notice = "Правила приняты. Комментарий отправлен на модерацию.",
                error = null
            )
            onPosted()
        }.onFailure {
            _state.value = _state.value.copy(error = it.message ?: "Не удалось сохранить согласие с правилами.")
        }
    }

    fun report(commentId: String) = viewModelScope.launch {
        runCatching { repository.report(commentId, "other") }
            .onSuccess { _state.value = _state.value.copy(notice = "Жалоба отправлена модераторам.", error = null) }
            .onFailure { _state.value = _state.value.copy(error = it.message ?: "Не удалось отправить жалобу.") }
    }

    fun delete(commentId: String) {
        if (commentId in _state.value.deletingIds) return
        _state.value = _state.value.copy(deletingIds = _state.value.deletingIds + commentId)
        viewModelScope.launch {
            runCatching { repository.delete(commentId) }
                .onSuccess { _state.value = _state.value.copy(items = _state.value.items.filterNot { it.id == commentId }, deletingIds = _state.value.deletingIds - commentId, notice = "Комментарий удалён.", error = null) }
                .onFailure { _state.value = _state.value.copy(deletingIds = _state.value.deletingIds - commentId, error = it.message ?: "Не удалось удалить комментарий.") }
        }
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
