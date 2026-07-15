package com.sakhatube.android.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val SakhaTubeColors = darkColorScheme(
    primary = Color(0xFF72A9FF),
    onPrimary = Color(0xFF04172E),
    secondary = Color(0xFFC6D7FF),
    background = Color(0xFF0E1014),
    onBackground = Color(0xFFF3F5FA),
    surface = Color(0xFF181B22),
    onSurface = Color(0xFFF3F5FA),
    surfaceVariant = Color(0xFF252A35),
    onSurfaceVariant = Color(0xFFBEC5D4),
    error = Color(0xFFFFB4AB)
)

@Composable
fun SakhaTubeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = SakhaTubeColors,
        content = content
    )
}
