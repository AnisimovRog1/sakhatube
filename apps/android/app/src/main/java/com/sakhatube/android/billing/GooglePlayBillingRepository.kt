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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Google Play Billing transport only. A Play purchase is never a SakhaTube
 * entitlement by itself: every purchase token must be checked by the backend
 * against the Google Play Developer API before access can be granted.
 */
class GooglePlayBillingRepository(context: Context) : PurchasesUpdatedListener {
    // This flips only when the backend endpoint below verifies a Play token
    // using the Google Play Developer API and persists the entitlement.
    // Keeping it false prevents accidental real charges during development.
    private val serverPurchaseVerificationImplemented = false
    private val _state = MutableStateFlow(BillingUiState.Disabled)
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
            serverPurchaseVerificationImplemented &&
            BuildConfig.PLAY_SUBSCRIPTION_PRODUCT_ID.isNotBlank()

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
                // Intentionally no local restore. Tokens must be submitted to
                // and verified by the server before a viewer receives access.
                _state.value = BillingUiState.AwaitingServerVerification
            }
        }
    }

    override fun onPurchasesUpdated(result: BillingResult, purchases: MutableList<Purchase>?) {
        when (result.responseCode) {
            BillingClient.BillingResponseCode.OK -> {
                // Do not acknowledge or unlock here. Server verification and
                // durable entitlement storage must happen first.
                _state.value = BillingUiState.AwaitingServerVerification
            }
            BillingClient.BillingResponseCode.USER_CANCELED -> _state.value = BillingUiState.Ready(productDetails?.name ?: "Подписка")
            else -> _state.value = BillingUiState.Error("Не удалось завершить оплату: ${result.debugMessage}")
        }
    }

    fun close() {
        if (client.isReady) client.endConnection()
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
