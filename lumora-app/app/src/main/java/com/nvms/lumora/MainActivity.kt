package com.nvms.lumora

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceError
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import kotlinx.coroutines.delay
import androidx.tv.material3.Button
import androidx.tv.material3.Card
import androidx.tv.material3.ExperimentalTvMaterial3Api
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import com.nvms.lumora.ui.theme.LumoraTheme
import androidx.core.content.edit
import androidx.core.net.toUri

class MainActivity : ComponentActivity() {
    private val prefsName = "lumora_prefs"
    private val urlKey = "server_url"
    private val draftKey = "server_url_draft"

    @OptIn(ExperimentalTvMaterial3Api::class)
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val prefs = getSharedPreferences(prefsName, MODE_PRIVATE)

        setContent {
            LumoraTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    var serverUrl by remember { mutableStateOf(prefs.getString(urlKey, "") ?: "") }
                    var inputUrl by remember { mutableStateOf(prefs.getString(draftKey, serverUrl) ?: serverUrl) }
                    var showSetup by remember { mutableStateOf(serverUrl.isBlank()) }
                    var setupError by remember { mutableStateOf("") }

                    LaunchedEffect(inputUrl, showSetup) {
                        if (!showSetup) return@LaunchedEffect
                        delay(5000)
                        val normalized = normalizeUrl(inputUrl)
                        prefs.edit { putString(draftKey, normalized) }
                        if (normalized.isBlank()) return@LaunchedEffect
                        serverUrl = normalized
                        prefs.edit { putString(urlKey, normalized).putString(draftKey, normalized)}
                        showSetup = false
                    }

                    if (showSetup) {
                        UrlSetup(
                            value = inputUrl,
                            error = setupError,
                            onChange = { inputUrl = it },
                            onSave = {
                                val normalized = normalizeUrl(inputUrl)
                                if (normalized.isBlank()) {
                                    setupError = "Enter a valid URL."
                                } else {
                                    serverUrl = normalized
                                    prefs.edit {
                                        putString(urlKey, normalized).putString(
                                            draftKey,
                                            normalized
                                        )
                                    }
                                    showSetup = false
                                }
                            }
                        )
                    } else {
                        WebHost(
                            serverUrl = serverUrl,
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

}

private fun normalizeUrl(value: String): String {
    val raw = value.trim()
    if (raw.isBlank()) return ""
    val withScheme = if (raw.startsWith("http://") || raw.startsWith("https://")) raw else "http://$raw"
    return try {
        val parsed = withScheme.toUri()
        val host = parsed.host ?: return ""
        val scheme = parsed.scheme ?: "http"
        val builder = Uri.Builder().scheme(scheme).encodedAuthority(
            if (parsed.port > 0) "$host:${parsed.port}" else host
        )
        val path = parsed.path
        builder.path(if (path.isNullOrBlank()) "/" else path)
        if (!parsed.query.isNullOrBlank()) builder.encodedQuery(parsed.encodedQuery)
        if (!parsed.fragment.isNullOrBlank()) builder.encodedFragment(parsed.encodedFragment)
        builder.build().toString()
    } catch (_: Exception) {
        ""
    }
}

@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun UrlSetup(
    value: String,
    error: String,
    onChange: (String) -> Unit,
    onSave: () -> Unit
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
                    Button(onClick = onSave, enabled = value.isNotBlank()) {
                        Text("Save and Open")
                    }
                }
            }
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@OptIn(ExperimentalTvMaterial3Api::class)
@Composable
private fun WebHost(serverUrl: String, onLoadError: () -> Unit) {
    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    BackHandler {
        val webView = webViewRef
        if (webView != null && webView.canGoBack()) {
            webView.goBack()
        } else {
            (webView?.context as? ComponentActivity)
                ?.moveTaskToBack(true)
        }
    }

    AndroidView(
        modifier = Modifier.fillMaxSize(),
        factory = { context ->
            WebView(context).apply {
                webViewRef = this
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = true
                settings.allowContentAccess = true
                settings.mediaPlaybackRequiresUserGesture = false
                settings.setSupportZoom(false)
                settings.loadsImagesAutomatically = true
                settings.useWideViewPort = true
                settings.loadWithOverviewMode = true
                settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                //settings.userAgentString = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36"
                webChromeClient = object : WebChromeClient() {
                    override fun onConsoleMessage(consoleMessage: android.webkit.ConsoleMessage ): Boolean {
                        android.util.Log.d("WEBVIEW","${consoleMessage.message()} " + "line ${consoleMessage.lineNumber()}")
                        return true
                    }
                }
                webViewClient = object : WebViewClient() {
                    override fun shouldOverrideUrlLoading(
                        view: WebView?, request: WebResourceRequest?
                    ): Boolean {
                        return false
                    }

                    override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                        if (request?.isForMainFrame == true) {
                            onLoadError()
                        }
                    }
                }
                loadUrl("http://192.168.20.106:8787")
            }
        }
    )
}
