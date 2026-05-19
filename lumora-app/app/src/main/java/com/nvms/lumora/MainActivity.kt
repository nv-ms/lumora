package com.nvms.lumora

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.tv.material3.Card
import androidx.tv.material3.Button
import androidx.tv.material3.ButtonDefaults
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.nvms.lumora.ui.theme.LumoraTheme

class MainActivity : ComponentActivity() {
    private val prefsName = "lumora_prefs"
    private val urlKey = "server_url"

    @OptIn(ExperimentalTvMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = getSharedPreferences(prefsName, MODE_PRIVATE)

        setContent {
            LumoraTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var serverUrl by remember { mutableStateOf(prefs.getString(urlKey, "") ?: "") }
                    var inputUrl by remember { mutableStateOf(serverUrl) }
                    var showSetup by remember { mutableStateOf(serverUrl.isBlank()) }
                    var loading by remember { mutableStateOf(false) }
                    var setupError by remember { mutableStateOf("") }

                    if (showSetup) {
                        UrlSetup(
                            value = inputUrl,
                            loading = loading,
                            error = setupError,
                            onChange = { inputUrl = it },
                            onSave = {
                                val normalized = normalizeUrl(inputUrl)
                                if (normalized.isBlank()) {
                                    setupError = "Enter a valid URL."
                                } else {
                                    loading = true
                                    setupError = ""
                                    val ok = healthOk(normalized)
                                    loading = false
                                    if (ok) {
                                        serverUrl = normalized
                                        prefs.edit().putString(urlKey, normalized).apply()
                                        showSetup = false
                                    } else {
                                        setupError = "Cannot reach server. Check URL and network."
                                    }
                                }
                            },
                            onUseSample = {
                                val sample = "http://192.168.1.10:8787"
                                inputUrl = sample
                            }
                        )
                    } else {
                        WebHost(
                            serverUrl = serverUrl,
                            onChangeServer = {
                                inputUrl = serverUrl
                                showSetup = true
                            },
                            onLoadError = {
                                setupError = "Page failed to load. Edit server URL."
                                inputUrl = serverUrl
                                showSetup = true
                            }
                        )
                    }
                }
            }
        }
    }

    private fun healthOk(baseUrl: String): Boolean {
        return try {
            val url = java.net.URL("$baseUrl/api/health")
            val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 5000
                readTimeout = 5000
            }
            conn.responseCode in 200..299
        } catch (_: Exception) {
            false
        }
    }
}

private fun normalizeUrl(value: String): String {
    val trimmed = value.trim().removeSuffix("/")
    if (trimmed.isBlank()) return ""
    return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) trimmed else "http://$trimmed"
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun UrlSetup(
    value: String,
    loading: Boolean,
    error: String,
    onChange: (String) -> Unit,
    onSave: () -> Unit,
    onUseSample: () -> Unit
) {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Card(onClick = {}, modifier = Modifier.width(760.dp)) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(28.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    Image(painter = painterResource(id = R.drawable.icon), contentDescription = "Lumora", modifier = Modifier.width(56.dp))
                    Column {
                        Text(text = "Connect Lumora")
                        Text(text = "Enter your server URL")
                    }
                }
                Surface {
                    BasicTextField(
                        value = value,
                        onValueChange = onChange,
                        singleLine = true,
                        cursorBrush = SolidColor(Color.White),
                        textStyle = androidx.compose.ui.text.TextStyle(color = Color.White),
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp)
                    )
                }
                Text(text = "Example: http://192.168.1.10:8787")
                if (error.isNotBlank()) Text(text = error, color = Color(0xFFFF6B6B))
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(onClick = onUseSample, enabled = !loading, colors = ButtonDefaults.colors()) { Text("Use Example") }
                    Button(onClick = onSave, enabled = !loading && value.isNotBlank(), colors = ButtonDefaults.colors()) {
                        Text(if (loading) "Checking..." else "Save and Open")
                    }
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun WebHost(serverUrl: String, onChangeServer: () -> Unit, onLoadError: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.mediaPlaybackRequiresUserGesture = false
                    webViewClient = object : WebViewClient() {
                        override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                            if (request?.isForMainFrame == true) onLoadError()
                        }
                    }
                    webChromeClient = WebChromeClient()
                    loadUrl(serverUrl)
                }
            },
            update = { webView ->
                if (webView.url != serverUrl) webView.loadUrl(serverUrl)
            }
        )

        Row(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .padding(16.dp)
        ) {
            Button(
                onClick = onChangeServer,
                contentPadding = PaddingValues(horizontal = 18.dp, vertical = 10.dp)
            ) {
                Text("Server URL")
            }
        }
    }
}
