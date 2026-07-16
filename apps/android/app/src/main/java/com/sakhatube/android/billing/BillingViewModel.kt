package com.sakhatube.android.billing

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class BillingViewModel(application: Application) : AndroidViewModel(application) {
    private val repository = GooglePlayBillingRepository(application.applicationContext)
    val state: StateFlow<BillingUiState> = repository.state

    fun load() = viewModelScope.launch { repository.connectAndLoad() }
    fun restore() = viewModelScope.launch { repository.restorePurchases() }
    fun purchase(activity: Activity) = repository.launchPurchase(activity)

    override fun onCleared() {
        repository.close()
    }
}
