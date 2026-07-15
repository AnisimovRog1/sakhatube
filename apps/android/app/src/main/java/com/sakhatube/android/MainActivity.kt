package com.sakhatube.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.sakhatube.android.ui.SakhaTubeApp
import com.sakhatube.android.ui.SakhaTubeTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SakhaTubeTheme {
                SakhaTubeApp()
            }
        }
    }
}
