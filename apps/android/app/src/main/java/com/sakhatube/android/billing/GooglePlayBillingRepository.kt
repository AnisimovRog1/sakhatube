package com.sakhatube.android.billing

import android.app.Activity
import android.content.Context
import com.android.billingclient.api.BillingClient
import com.android.billingclient.api.BillingClientStateListener
import com.android.billingclient.api.BillingFlowParams
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.android.billingclient.api.PurchasesUpdatedListener
import com.android.billingclient.api.QueryProductDetailsParams
import com.android.billingclient.api.QueryPurchasesParams
import com.sakhatube.android.BuildConfig
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Google Play Billing transport only. A Play purchase is never a SakhaTube
 * entitlement by itself: every purchase token must be checked by the backend
 * against the Google Play Developer API before access can be granted.
 */
class GooglePlayBillingRepository(context: Context) : PurchasesUpdatedListener {
    private val verificationTransport = BillingVerificationTransport(context.applicationContext)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val _state = MutableStateFlow<BillingUiState>(BillingUiState.Disabled)
    val state: StateFlow<BillingUiState> = _state.asStateFlow()

    private var productDetails: ProductDetails? = null
    private val client = BillingClient.newBuilder(context.applicationContext)
        .setListener(this)
        .enablePendingPurchases(
            com.android.billingclient.api.PendingPurchasesParams.newBuilder()
                .enableOneTimeProducts()
                .build()
        )
        .build()

    private val configured: Boolean
        get() = BuildConfig.PLAY_BILLING_ENABLED &&
            BuildConfig.PLAY_BILLING_SERVER_VERIFICATION_ENABLED &&
            BuildConfig.PLAY_SUBSCRIPTION_PRODUCT_ID.isNotBlank() &&
            BuildConfig.PLAY_SUBSCRIPTION_PRODUCT_KEY.matches(Regex("[a-z][a-z0-9_]{2,63}"))

    fun connectAndLoad() {
        if (!configured) {
            _state.value = BillingUiState.Disabled
            return
        }
        _state.value = BillingUiState.Loading
        client.startConnection(object : BillingClientStateListener {
            override fun onBillingSetupFinished(result: BillingResult) {
                if (result.responseCode != BillingClient.BillingResponseCode.OK) {
                    _state.value = BillingUiState.Error("Google Play недоступен: ${result.debugMessage}")
                    return
                }
                querySubscription()
                restorePurchases()
            }

            override fun onBillingServiceDisconnected() {
                // Do not retry in a loop. The user can explicitly retry.
                _state.value = BillingUiState.Error("Связь с Google Play потеряна. Попробуй ещё раз.")
            }
        })
    }

    private fun querySubscription() {
        val products = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(BuildConfig.PLAY_SUBSCRIPTION_PRODUCT_ID)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        )
        client.queryProductDetailsAsync(
            QueryProductDetailsParams.newBuilder().setProductList(products).build()
        ) { result, details ->
            if (result.responseCode != BillingClient.BillingResponseCode.OK || details.productDetailsList.isEmpty()) {
                _state.value = BillingUiState.Error("Подписка пока недоступна. Проверь продукт в Google Play Console.")
                return@queryProductDetailsAsync
            }
            productDetails = details.productDetailsList.first()
            _state.value = BillingUiState.Ready(productDetails!!.name)
        }
    }

    fun launchPurchase(activity: Activity) {
        val details = productDetails ?: run {
            _state.value = BillingUiState.Error("Сначала обнови информацию о подписке.")
            return
        }
        val offerToken = details.subscriptionOfferDetails
            ?.firstOrNull()
            ?.offerToken ?: run {
            _state.value = BillingUiState.Error("Для подписки нет активного предложения в Google Play Console.")
            return
        }
        val params = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(
                listOf(
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(details)
                        .setOfferToken(offerToken)
                        .build()
                )
            )
            .build()
        client.launchBillingFlow(activity, params)
    }

    fun restorePurchases() {
        if (!configured || !client.isReady) return
        client.queryPurchasesAsync(
            QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.SUBS).build()
        ) { result, purchases ->
            if (result.responseCode == BillingClient.BillingResponseCode.OK && purchases.isNotEmpty()) {
                submitPurchases(purchases)
            }
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                submitPurchases(purchases.orEmpty())
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> _state.value = BillingUiState.Ready(productDetails?.name ?: "Подписка")
            else -> _state.value = BillingUiState.Error("Не удалось завершить оплату: ${result.debugMessage}")
        }
    }

    fun close() {
        scope.coroutineContext.cancel()
        if (client.isReady) client.endConnection()
    }

    private fun submitPurchases(purchases: List<Purchase>) {
        val eligible = purchases.filter {
            it.purchaseState == Purchase.PurchaseState.PURCHASED &&
                it.products.contains(BuildConfig.PLAY_SUBSCRIPTION_PRODUCT_ID) &&
                it.purchaseToken.length in 20..4096
        }
        if (eligible.isEmpty()) {
            _state.value = BillingUiState.Error("Google Play не вернул подтверждённую покупку.")
            return
        }
        _state.value = BillingUiState.AwaitingServerVerification
        scope.launch {
            runCatching {
                eligible.forEach { purchase ->
                    verificationTransport.submitGooglePurchase(
                        productKey = BuildConfig.PLAY_SUBSCRIPTION_PRODUCT_KEY,
                        purchaseToken = purchase.purchaseToken
                    )
                }
            }.onFailure {
                // Never acknowledge or unlock locally. The viewer can retry
                // Restore once official backend validation is available.
                _state.value = BillingUiState.Error(it.message ?: "Сервер не подтвердил покупку. Доступ не открыт.")
            }
        }
    }
}

sealed interface BillingUiState {
    data object Disabled : BillingUiState
    data object Loading : BillingUiState
    data class Ready(val productName: String) : BillingUiState
    /** A purchase exists, but only the server can decide whether access is granted. */
    data object AwaitingServerVerification : BillingUiState
    data class Error(val message: String) : BillingUiState
}
