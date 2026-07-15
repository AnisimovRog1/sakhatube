package com.sakhatube.android.data

data class CatalogItem(
    val id: String,
    val title: String,
    val kind: String,
    val genre: String,
    val synopsis: String,
    val access: String,
    val episodes: Int,
    val createdAt: String?
) {
    val eyebrow: String
        get() = listOf(kind.displayName(), access.displayName()).joinToString(" · ")

    val metadata: String
        get() = listOfNotNull(createdAt?.take(4), genre, "${episodes.coerceAtLeast(1)} сер.").joinToString(" · ")

    private fun String.displayName(): String = when (lowercase()) {
        "series" -> "СЕРИАЛ"
        "episode" -> "ЭПИЗОД"
        "trailer" -> "ТРЕЙЛЕР"
        "clip" -> "КЛИП"
        "free" -> "БЕСПЛАТНО"
        "subscription" -> "ПО ПОДПИСКЕ"
        "purchase" -> "ПОКУПКА"
        else -> uppercase()
    }
}

data class CatalogShelf(
    val id: String,
    val title: String,
    val items: List<CatalogItem>
)

data class CatalogHome(
    val hero: CatalogItem?,
    val shelves: List<CatalogShelf>,
    val items: List<CatalogItem>
)

sealed interface CatalogUiState {
    data object Loading : CatalogUiState
    data object Empty : CatalogUiState
    data class Content(val home: CatalogHome) : CatalogUiState
    data class Error(val message: String) : CatalogUiState
}
