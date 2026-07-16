package com.sakhatube.android.ui

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Forum
import androidx.compose.material.icons.outlined.Flag
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sakhatube.android.BuildConfig
import com.sakhatube.android.data.CatalogHome
import com.sakhatube.android.data.CatalogItem
import com.sakhatube.android.data.CatalogUiState
import com.sakhatube.android.data.AuthUiState
import com.sakhatube.android.data.DeletionUiState
import com.sakhatube.android.data.ViewerComment
import com.sakhatube.android.billing.BillingUiState
import com.sakhatube.android.billing.BillingViewModel

private enum class Destination(val title: String) {
    Home("Главная"),
    Catalog("Каталог"),
    Profile("Профиль")
}

@Composable
fun SakhaTubeApp(viewModel: CatalogViewModel = viewModel(), authViewModel: AuthViewModel = viewModel()) {
    val catalogState by viewModel.state.collectAsStateWithLifecycle()
    var destination by remember { mutableStateOf(Destination.Home) }
    var selectedContent by remember { mutableStateOf<CatalogItem?>(null) }
    val playbackViewModel: PlaybackViewModel = viewModel()
    val commentsViewModel: CommentsViewModel = viewModel()

    Scaffold(
        topBar = {
            AppTopBar(
                title = if (selectedContent == null) destination.title else "Просмотр",
                onBack = selectedContent?.let { { selectedContent = null } }
            )
        },
        bottomBar = {
            BottomAppBar {
                Destination.entries.forEach { entry ->
                    val icon = when (entry) {
                        Destination.Home -> Icons.Outlined.Home
                        Destination.Catalog -> Icons.Outlined.Movie
                        Destination.Profile -> Icons.Outlined.AccountCircle
                    }
                    NavigationBarItem(
                        selected = destination == entry,
                        onClick = { selectedContent = null; destination = entry },
                        icon = { Icon(icon, contentDescription = null) },
                        label = { Text(entry.title) }
                    )
                }
            }
        }
    ) { padding ->
        val selected = selectedContent
        if (selected != null) {
            PlaybackScreen(
                item = selected,
                viewModel = playbackViewModel,
                commentsViewModel = commentsViewModel,
                onSignIn = { selectedContent = null; destination = Destination.Profile },
                onClose = { selectedContent = null },
                modifier = Modifier.padding(padding)
            )
        } else when (destination) {
            Destination.Home -> HomeScreen(
                state = catalogState,
                onRetry = viewModel::refresh,
                onOpen = { selectedContent = it },
                modifier = Modifier.padding(padding)
            )
            Destination.Catalog -> CatalogScreen(
                state = catalogState,
                onRetry = viewModel::refresh,
                onOpen = { selectedContent = it },
                modifier = Modifier.padding(padding)
            )
            Destination.Profile -> ProfileScreen(authViewModel, modifier = Modifier.padding(padding))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppTopBar(title: String, onBack: (() -> Unit)? = null) {
    TopAppBar(
        navigationIcon = {
            if (onBack != null) IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Назад")
            }
        },
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Sakha", fontWeight = FontWeight.Black)
                Text("Tube", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Black)
                if (title != "Главная") {
                    Spacer(Modifier.width(10.dp))
                    Text(title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.background
        )
    )
}

@Composable
private fun HomeScreen(
    state: CatalogUiState,
    onRetry: () -> Unit,
    onOpen: (CatalogItem) -> Unit,
    modifier: Modifier = Modifier
) {
    when (val currentState = state) {
        CatalogUiState.Loading -> CatalogLoading(modifier)
        CatalogUiState.Empty -> CatalogEmpty(modifier)
        is CatalogUiState.Error -> CatalogError(currentState.message, onRetry, modifier)
        is CatalogUiState.Content -> HomeContent(currentState.home, onOpen, modifier)
    }
}

@Composable
private fun HomeContent(home: CatalogHome, onOpen: (CatalogItem) -> Unit, modifier: Modifier = Modifier) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        home.hero?.let { hero ->
            item {
                HeroCard(hero, onClick = { onOpen(hero) }, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
            }
        }
        items(home.shelves, key = { it.id }) { shelf ->
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    shelf.title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(shelf.items, key = { it.id }) { item ->
                        PosterCard(item, onClick = { onOpen(item) }, modifier = Modifier.width(148.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun CatalogScreen(
    state: CatalogUiState,
    onRetry: () -> Unit,
    onOpen: (CatalogItem) -> Unit,
    modifier: Modifier = Modifier
) {
    when (val currentState = state) {
        CatalogUiState.Loading -> CatalogLoading(modifier)
        CatalogUiState.Empty -> CatalogEmpty(modifier)
        is CatalogUiState.Error -> CatalogError(state.message, onRetry, modifier)
        is CatalogUiState.Content -> {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(minSize = 148.dp),
                modifier = modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                items(state.home.items, key = { it.id }) { item -> PosterCard(item, onClick = { onOpen(item) }) }
            }
        }
    }
}

@Composable
private fun PlaybackScreen(
    item: CatalogItem,
    viewModel: PlaybackViewModel,
    commentsViewModel: CommentsViewModel,
    onSignIn: () -> Unit,
    onClose: () -> Unit,
    modifier: Modifier = Modifier
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    BackHandler(onBack = onClose)
    LaunchedEffect(item.id) { viewModel.open(item.id) }

    when (val currentState = state) {
        PlaybackUiState.Idle, PlaybackUiState.Loading -> PlaybackStatus(
            title = "Подготавливаем просмотр",
            message = "Проверяем доступ и подбираем готовую версию видео.",
            loading = true,
            modifier = modifier
        )
        is PlaybackUiState.Ready -> SecureHlsPlayer(
            item = item,
            session = currentState.session,
            onEvent = { event, positionMs, errorCode ->
                viewModel.report(item.id, currentState.session.sessionId, event, positionMs, errorCode)
            },
            commentsViewModel = commentsViewModel,
            onSignIn = onSignIn,
            modifier = modifier
        )
        is PlaybackUiState.Paywall -> PlaybackStatus(
            title = "Нужен доступ",
            message = currentState.message,
            actionLabel = "Закрыть",
            onAction = onClose,
            modifier = modifier
        )
        is PlaybackUiState.Processing -> PlaybackStatus(
            title = "Видео обрабатывается",
            message = currentState.message,
            actionLabel = "Проверить снова",
            onAction = { viewModel.retry(item.id) },
            modifier = modifier
        )
        is PlaybackUiState.Unavailable -> PlaybackStatus(
            title = "Просмотр недоступен",
            message = currentState.message,
            actionLabel = "Повторить",
            onAction = { viewModel.retry(item.id) },
            modifier = modifier
        )
    }
}

@Composable
private fun SecureHlsPlayer(
    item: CatalogItem,
    session: com.sakhatube.android.data.PlaybackSession,
    onEvent: (event: String, positionMs: Long?, errorCode: String?) -> Unit,
    commentsViewModel: CommentsViewModel,
    onSignIn: () -> Unit,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val player = remember(session.manifestUrl) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(session.manifestUrl))
            prepare()
            playWhenReady = true
        }
    }
    DisposableEffect(player) {
        var firstFrameReported = false
        val listener = object : Player.Listener {
            override fun onRenderedFirstFrame() {
                if (!firstFrameReported) {
                    firstFrameReported = true
                    onEvent("first_frame", player.currentPosition, null)
                }
            }
            override fun onPlayerError(error: androidx.media3.common.PlaybackException) {
                onEvent("error", player.currentPosition, error.errorCodeName)
            }
        }
        player.addListener(listener)
        onEvent("intent", 0, null)
        onDispose {
            onEvent("pause", player.currentPosition, null)
            player.removeListener(listener)
            player.release()
        }
    }
    Column(
        modifier = modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        AndroidView(
            modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).clip(RoundedCornerShape(20.dp)),
            factory = { viewContext -> PlayerView(viewContext).apply { this.player = player; useController = true } },
            update = { it.player = player }
        )
        Text(item.title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
        Text(item.synopsis, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("Защищённое воспроизведение", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
        CommentsSection(item.id, commentsViewModel, onSignIn)
    }
}

@Composable
private fun CommentsSection(contentId: String, viewModel: CommentsViewModel, onSignIn: () -> Unit) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    var text by remember(contentId) { mutableStateOf("") }
    var reportTarget by remember { mutableStateOf<ViewerComment?>(null) }
    var blockTarget by remember { mutableStateOf<ViewerComment?>(null) }
    var pendingCommentText by remember(contentId) { mutableStateOf("") }
    var showCommunityConsent by remember(contentId) { mutableStateOf(false) }
    val context = LocalContext.current
    LaunchedEffect(contentId) { viewModel.load(contentId) }

    if (reportTarget != null) {
        AlertDialog(
            onDismissRequest = { reportTarget = null },
            title = { Text("Пожаловаться?") },
            text = { Text("Жалоба будет отправлена модераторам. Мы не сообщим автору, кто её отправил.") },
            confirmButton = { TextButton(onClick = { viewModel.report(reportTarget!!.id); reportTarget = null }) { Text("Отправить") } },
            dismissButton = { TextButton(onClick = { reportTarget = null }) { Text("Отмена") } }
        )
    }

    if (blockTarget != null) {
        AlertDialog(
            onDismissRequest = { blockTarget = null },
            title = { Text("Заблокировать пользователя?") },
            text = { Text("Его комментарии будут скрыты для тебя. Пользователь не получит уведомление о блокировке.") },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.blockAuthor(blockTarget!!.id)
                    blockTarget = null
                }) { Text("Заблокировать") }
            },
            dismissButton = { TextButton(onClick = { blockTarget = null }) { Text("Отмена") } }
        )
    }

    if (showCommunityConsent) {
        val rulesUrl = BuildConfig.COMMUNITY_RULES_URL.takeIf { it.startsWith("https://") }
        val termsUrl = BuildConfig.TERMS_URL.takeIf { it.startsWith("https://") }
        AlertDialog(
            onDismissRequest = { showCommunityConsent = false },
            title = { Text("Правила сообщества") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Перед первой публикацией комментария нужно принять правила сообщества и пользовательское соглашение.")
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        TextButton(onClick = { rulesUrl?.let { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) } }, enabled = rulesUrl != null) { Text("Правила") }
                        TextButton(onClick = { termsUrl?.let { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) } }, enabled = termsUrl != null) { Text("Соглашение") }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.acceptCommunityRulesAndPost(contentId, pendingCommentText) {
                        text = ""
                        pendingCommentText = ""
                    }
                    showCommunityConsent = false
                }) { Text("Принимаю") }
            },
            dismissButton = { TextButton(onClick = { showCommunityConsent = false }) { Text("Отмена") } }
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Outlined.Forum, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.width(8.dp))
            Text("Комментарии", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        if (viewModel.signedIn()) {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it.take(1_000) },
                label = { Text("Написать комментарий") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                maxLines = 4
            )
            Button(
                onClick = {
                    if (viewModel.hasAcceptedCommunityRules()) {
                        viewModel.post(contentId, text)
                        text = ""
                    } else {
                        pendingCommentText = text
                        showCommunityConsent = true
                    }
                },
                enabled = text.trim().isNotEmpty()
            ) { Text("Отправить") }
        } else {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
                Row(modifier = Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Войди, чтобы писать комментарии и отправлять жалобы.", modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    TextButton(onClick = onSignIn) { Text("Войти") }
                }
            }
        }
        state.notice?.let { Text(it, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium) }
        state.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
        if (state.loading) CircularProgressIndicator(modifier = Modifier.size(24.dp))
        else if (state.items.isEmpty()) Text("Пока нет комментариев. Будь первым.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        else state.items.forEach { comment ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                        Text(comment.authorName, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                        if (comment.status != null) Text("На модерации", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        else if (viewModel.canBlock(comment)) {
                            Row {
                                IconButton(onClick = { reportTarget = comment }, modifier = Modifier.size(36.dp)) {
                                    Icon(Icons.Outlined.Flag, contentDescription = "Пожаловаться")
                                }
                                IconButton(onClick = { blockTarget = comment }, modifier = Modifier.size(36.dp)) {
                                    Icon(Icons.Outlined.Block, contentDescription = "Заблокировать автора")
                                }
                            }
                        }
                    }
                    Text(comment.text)
                    if (comment.status != null && viewModel.canDelete(comment)) {
                        TextButton(onClick = { viewModel.delete(comment.id) }) {
                            Icon(Icons.Outlined.Delete, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("Удалить")
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PlaybackStatus(
    title: String,
    message: String,
    loading: Boolean = false,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (loading) CircularProgressIndicator(modifier = Modifier.size(36.dp))
        else Icon(Icons.Outlined.Movie, contentDescription = null, modifier = Modifier.size(44.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(18.dp))
        Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Text(message, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(22.dp))
            Button(onClick = onAction) { Text(actionLabel) }
        }
    }
}

@Composable
private fun HeroCard(item: CatalogItem, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .semantics { contentDescription = "Премьера: ${item.title}" },
        onClick = onClick,
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(382.dp)
                .background(posterBrush(item.id))
                .padding(22.dp),
            contentAlignment = Alignment.BottomStart
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Text(
                    item.eyebrow,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.9f))
                        .padding(horizontal = 10.dp, vertical = 6.dp)
                )
                Text(item.title, style = MaterialTheme.typography.displaySmall, fontWeight = FontWeight.Black)
                Text(
                    item.synopsis,
                    style = MaterialTheme.typography.bodyLarge,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.88f)
                )
                Text(item.metadata, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun PosterCard(item: CatalogItem, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.semantics { contentDescription = "${item.title}, ${item.metadata}" },
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Card(onClick = onClick, shape = RoundedCornerShape(18.dp)) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(0.68f)
                .clip(RoundedCornerShape(18.dp))
                .background(posterBrush(item.id))
                .padding(12.dp),
            contentAlignment = Alignment.BottomStart
        ) {
            Text(
                item.eyebrow,
                style = MaterialTheme.typography.labelSmall,
                fontWeight = FontWeight.Bold,
                color = Color.White.copy(alpha = 0.86f),
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        }
        }
        Text(item.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text(item.metadata, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

private fun posterBrush(id: String): Brush {
    val palettes = listOf(
        listOf(Color(0xFF1C3D61), Color(0xFF12172A), Color(0xFF05070C)),
        listOf(Color(0xFF7A2658), Color(0xFF29234B), Color(0xFF080A10)),
        listOf(Color(0xFF1C635D), Color(0xFF183C54), Color(0xFF090B11)),
        listOf(Color(0xFF714129), Color(0xFF34234D), Color(0xFF090B11))
    )
    val palette = palettes[(id.hashCode() and Int.MAX_VALUE) % palettes.size]
    return Brush.verticalGradient(palette)
}

@Composable
private fun CatalogLoading(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        CircularProgressIndicator(modifier = Modifier.size(36.dp))
        Spacer(Modifier.height(18.dp))
        Text("Загружаем витрину", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
        Spacer(Modifier.height(6.dp))
        Text("Покажем только опубликованные материалы.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun CatalogEmpty(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(Icons.Outlined.Movie, null, modifier = Modifier.size(40.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(14.dp))
        Text("Витрина пока пуста", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text("Опубликованные карточки из Studio появятся здесь.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun CatalogError(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Icon(Icons.Outlined.Refresh, null, modifier = Modifier.size(40.dp), tint = MaterialTheme.colorScheme.primary)
        Spacer(Modifier.height(14.dp))
        Text("Не удалось открыть витрину", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(6.dp))
        Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(20.dp))
        Button(onClick = onRetry) { Text("Повторить") }
    }
}

@Composable
private fun ProfileScreen(
    authViewModel: AuthViewModel,
    billingViewModel: BillingViewModel = viewModel(),
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val authState by authViewModel.state.collectAsStateWithLifecycle()
    val deletionState by authViewModel.deletionState.collectAsStateWithLifecycle()
    val billingState by billingViewModel.state.collectAsStateWithLifecycle()
    var isShowingDeletion by remember { mutableStateOf(false) }
    var email by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var mode by remember { mutableStateOf(ProfileMode.SignIn) }
    val legalLinks = listOf(
        "Политика конфиденциальности" to BuildConfig.PRIVACY_POLICY_URL,
        "Пользовательское соглашение" to BuildConfig.TERMS_URL,
        "Удаление аккаунта и данных" to BuildConfig.ACCOUNT_DELETION_URL
    )

    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        item {
            val signedInViewer = (authState as? AuthUiState.SignedIn)?.viewer
            when (authState) {
                is AuthUiState.SignedIn -> SignedInProfileCard(
                    viewerName = requireNotNull(signedInViewer).displayName,
                    username = signedInViewer.username,
                    publicId = signedInViewer.id,
                    email = signedInViewer.email,
                    onSignOut = authViewModel::signOut,
                    onRequestDeletion = {
                        authViewModel.clearDeletionState()
                        isShowingDeletion = true
                    }
                )
                else -> AuthCard(
                    mode = mode,
                    email = email,
                    username = username,
                    password = password,
                    displayName = displayName,
                    state = authState,
                    onModeChange = { mode = it; authViewModel.dismissError() },
                    onEmailChange = { email = it },
                    onUsernameChange = { username = it },
                    onPasswordChange = { password = it },
                    onDisplayNameChange = { displayName = it },
                    onRegister = {
                        authViewModel.register(email, username, password.toCharArray(), displayName)
                        password = ""
                    },
                    onLogin = {
                        authViewModel.login(email, password.toCharArray())
                        password = ""
                    }
                )
            }
        }
        item {
            BillingCard(
                state = billingState,
                onLoad = billingViewModel::load,
                onRestore = billingViewModel::restore,
                onPurchase = {
                    (context as? android.app.Activity)?.let(billingViewModel::purchase)
                }
            )
        }
        item { Text("Документы", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold) }
        items(legalLinks, key = { it.first }) { (title, url) ->
            val validUrl = url.takeIf { it.startsWith("https://") }
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(title, fontWeight = FontWeight.SemiBold)
                        Text(
                            if (validUrl == null) "Ссылка будет добавлена в релизной конфигурации." else "Открыть в браузере",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Button(
                        onClick = {
                            validUrl?.let { url ->
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                            }
                        },
                        enabled = validUrl != null
                    ) { Text("Открыть") }
                }
            }
        }
    }
    if (isShowingDeletion && authState is AuthUiState.SignedIn) {
        DeletionRequestDialog(
            state = deletionState,
            onDismiss = {
                authViewModel.clearDeletionState()
                isShowingDeletion = false
            },
            onSubmit = authViewModel::deleteAccount
        )
    }
}

@Composable
private fun BillingCard(
    state: BillingUiState,
    onLoad: () -> Unit,
    onRestore: () -> Unit,
    onPurchase: () -> Unit
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Подписка", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            when (state) {
                BillingUiState.Disabled -> Text(
                    "Оплата пока не подключена. Доступ не выдаётся до серверной проверки покупок.",
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                BillingUiState.Loading -> CircularProgressIndicator(modifier = Modifier.size(24.dp))
                is BillingUiState.Ready -> {
                    Text(state.productName, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(onClick = onPurchase) { Text("Оформить в Google Play") }
                        TextButton(onClick = onRestore) { Text("Восстановить") }
                    }
                }
                BillingUiState.AwaitingServerVerification -> Text(
                    "Покупка получена. Проверяем её на сервере — доступ появится только после подтверждения.",
                    color = MaterialTheme.colorScheme.primary
                )
                is BillingUiState.Error -> {
                    Text(state.message, color = MaterialTheme.colorScheme.error)
                    TextButton(onClick = onLoad) { Text("Повторить") }
                }
            }
            if (state is BillingUiState.Disabled) TextButton(onClick = onLoad) { Text("Проверить доступность") }
        }
    }
}

private enum class ProfileMode { SignIn, Register }

@Composable
private fun SignedInProfileCard(
    viewerName: String,
    username: String,
    publicId: String,
    email: String,
    onSignOut: () -> Unit,
    onRequestDeletion: () -> Unit
) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(viewerName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text("@$username · ID $publicId", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(email, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                "Вход защищён: пароль не хранится в приложении, а сессия автоматически истекает.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onSignOut) { Text("Выйти") }
                TextButton(onClick = onRequestDeletion) { Text("Удалить аккаунт") }
            }
        }
    }
}

@Composable
private fun DeletionRequestDialog(
    state: DeletionUiState,
    onDismiss: () -> Unit,
    onSubmit: () -> Unit
) {
    var confirmation by remember { mutableStateOf("") }
    val sending = state is DeletionUiState.Sending
    val isConfirmed = confirmation.trim() == "DELETE"

    AlertDialog(
        onDismissRequest = { if (!sending) onDismiss() },
        title = { Text("Удаление аккаунта") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Это действие необратимо. Аккаунт, активные сессии и связанные комментарии будут удалены или обезличены сразу после подтверждения.")
                OutlinedTextField(
                    value = confirmation,
                    onValueChange = { confirmation = it },
                    label = { Text("Напиши DELETE для подтверждения") },
                    enabled = !sending,
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                when (state) {
                    is DeletionUiState.Error -> Text(state.message, color = MaterialTheme.colorScheme.error)
                    is DeletionUiState.Requested -> Text(state.message, color = MaterialTheme.colorScheme.primary)
                    else -> Unit
                }
            }
        },
        confirmButton = {
            if (state is DeletionUiState.Requested) {
                TextButton(onClick = onDismiss) { Text("Готово") }
            } else {
                Button(onClick = onSubmit, enabled = isConfirmed && !sending) {
                    if (sending) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    else Text("Удалить навсегда")
                }
            }
        },
        dismissButton = {
            if (!sending) TextButton(onClick = onDismiss) { Text("Отмена") }
        }
    )
}

@Composable
private fun AuthCard(
    mode: ProfileMode,
    email: String,
    username: String,
    password: String,
    displayName: String,
    state: AuthUiState,
    onModeChange: (ProfileMode) -> Unit,
    onEmailChange: (String) -> Unit,
    onUsernameChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onDisplayNameChange: (String) -> Unit,
    onRegister: () -> Unit,
    onLogin: () -> Unit
) {
    val pending = state is AuthUiState.Registering || state is AuthUiState.SigningIn
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                when (mode) {
                    ProfileMode.SignIn -> "Войти в SakhaTube"
                    ProfileMode.Register -> "Создать аккаунт"
                },
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            when (mode) {
                ProfileMode.SignIn, ProfileMode.Register -> {
                    if (mode == ProfileMode.Register) {
                        AppField("Имя", displayName, onDisplayNameChange, enabled = !pending)
                        AppField("Логин", username, onUsernameChange, enabled = !pending)
                        AppField("E-mail", email, onEmailChange, enabled = !pending, keyboardType = KeyboardType.Email)
                    } else {
                        AppField("E-mail", email, onEmailChange, enabled = !pending, keyboardType = KeyboardType.Email)
                    }
                    AppField("Пароль", password, onPasswordChange, enabled = !pending, password = true)
                    if (mode == ProfileMode.Register) {
                        Text("Минимум 12 символов. Пароль не сохраняется на устройстве.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
            when (state) {
                is AuthUiState.Error -> Text(state.message, color = MaterialTheme.colorScheme.error)
                is AuthUiState.VerificationRequired -> Text(state.message, color = MaterialTheme.colorScheme.primary)
                else -> Unit
            }
            Button(
                onClick = when (mode) {
                    ProfileMode.SignIn -> onLogin
                    ProfileMode.Register -> onRegister
                },
                enabled = !pending && when (mode) {
                    ProfileMode.SignIn -> email.isNotBlank() && password.isNotBlank()
                    ProfileMode.Register -> email.isNotBlank() && username.trim().length >= 3 && password.length >= 12 && displayName.trim().length >= 2
                }
            ) {
                if (pending) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text(when (mode) { ProfileMode.SignIn -> "Войти"; ProfileMode.Register -> "Отправить письмо" })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (mode != ProfileMode.SignIn) Button(onClick = { onModeChange(ProfileMode.SignIn) }, enabled = !pending) { Text("Вход") }
                if (mode != ProfileMode.Register) Button(onClick = { onModeChange(ProfileMode.Register) }, enabled = !pending) { Text("Регистрация") }
            }
        }
    }
}

@Composable
private fun AppField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    enabled: Boolean,
    password: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        enabled = enabled,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        modifier = Modifier.fillMaxWidth()
    )
}
