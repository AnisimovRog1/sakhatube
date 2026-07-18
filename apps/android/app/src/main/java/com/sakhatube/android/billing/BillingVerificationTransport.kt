package com.sakhatube.android.billing

import com.sakhatube.android.BuildConfig
import com.sakhatube.android.data.AuthRepository
import com.sakhatube.android.data.EncryptedViewerSessionStore
import com.sakhatube.android.data.ViewerSessionStore
import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Delivers a Play purchase token to the SakhaTube backend. This is transport,
 * never proof of payment: a non-2xx response means no local entitlement, no
 * acknowledgement and no access change. Tokens are not logged or persisted.
 */
class BillingVerificationTransport(
    context: Context,
    private val baseUrl: String = BuildConfig.AUTH_BASE_URL,
    private val sessions: ViewerSessionStore = EncryptedViewerSessionStore(context),
    private val authRepository: AuthRepository = AuthRepository(context.applicationContext, sessionStore = sessions)
) {
    suspend fun submitGooglePurchase(productKey: String, purchaseToken: String) = withContext(Dispatchers.IO) {
        // ensureValidAccessToken so a purchase attempted after 15 minutes of
        // browsing doesn't get rejected with "sign in" for a viewer who
        // never signed out.
        val accessToken = authRepository.ensureValidAccessToken()
            ?: throw IOException("Войди в SakhaTube перед оплатой.")
        require(productKey.matches(Regex("[a-z][a-z0-9_]{2,63}"))) { "Некорректный продукт." }
        require(purchaseToken.length in 20..4096) { "Некорректное подтверждение Google Play." }
        val url = URL("${baseUrl.trim().removeSuffix("/")}/v1/billing/android/purchases")
        if (url.protocol != "https") throw IOException("Проверка покупок доступна только по защищённому соединению.")
        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 12_000
            readTimeout = 15_000
            doOutput = true
            setRequestProperty("Accept", "application/json")
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("User-Agent", "SakhaTube-Android/0.1")
        }
        try {
            connection.outputStream.bufferedWriter(Charsets.UTF_8).use {
                it.write(JSONObject().put("productKey", productKey).put("purchaseToken", purchaseToken).toString())
            }
            if (connection.responseCode !in 200..299) {
                throw IOException("Сервер не подтвердил покупку. Доступ не открыт.")
            }
        } finally {
            connection.disconnect()
        }
    }
}
