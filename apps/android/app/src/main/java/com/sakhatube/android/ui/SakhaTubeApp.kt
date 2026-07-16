package com.sakhatube.android.ui

import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AccountCircle
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Movie
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.BottomAppBar
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sakhatube.android.BuildConfig
import com.sakhatube.android.data.CatalogHome
import com.sakhatube.android.data.CatalogItem
import com.sakhatube.android.data.CatalogUiState
import com.sakhatube.android.data.AuthUiState

private enum class Destination(val title: String) {
    Home("Главная"),
    Catalog("Каталог"),
    Profile("Профиль")
}

@Composable
fun SakhaTubeApp(viewModel: CatalogViewModel = viewModel(), authViewModel: AuthViewModel = viewModel()) {
    val catalogState by viewModel.state.collectAsStateWithLifecycle()
    var destination by remember { mutableStateOf(Destination.Home) }

    Scaffold(
        topBar = { AppTopBar(destination.title) },
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
                        onClick = { destination = entry },
                        icon = { Icon(icon, contentDescription = null) },
                        label = { Text(entry.title) }
                    )
                }
            }
        }
    ) { padding ->
        when (destination) {
            Destination.Home -> HomeScreen(
                state = catalogState,
                onRetry = viewModel::refresh,
                modifier = Modifier.padding(padding)
            )
            Destination.Catalog -> CatalogScreen(
                state = catalogState,
                onRetry = viewModel::refresh,
                modifier = Modifier.padding(padding)
            )
            Destination.Profile -> ProfileScreen(authViewModel, modifier = Modifier.padding(padding))
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppTopBar(title: String) {
    TopAppBar(
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
    modifier: Modifier = Modifier
) {
    when (state) {
        CatalogUiState.Loading -> CatalogLoading(modifier)
        CatalogUiState.Empty -> CatalogEmpty(modifier)
        is CatalogUiState.Error -> CatalogError(state.message, onRetry, modifier)
        is CatalogUiState.Content -> HomeContent(state.home, modifier)
    }
}

@Composable
private fun HomeContent(home: CatalogHome, modifier: Modifier = Modifier) {
    LazyColumn(
        modifier = modifier.fillMaxSize(),
        contentPadding = PaddingValues(bottom = 32.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp)
    ) {
        home.hero?.let { hero ->
            item {
                HeroCard(hero, modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp))
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
                        PosterCard(item, modifier = Modifier.width(148.dp))
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
    modifier: Modifier = Modifier
) {
    when (state) {
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
                items(state.home.items, key = { it.id }) { item -> PosterCard(item) }
            }
        }
    }
}

@Composable
private fun HeroCard(item: CatalogItem, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier
            .fillMaxWidth()
            .semantics { contentDescription = "Премьера: ${item.title}" },
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
private fun PosterCard(item: CatalogItem, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier.semantics { contentDescription = "${item.title}, ${item.metadata}" },
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
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
private fun ProfileScreen(authViewModel: AuthViewModel, modifier: Modifier = Modifier) {
    val context = LocalContext.current
    val authState by authViewModel.state.collectAsStateWithLifecycle()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var displayName by remember { mutableStateOf("") }
    var verificationLink by remember { mutableStateOf("") }
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
            when (authState) {
                is AuthUiState.SignedIn -> SignedInProfileCard(
                    viewerName = authState.viewer.displayName,
                    email = authState.viewer.email,
                    onSignOut = authViewModel::signOut
                )
                else -> AuthCard(
                    mode = mode,
                    email = email,
                    password = password,
                    displayName = displayName,
                    verificationLink = verificationLink,
                    state = authState,
                    onModeChange = { mode = it; authViewModel.dismissError() },
                    onEmailChange = { email = it },
                    onPasswordChange = { password = it },
                    onDisplayNameChange = { displayName = it },
                    onVerificationLinkChange = { verificationLink = it },
                    onRegister = {
                        authViewModel.register(email, password.toCharArray(), displayName)
                        password = ""
                    },
                    onLogin = {
                        authViewModel.login(email, password.toCharArray())
                        password = ""
                    },
                    onVerify = {
                        authViewModel.verifyEmail(verificationLink)
                        verificationLink = ""
                    }
                )
            }
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
}

private enum class ProfileMode { SignIn, Register, Verify }

@Composable
private fun SignedInProfileCard(viewerName: String, email: String, onSignOut: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
            Text(viewerName, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(email, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                "Сессия действует только до закрытия приложения: токен не записывается в память устройства.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Button(onClick = onSignOut) { Text("Выйти") }
        }
    }
}

@Composable
private fun AuthCard(
    mode: ProfileMode,
    email: String,
    password: String,
    displayName: String,
    verificationLink: String,
    state: AuthUiState,
    onModeChange: (ProfileMode) -> Unit,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onDisplayNameChange: (String) -> Unit,
    onVerificationLinkChange: (String) -> Unit,
    onRegister: () -> Unit,
    onLogin: () -> Unit,
    onVerify: () -> Unit
) {
    val pending = state is AuthUiState.Registering || state is AuthUiState.SigningIn || state is AuthUiState.VerifyingEmail
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(modifier = Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(
                when (mode) {
                    ProfileMode.SignIn -> "Войти в SakhaTube"
                    ProfileMode.Register -> "Создать аккаунт"
                    ProfileMode.Verify -> "Подтвердить e-mail"
                },
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold
            )
            when (mode) {
                ProfileMode.SignIn, ProfileMode.Register -> {
                    if (mode == ProfileMode.Register) {
                        AppField("Имя", displayName, onDisplayNameChange, enabled = !pending)
                    }
                    AppField("E-mail", email, onEmailChange, enabled = !pending, keyboardType = KeyboardType.Email)
                    AppField("Пароль", password, onPasswordChange, enabled = !pending, password = true)
                    if (mode == ProfileMode.Register) {
                        Text("Минимум 12 символов. Пароль не сохраняется на устройстве.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
                ProfileMode.Verify -> {
                    AppField("Полная ссылка из письма", verificationLink, onVerificationLinkChange, enabled = !pending, keyboardType = KeyboardType.Uri)
                    Text("Открой письмо SakhaTube и вставь полную ссылку. Она одноразовая.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
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
                    ProfileMode.Verify -> onVerify
                },
                enabled = !pending && when (mode) {
                    ProfileMode.SignIn -> email.isNotBlank() && password.isNotBlank()
                    ProfileMode.Register -> email.isNotBlank() && password.length >= 12 && displayName.trim().length >= 2
                    ProfileMode.Verify -> verificationLink.isNotBlank()
                }
            ) {
                if (pending) CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                else Text(when (mode) { ProfileMode.SignIn -> "Войти"; ProfileMode.Register -> "Отправить письмо"; ProfileMode.Verify -> "Подтвердить" })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (mode != ProfileMode.SignIn) Button(onClick = { onModeChange(ProfileMode.SignIn) }, enabled = !pending) { Text("Вход") }
                if (mode != ProfileMode.Register) Button(onClick = { onModeChange(ProfileMode.Register) }, enabled = !pending) { Text("Регистрация") }
                if (mode != ProfileMode.Verify) Button(onClick = { onModeChange(ProfileMode.Verify) }, enabled = !pending) { Text("Подтвердить") }
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
