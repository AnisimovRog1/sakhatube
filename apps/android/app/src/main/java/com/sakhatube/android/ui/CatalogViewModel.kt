package com.sakhatube.android.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sakhatube.android.data.CatalogRepository
import com.sakhatube.android.data.CatalogUiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class CatalogViewModel(
    private val repository: CatalogRepository = CatalogRepository()
) : ViewModel() {
    private val _state = MutableStateFlow<CatalogUiState>(CatalogUiState.Loading)
    val state: StateFlow<CatalogUiState> = _state.asStateFlow()

    init {
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = CatalogUiState.Loading
            runCatching { repository.loadHome() }
                .onSuccess { home ->
                    _state.value = if (home.items.isEmpty()) CatalogUiState.Empty else CatalogUiState.Content(home)
                }
                .onFailure { error ->
                    _state.value = CatalogUiState.Error(
                        error.message?.takeIf { it.isNotBlank() }
                            ?: "Не удалось связаться с SakhaTube."
                    )
                }
        }
    }
}
