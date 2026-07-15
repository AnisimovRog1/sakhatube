package com.sakhatube.android.data

import com.sakhatube.android.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Public, read-only client for the published catalog.
 * No auth token, purchase state, playback URL or personal profile is requested here.
 */
class CatalogRepository(
    private val baseUrl: String = BuildConfig.CATALOG_BASE_URL
) {
    suspend fun loadHome(): CatalogHome = withContext(Dispatchers.IO) {
        val normalizedBaseUrl = baseUrl.trim().removeSuffix("/")
        val endpoint = "$normalizedBaseUrl/v1/catalog/home"
        val response = requestJson(endpoint)
        val items = response.optJSONArray("items").toCatalogItems()
        val hero = response.optJSONObject("hero").toCatalogItem()
            ?.takeIf { heroItem -> items.any { it.id == heroItem.id } }
            ?: items.firstOrNull()
        val shelves = response.optJSONArray("shelves").toCatalogShelves()

        CatalogHome(hero = hero, shelves = shelves, items = items)
    }

    private fun requestJson(endpoint: String): JSONObject {
        val url = runCatching { URL(endpoint) }.getOrElse {
            throw IOException("Адрес каталога настроен неверно.", it)
        }
        if (url.protocol != "https") {
            throw IOException("Каталог доступен только по защищённому соединению.")
        }

        val connection = (url.openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 12_000
            readTimeout = 15_000
            setRequestProperty("Accept", "application/json")
            setRequestProperty("User-Agent", "SakhaTube-Android/0.1")
        }

        return try {
            val status = connection.responseCode
            if (status !in 200..299) {
                throw IOException("Сервис временно недоступен (код $status).")
            }
            val body = connection.inputStream.bufferedReader().use { it.readText() }
            JSONObject(body)
        } catch (error: IOException) {
            throw error
        } catch (error: Exception) {
            throw IOException("Сервис вернул некорректный ответ.", error)
        } finally {
            connection.disconnect()
        }
    }
}

private fun JSONArray?.toCatalogItems(): List<CatalogItem> {
    if (this == null) return emptyList()
    return buildList {
        for (index in 0 until length()) {
            optJSONObject(index).toCatalogItem()?.let(::add)
        }
    }
}

private fun JSONObject?.toCatalogItem(): CatalogItem? {
    if (this == null) return null
    val status = optString("status").trim().lowercase()
    val id = optString("id").trim()
    val title = optString("title").trim()
    val genre = optString("genre").trim()
    if (status != "published" || id.isEmpty() || title.isEmpty() || genre.isEmpty()) return null

    return CatalogItem(
        id = id,
        title = title,
        kind = optString("kind", "series"),
        genre = genre,
        synopsis = optString("synopsis").trim().ifBlank { "Описание появится после публикации карточки." },
        access = optString("access", "free"),
        episodes = optInt("episodes", 1),
        createdAt = optString("createdAt").trim().ifBlank { null }
    )
}

private fun JSONArray?.toCatalogShelves(): List<CatalogShelf> {
    if (this == null) return emptyList()
    return buildList {
        for (index in 0 until length()) {
            val shelf = optJSONObject(index) ?: continue
            val items = shelf.optJSONArray("items").toCatalogItems()
            val id = shelf.optString("id").trim()
            val title = shelf.optString("title").trim()
            if (id.isNotEmpty() && title.isNotEmpty() && items.isNotEmpty()) {
                add(CatalogShelf(id = id, title = title, items = items))
            }
        }
    }
}
