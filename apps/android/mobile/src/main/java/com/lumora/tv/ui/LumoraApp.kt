package com.lumora.tv.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.app.Activity
import android.view.KeyEvent
import android.view.LayoutInflater
import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.media3.ui.DefaultTimeBar
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.session.MediaSession
import androidx.tv.material3.MaterialTheme
import androidx.tv.material3.Text
import com.lumora.tv.data.*
import com.lumora.tv.R
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import org.json.JSONArray
import java.net.URL
import java.net.HttpURLConnection
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import java.util.concurrent.TimeUnit
import kotlin.math.roundToLong

private val Bg = Color.Black
private val Panel = Color.White.copy(alpha = .03f)
private val Panel2 = Color.White.copy(alpha = .08f)
private val Hairline = Color.White.copy(alpha = .10f)
private val Foreground = Color.White
private val Muted = Color.White.copy(alpha = .58f)
private val Danger = Color(0xFFFF7580)
private val Success = Color(0xFF55D58A)

object RemoteKeys { var handler: ((Int) -> Boolean)? = null }

private sealed interface Screen {
    data object Home : Screen; data object Movies : Screen; data object Series : Screen; data object History : Screen
    data object Catalog : Screen; data object Settings : Screen; data class Search(val query: String) : Screen
    data class SeriesDetail(val id: String) : Screen; data class CatalogDetail(val type: String, val id: String) : Screen
    data class Player(val media: MediaEntry) : Screen
}

@Composable
fun LumoraApp() {
    val context = LocalContext.current
    val api = remember { LumoraApi(context) }
    var screen by remember { mutableStateOf<Screen>(if (api.serverUrl.isEmpty()) Screen.Settings else Screen.Home) }
    var catalog by remember { mutableStateOf<Catalog?>(null) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var connection by remember { mutableStateOf("connecting") }
    var refreshKey by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()
    DisposableEffect(api.serverUrl, refreshKey) {
        connection = "connecting"
        val client = OkHttpClient.Builder().pingInterval(10, TimeUnit.SECONDS).build()
        val socket = client.newWebSocket(Request.Builder().url(api.webSocketUrl()).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) { scope.launch { connection = "connected" } }
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) { scope.launch { connection = "disconnected" } }
            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) { scope.launch { connection = "disconnected" } }
        })
        onDispose { socket.close(1000, null); client.dispatcher.executorService.shutdown() }
    }
    LaunchedEffect(api.serverUrl, refreshKey) {
        if (api.serverUrl.isEmpty()) return@LaunchedEffect
        loading = true; error = ""
        runCatching { api.catalog() }.onSuccess { catalog = it }.onFailure { error = it.message.orEmpty() }
        loading = false
    }
    MaterialTheme {
        Box(Modifier.fillMaxSize().background(Bg)) {
            when (val current = screen) {
                is Screen.Player -> PlayerScreen(api, current.media, back = { screen = if (current.media.seriesId.isNotEmpty()) Screen.SeriesDetail(current.media.seriesId) else Screen.Home }, settings = { screen = Screen.Settings })
                else -> AppShell(current, catalog, api, loading, error, connection, navigate = { screen = it }, refresh = { refreshKey++ })
            }
        }
    }
}

@Composable
private fun AppShell(screen: Screen, catalog: Catalog?, api: LumoraApi, loading: Boolean, error: String, connection: String, navigate: (Screen) -> Unit, refresh: () -> Unit) {
    var query by remember { mutableStateOf("") }
    val connectionLabel = when (connection) { "connected" -> "●  CONNECTED"; "connecting" -> "●  CONNECTING"; else -> "●  DISCONNECTED" }
    val connectionColor = when (connection) { "connected" -> Success; "connecting" -> Muted; else -> Danger }
    Row(Modifier.fillMaxSize()) {
        Sidebar(screen, navigate)
        Column(Modifier.weight(1f).fillMaxHeight()) {
            Row(Modifier.fillMaxWidth().height(58.dp).background(Bg).padding(horizontal = 24.dp), verticalAlignment = Alignment.CenterVertically) {
                VectorIcon(Icons.Default.Search, Muted, Modifier.size(18.dp)); Spacer(Modifier.width(10.dp)); Input(query, { query = it }, "Search library", Modifier.width(300.dp), onSubmit = { if (query.isNotBlank()) navigate(Screen.Search(query.trim())) })
                Spacer(Modifier.weight(1f)); Text(connectionLabel, color = connectionColor, fontSize = 11.sp)
            }
            Box(Modifier.fillMaxSize()) {
                when {
                    loading -> LoadingState("Loading library…")
                    error.isNotEmpty() && screen !is Screen.Settings -> ErrorState(error, retry = refresh, settings = { navigate(Screen.Settings) })
                    else -> when (screen) {
                        Screen.Home -> HomePage(catalog ?: emptyCatalog(), navigate)
                        Screen.Movies -> GridPage("Movies", "${catalog?.movies?.size ?: 0} titles in library", catalog?.movies.orEmpty()) { navigate(Screen.Player(it)) }
                        Screen.Series -> SeriesPage(catalog?.series.orEmpty(), navigate)
                        Screen.History -> HistoryPage(catalog?.history.orEmpty()) { navigate(Screen.Player(it)) }
                        Screen.Catalog -> CatalogPage(api, catalog ?: emptyCatalog(), navigate, refresh)
                        Screen.Settings -> SettingsPage(api, refresh)
                        is Screen.Search -> SearchPage(screen.query, catalog ?: emptyCatalog()) { navigate(Screen.Player(it)) }
                        is Screen.SeriesDetail -> SeriesDetailPage(screen.id, catalog ?: emptyCatalog(), navigate)
                        is Screen.CatalogDetail -> CatalogDetailPage(screen, catalog ?: emptyCatalog(), navigate)
                        else -> Unit
                    }
                }
            }
        }
    }
}

@Composable
private fun Sidebar(screen: Screen, navigate: (Screen) -> Unit) {
    val nav = listOf(Icons.Default.Home to ("Home" to Screen.Home), Icons.Default.Movie to ("Movies" to Screen.Movies), Icons.Default.Tv to ("Series" to Screen.Series), Icons.Default.History to ("History" to Screen.History), Icons.Default.TableView to ("Catalog" to Screen.Catalog))
    Column(Modifier.width(240.dp).fillMaxHeight().background(Bg).padding(14.dp)) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) { Image(painterResource(R.drawable.lumora_logo), "Lumora", Modifier.size(32.dp).clip(RoundedCornerShape(6.dp)), contentScale = ContentScale.Crop); Spacer(Modifier.width(12.dp)); Column { Text("LUMORA", color = Foreground, fontWeight = FontWeight.Bold, fontSize = 14.sp); Text("LOCAL LIBRARY", color = Muted, fontSize = 10.sp) } }
        Spacer(Modifier.height(12.dp))
        nav.forEach { (icon, entry) -> NavItem(icon, entry.first, activeFor(screen, entry.second)) { navigate(entry.second) } }
        Spacer(Modifier.weight(1f)); Box(Modifier.height(1.dp).fillMaxWidth().background(Hairline)); NavItem(Icons.Default.Settings, "Settings", screen is Screen.Settings) { navigate(Screen.Settings) }
    }
}
private fun activeFor(current: Screen, target: Screen) = current::class == target::class || (target is Screen.Series && current is Screen.SeriesDetail) || (target is Screen.Catalog && current is Screen.CatalogDetail)

private data class HomeHighlight(val id: String, val kind: String, val title: String, val thumbnail: String, val meta: String, val progress: Float? = null)
private fun MediaEntry.displayTitle(): String {
    if (kind != "episode") return title
    val match = Regex("(?i)S(\\d{1,2})E(\\d{1,3})").find(title)
    val displaySeason = match?.groupValues?.get(1)?.toIntOrNull() ?: season
    val displayEpisode = match?.groupValues?.get(2)?.toIntOrNull() ?: number
    return "${seriesTitle.ifEmpty { title.substringBefore(" S", title) }} S$displaySeason Episode $displayEpisode"
}

@Composable private fun NavItem(icon: ImageVector, label: String, active: Boolean, click: () -> Unit) { FocusBox(onClick = click, active = active, modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) { Row(Modifier.padding(horizontal = 8.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) { Box(Modifier.width(2.dp).height(18.dp).background(if (active) Color.White.copy(alpha = .78f) else Color.Transparent, RoundedCornerShape(2.dp))); Spacer(Modifier.width(10.dp)); VectorIcon(icon, if (active) Foreground else Muted, Modifier.size(18.dp)); Spacer(Modifier.width(12.dp)); Text(label, color = if (active) Foreground else Muted, fontSize = 14.sp, fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal) } } }

@Composable
private fun HomePage(catalog: Catalog, navigate: (Screen) -> Unit) {
    val initial = catalog.continueWatching.firstOrNull() ?: catalog.recentlyAdded.firstOrNull()
    var highlight by remember(catalog.generatedAt) { mutableStateOf(initial?.let { HomeHighlight(it.id, "media", it.displayTitle(), it.thumbnailUrl, "", it.progress) } ?: catalog.series.firstOrNull()?.let { HomeHighlight(it.id, "series", it.title, it.thumbnailUrl, "${it.seasons.size} season(s)") }) }
    val openHighlight: (HomeHighlight) -> Unit = { item -> if (item.kind == "series") navigate(Screen.SeriesDetail(item.id)) else catalog.allMedia.find { it.id == item.id }?.let { navigate(Screen.Player(it)) }; Unit }
    val recentlyAddedMovies = catalog.recentlyAdded.filter { it.kind != "episode" }.take(12)
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 64.dp)) {
        highlight?.let { featured -> item(key = "featured") {
            Box(Modifier.fillMaxWidth().height(330.dp)) {
                HeroArtwork(featured.title, featured.thumbnail, Modifier.fillMaxSize())
                Column(Modifier.align(Alignment.BottomStart).width(520.dp).padding(start = 34.dp, bottom = 36.dp)) {
                    Text(if (featured.progress != null) "CONTINUE WATCHING" else if (featured.kind == "series") "SERIES" else "FEATURED", color = Muted, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                    Spacer(Modifier.height(8.dp)); Text(featured.title, color = Foreground, fontSize = 36.sp, lineHeight = 40.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    if (featured.meta.isNotEmpty()) { Spacer(Modifier.height(8.dp)); Text(featured.meta, color = Muted, fontSize = 12.sp) }
                    if (featured.progress != null) { Spacer(Modifier.height(14.dp)); Progress(featured.progress, Modifier.width(300.dp)) }
                    Spacer(Modifier.height(18.dp)); ActionButton(if (featured.progress != null) "Resume" else if (featured.kind == "series") "View series" else "Play", Modifier.focusProperties { up = FocusRequester.Cancel }, icon = if (featured.kind == "series") Icons.Default.ArrowForward else Icons.Default.PlayArrow) { openHighlight(featured) }
                }
            }
        } }
        if (highlight == null) item { Column(Modifier.fillParentMaxSize().padding(34.dp), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) { Text("Your library is empty", color = Foreground, fontSize = 24.sp); Spacer(Modifier.height(8.dp)); Text("Add movies or series from Catalog to start watching.", color = Muted, fontSize = 13.sp) } }
        item { Shelf("Continue watching", catalog.continueWatching, navigate) { highlight = HomeHighlight(it.id, "media", it.displayTitle(), it.thumbnailUrl, "", it.progress) } }
        item { Shelf("Recently added", recentlyAddedMovies, navigate) { highlight = HomeHighlight(it.id, "media", it.displayTitle(), it.thumbnailUrl, "", it.progress) } }
        item { SeriesShelf("Your shows", catalog.series.take(12), navigate) { highlight = HomeHighlight(it.id, "series", it.title, it.thumbnailUrl, "${it.seasons.size} season(s)") } }
    }
}

@Composable private fun Shelf(title: String, media: List<MediaEntry>, navigate: (Screen) -> Unit, focused: (MediaEntry) -> Unit = {}) { if (media.isEmpty()) return; Column(Modifier.padding(start = 34.dp, top = 38.dp)) { SectionHeader(title, media.size); LazyRow(horizontalArrangement = Arrangement.spacedBy(20.dp), contentPadding = PaddingValues(end = 34.dp, bottom = 8.dp)) { items(media, key = { it.id }) { PosterCard(it.displayTitle(), it.thumbnailUrl, "", { focused(it) }) { navigate(Screen.Player(it)) } } } } }
@Composable private fun SeriesShelf(title: String, shows: List<SeriesEntry>, navigate: (Screen) -> Unit, focused: (SeriesEntry) -> Unit = {}) { if (shows.isEmpty()) return; Column(Modifier.padding(start = 34.dp, top = 38.dp)) { SectionHeader(title, shows.size); LazyRow(horizontalArrangement = Arrangement.spacedBy(20.dp), contentPadding = PaddingValues(end = 34.dp, bottom = 8.dp)) { items(shows, key = { it.id }) { PosterCard(it.title, it.thumbnailUrl, "${it.seasons.size} season(s)", { focused(it) }, blockDown = true) { navigate(Screen.SeriesDetail(it.id)) } } } } }
@Composable private fun SectionHeader(title: String, count: Int) { Row(Modifier.fillMaxWidth().padding(end = 34.dp, bottom = 18.dp)) { Text(title, color = Foreground, fontSize = 18.sp); Spacer(Modifier.weight(1f)); Text("$count ITEMS", color = Muted, fontSize = 10.sp) } }

@Composable
private fun GridPage(title: String, subtitle: String, entries: List<MediaEntry>, click: (MediaEntry) -> Unit) { Column(Modifier.fillMaxSize().padding(horizontal = 34.dp, vertical = 34.dp)) { PageTitle(title, subtitle); LazyVerticalGrid(GridCells.Adaptive(170.dp), Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp), contentPadding = PaddingValues(top = 28.dp, bottom = 40.dp)) { items(entries, key = { it.id }) { PosterCard(it.title, it.thumbnailUrl, it.extension) { click(it) } } } } }

@Composable
private fun SeriesPage(series: List<SeriesEntry>, navigate: (Screen) -> Unit) { Column(Modifier.fillMaxSize().padding(horizontal = 34.dp, vertical = 34.dp)) { PageTitle("Series", "${series.size} cataloged"); LazyVerticalGrid(GridCells.Adaptive(170.dp), Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp), contentPadding = PaddingValues(top = 28.dp, bottom = 40.dp)) { items(series, key = { it.id }) { PosterCard(it.title, it.thumbnailUrl, "${it.seasons.size} season(s)") { navigate(Screen.SeriesDetail(it.id)) } } } } }

@Composable
private fun SeriesDetailPage(id: String, catalog: Catalog, navigate: (Screen) -> Unit) {
    val show = catalog.series.find { it.id == id } ?: return ErrorState("Series not found", retry = { navigate(Screen.Series) }, settings = { navigate(Screen.Settings) })
    var season by remember(show.id) { mutableIntStateOf(show.seasons.firstOrNull()?.number ?: 1) }
    val selected = show.seasons.find { it.number == season }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(34.dp)) {
        item { Row { Column(Modifier.width(240.dp)) { Poster(show.title, show.thumbnailUrl, Modifier.fillMaxWidth(), 2f / 3f); Spacer(Modifier.height(14.dp)); Text(show.path, color = Muted, fontSize = 11.sp) }; Spacer(Modifier.width(40.dp)); Column(Modifier.weight(1f)) { Text(show.title, color = Foreground, fontSize = 38.sp, fontWeight = FontWeight.SemiBold); Spacer(Modifier.height(42.dp)); LazyRow(horizontalArrangement = Arrangement.spacedBy(4.dp)) { items(show.seasons) { entry -> ActionButton("Season ${entry.number}", selected = entry.number == season) { season = entry.number } } }; Spacer(Modifier.height(12.dp)); selected?.episodes?.forEach { EpisodeRow(it) { navigate(Screen.Player(it.copy(seriesId = show.id, seriesTitle = show.title, season = selected.number))) } } } } }
    }
}
@Composable private fun EpisodeRow(episode: MediaEntry, play: () -> Unit) { FocusBox(play, modifier = Modifier.fillMaxWidth()) { Row(Modifier.fillMaxWidth().padding(vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) { Text(episode.number.toString().padStart(2, '0'), color = Muted, fontSize = 12.sp, modifier = Modifier.width(38.dp)); Column(Modifier.weight(1f)) { Text(episode.title, color = Foreground, fontSize = 14.sp, maxLines = 1); Text(episode.extension, color = Muted, fontSize = 11.sp) }; if (episode.progress != null) Progress(episode.progress, Modifier.width(80.dp)); Spacer(Modifier.width(16.dp)); Text("Play", color = Foreground, fontSize = 12.sp) } }; Box(Modifier.fillMaxWidth().height(1.dp).background(Hairline)) }

@Composable
private fun HistoryPage(history: List<MediaEntry>, play: (MediaEntry) -> Unit) { LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(34.dp)) { item { PageTitle("History", "Recently watched"); Spacer(Modifier.height(28.dp)) }; if (history.isEmpty()) item { Text("No watch history yet.", color = Muted) }; items(history, key = { it.id }) { item -> FocusBox({ play(item) }, Modifier.fillMaxWidth()) { Row(Modifier.padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) { Poster(item.title, item.thumbnailUrl, Modifier.width(110.dp), 16f / 9f); Spacer(Modifier.width(20.dp)); Column { Text(item.title, color = Foreground); Text(formatDate(item.lastWatchedAt), color = Muted, fontSize = 11.sp) } } }; Box(Modifier.height(1.dp).fillMaxWidth().background(Hairline)) } } }

@Composable
private fun SearchPage(query: String, catalog: Catalog, play: (MediaEntry) -> Unit) { val results = catalog.allMedia.filter { "${it.title} ${it.path} ${it.seriesTitle}".contains(query, true) }; Column(Modifier.fillMaxSize().padding(34.dp)) { PageTitle("Search", "${results.size} result(s) for \"$query\""); LazyVerticalGrid(GridCells.Adaptive(170.dp), Modifier.fillMaxSize(), horizontalArrangement = Arrangement.spacedBy(20.dp), verticalArrangement = Arrangement.spacedBy(24.dp), contentPadding = PaddingValues(top = 28.dp)) { items(results, key = { it.id }) { PosterCard(it.title, it.thumbnailUrl, it.extension) { play(it) } } } } }

@Composable
private fun CatalogDetailPage(route: Screen.CatalogDetail, catalog: Catalog, navigate: (Screen) -> Unit) {
    val movie = catalog.movies.find { it.id == route.id }; val show = catalog.series.find { it.id == route.id }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(34.dp)) {
        item { ActionButton("Back", icon = Icons.Default.ArrowBack) { navigate(Screen.Catalog) }; Spacer(Modifier.height(24.dp)) }
        if (route.type == "movie" && movie != null) item { Row { Column(Modifier.width(260.dp)) { Poster(movie.title, movie.thumbnailUrl, Modifier.fillMaxWidth(), 2f / 3f); Spacer(Modifier.height(14.dp)); ActionButton("Play", Modifier.fillMaxWidth(), icon = Icons.Default.PlayArrow) { navigate(Screen.Player(movie)) } }; Spacer(Modifier.width(28.dp)); Details(movie.title, movie.available, listOf("Path" to movie.path, "Trailer" to movie.trailerPath.ifEmpty { "No trailer" }, "Subtitles" to movie.subtitles.size.toString(), "Structure" to "Single title")) } }
        if (route.type == "series" && show != null) { item { Row { Poster(show.title, show.thumbnailUrl, Modifier.width(260.dp), 2f / 3f); Spacer(Modifier.width(28.dp)); Details(show.title, show.available, listOf("Root folder" to show.sourceFolder, "Trailer" to show.trailerPath.ifEmpty { "No trailer" }, "Subtitles" to show.subtitles.size.toString(), "Structure" to "${show.seasons.size} seasons | ${show.seasons.sumOf { it.episodes.size }} episodes")) } }; show.seasons.forEach { season -> item { Text("Season ${season.number}", color = Foreground, fontSize = 18.sp, modifier = Modifier.padding(top = 28.dp, bottom = 8.dp)); season.episodes.forEach { ep -> EpisodeRow(ep) { navigate(Screen.Player(ep.copy(seriesId = show.id, seriesTitle = show.title, season = season.number))) } } } } }
    }
}
@Composable private fun Details(title: String, available: Boolean, rows: List<Pair<String, String>>) { Column(Modifier.fillMaxWidth()) { PanelBox { Text(title, color = Foreground, fontSize = 28.sp, fontWeight = FontWeight.SemiBold); Spacer(Modifier.height(10.dp)); Text(if (available) "✓ Available" else "⊘ Unavailable", color = Muted, fontSize = 12.sp) }; Spacer(Modifier.height(14.dp)); rows.chunked(2).forEach { pair -> Row { pair.forEach { entry -> PanelBox(Modifier.weight(1f).padding(4.dp)) { Text(entry.first, color = Muted, fontSize = 11.sp); Spacer(Modifier.height(8.dp)); Text(entry.second, color = Foreground, fontSize = 13.sp) } } } } } }

@Composable
private fun CatalogPage(api: LumoraApi, catalog: Catalog, navigate: (Screen) -> Unit, refresh: () -> Unit) {
    val scope = rememberCoroutineScope(); var search by remember { mutableStateOf("") }; var type by remember { mutableStateOf("all") }; var availability by remember { mutableStateOf("all") }; var form by remember { mutableStateOf<String?>(null) }; var edit by remember { mutableStateOf<Pair<String, String>?>(null) }; var message by remember { mutableStateOf("") }
    val rows = (catalog.movies.map { Triple("movie", it.id, it.title) } + catalog.series.map { Triple("series", it.id, it.title) }).filter { row ->
        val available = catalog.movies.find { it.id == row.second }?.available ?: catalog.series.find { it.id == row.second }?.available ?: false
        (type == "all" || row.first == type) && row.third.contains(search, true) && (availability == "all" || (availability == "available") == available)
    }
    Column(Modifier.fillMaxSize().padding(34.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) { Column { PageTitle("Catalog", "Manage movies and series") }; Spacer(Modifier.weight(1f)); ActionButton("Add Movie", icon = Icons.Default.Add) { form = "movie" }; Spacer(Modifier.width(8.dp)); ActionButton("Add Series", icon = Icons.Default.Add) { form = "series" } }
        Spacer(Modifier.height(24.dp)); Row { Input(search, { search = it }, "Search catalog", Modifier.weight(1f)); Spacer(Modifier.width(10.dp)); ActionButton("All Types", selected = type == "all") { type = "all" }; ActionButton("Movies", selected = type == "movie") { type = "movie" }; ActionButton("Series", selected = type == "series") { type = "series" }; Spacer(Modifier.width(10.dp)); ActionButton("All Availability", selected = availability == "all") { availability = "all" }; ActionButton("Available", selected = availability == "available") { availability = "available" }; ActionButton("Unavailable", selected = availability == "unavailable") { availability = "unavailable" } }
        Spacer(Modifier.height(18.dp)); Text("${rows.size} catalog entries", color = Muted, fontSize = 11.sp); Spacer(Modifier.height(8.dp))
        LazyColumn(Modifier.weight(1f)) { items(rows, key = { "${it.first}:${it.second}" }) { row -> val media = catalog.movies.find { it.id == row.second }; val show = catalog.series.find { it.id == row.second }; FocusBox({ navigate(Screen.CatalogDetail(row.first, row.second)) }, Modifier.fillMaxWidth()) { Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) { Text(row.first.uppercase(), color = Muted, fontSize = 10.sp, modifier = Modifier.width(70.dp)); Column(Modifier.weight(1f)) { Text(row.third, color = Foreground); Text(media?.path ?: show?.path.orEmpty(), color = Muted, fontSize = 10.sp, maxLines = 1) }; ActionButton(if ((media?.available ?: show?.available) != false) "Disable" else "Enable", icon = Icons.Default.Visibility) { scope.launch { api.update(row.first, row.second, JSONObject().put("available", (media?.available ?: show?.available) == false)); refresh() } }; Spacer(Modifier.width(6.dp)); ActionButton("Edit", icon = Icons.Default.Edit) { edit = row.first to row.second }; Spacer(Modifier.width(6.dp)); ActionButton("Delete", danger = true, icon = Icons.Default.Delete) { scope.launch { api.delete(row.first, row.second); refresh() } } } }; Box(Modifier.height(1.dp).fillMaxWidth().background(Hairline)) } }
        Text(message, color = Success, fontSize = 11.sp)
    }
    if (form != null) CatalogForm(form!!, api, onClose = { form = null }, onSaved = { form = null; message = "$it added."; refresh() })
    if (edit != null) { val pair = edit!!; val movie = catalog.movies.find { it.id == pair.second }; val show = catalog.series.find { it.id == pair.second }; EditForm(pair.first, pair.second, movie?.title ?: show?.title.orEmpty(), movie?.path ?: show?.sourceFolder.orEmpty(), movie?.available ?: show?.available ?: true, api, { edit = null }, { edit = null; refresh() }) }
}

@Composable
private fun CatalogForm(type: String, api: LumoraApi, onClose: () -> Unit, onSaved: (String) -> Unit) {
    val scope = rememberCoroutineScope(); var title by remember { mutableStateOf("") }; var path by remember { mutableStateOf("") }; var thumb by remember { mutableStateOf("") }; var trailer by remember { mutableStateOf("") }; var picker by remember { mutableStateOf<Pair<String, String>?>(null) }; var busy by remember { mutableStateOf(false) }; var error by remember { mutableStateOf("") }
    Modal(if (type == "movie") "Add Movie" else "Add Series", onClose) {
        Text("Details", color = Foreground, fontSize = 16.sp); Spacer(Modifier.height(14.dp)); Input(title, { title = it }, if (type == "movie") "Movie title" else "Series title", Modifier.fillMaxWidth()); Spacer(Modifier.height(10.dp)); Input(path, { path = it }, if (type == "movie") "Video file path" else "Season folder path", Modifier.fillMaxWidth()); Spacer(Modifier.height(8.dp)); ActionButton(if (type == "movie") "Choose video file" else "Choose season folder") { picker = "path" to if (type == "movie") "video" else "all" }; Spacer(Modifier.height(10.dp)); Input(thumb, { thumb = it }, "Thumbnail path", Modifier.fillMaxWidth()); Spacer(Modifier.height(10.dp)); Input(trailer, { trailer = it }, "Trailer path", Modifier.fillMaxWidth()); Spacer(Modifier.height(16.dp)); Text(error, color = Danger); ActionButton(if (busy) "Saving…" else "Save") { if (!busy) scope.launch { busy = true; runCatching { if (type == "movie") api.createMovie(title.ifBlank { path.substringAfterLast('/').substringAfterLast('\\').substringBeforeLast('.') }, path, emptyList(), thumb, trailer) else { val files = scanVideoFiles(api, path); api.createSeries(title, files.mapIndexed { index, file -> JSONObject().put("title", file.name.substringBeforeLast('.')).put("filePath", file.path).put("seasonNumber", 1).put("episodeNumber", index + 1).put("subtitles", JSONArray()) }, emptyList(), thumb, trailer) } }.onSuccess { onSaved(if (type == "movie") "Movie" else "Series") }.onFailure { error = it.message.orEmpty() }; busy = false } }
    }
    if (picker != null) FilePicker(api, picker!!.second, allowFolder = type == "series", onClose = { picker = null }) { path = it; picker = null }
}

@Composable
private fun EditForm(type: String, id: String, initialTitle: String, initialPath: String, initialAvailable: Boolean, api: LumoraApi, close: () -> Unit, saved: () -> Unit) { val scope = rememberCoroutineScope(); var title by remember { mutableStateOf(initialTitle) }; var path by remember { mutableStateOf(initialPath) }; var available by remember { mutableStateOf(initialAvailable) }; Modal("Edit $initialTitle", close) { Input(title, { title = it }, "Title", Modifier.fillMaxWidth()); Spacer(Modifier.height(10.dp)); Input(path, { path = it }, if (type == "movie") "File path" else "Source folder", Modifier.fillMaxWidth()); Spacer(Modifier.height(10.dp)); ActionButton(if (available) "Available" else "Unavailable", selected = available) { available = !available }; Spacer(Modifier.height(16.dp)); ActionButton("Save") { scope.launch { api.update(type, id, JSONObject().put("title", title).put(if (type == "movie") "filePath" else "sourceFolder", path).put("available", available)); saved() } } } }

@Composable
private fun FilePicker(api: LumoraApi, mode: String, allowFolder: Boolean, onClose: () -> Unit, picked: (String) -> Unit) {
    var roots by remember { mutableStateOf(emptyList<String>()) }; var current by remember { mutableStateOf("") }; var listing by remember { mutableStateOf(FsListing()) }; var selected by remember { mutableStateOf("") }; var error by remember { mutableStateOf("") }
    LaunchedEffect(Unit) { runCatching { api.roots() }.onSuccess { roots = it.roots; current = it.roots.firstOrNull().orEmpty() }.onFailure { error = it.message.orEmpty() } }
    LaunchedEffect(current, mode) { if (current.isNotEmpty()) runCatching { api.listFiles(current, mode) }.onSuccess { listing = it }.onFailure { error = it.message.orEmpty() } }
    Modal("Select ${if (allowFolder) "Folder" else "File"}", onClose) { Text(current, color = Muted, fontSize = 11.sp); Spacer(Modifier.height(10.dp)); Row { ActionButton("Up") { current = parentPath(current) }; roots.forEach { root -> ActionButton(root, selected = root == current) { current = root } } }; Spacer(Modifier.height(12.dp)); Row(Modifier.fillMaxWidth().height(360.dp)) { LazyColumn(Modifier.weight(1f)) { item { Text("Folders", color = Muted, fontSize = 11.sp) }; items(listing.dirs, key = { it.path }) { entry -> ActionButton("▸ ${entry.name}", Modifier.fillMaxWidth()) { current = entry.path } } }; Spacer(Modifier.width(12.dp)); LazyColumn(Modifier.weight(1f)) { item { Text("Files", color = Muted, fontSize = 11.sp) }; items(listing.files, key = { it.path }) { entry -> ActionButton(entry.name, Modifier.fillMaxWidth(), selected = selected == entry.path) { selected = entry.path } } } }; Text(error, color = Danger); Row { if (allowFolder) ActionButton("Use Folder") { picked(current) }; Spacer(Modifier.width(8.dp)); ActionButton("Select") { if (selected.isNotEmpty()) picked(selected) } } }
}

@Composable
private fun SettingsPage(api: LumoraApi, refreshCatalog: () -> Unit) {
    val scope = rememberCoroutineScope(); var value by remember { mutableStateOf(api.serverUrl) }; var status by remember { mutableStateOf("") }; var health by remember { mutableStateOf<Health?>(null) }; var cache by remember { mutableStateOf<CacheStats?>(null) }; var limit by remember { mutableStateOf("50") }
    fun refresh() { scope.launch { runCatching { health = api.health(); cache = api.cacheStats(); limit = ((cache?.limitBytes ?: 0) / 1024.0 / 1024 / 1024).roundToLong().toString() }.onFailure { status = it.message.orEmpty() } } }
    LaunchedEffect(Unit) { refresh() }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(34.dp), verticalArrangement = Arrangement.spacedBy(22.dp)) {
        item { PageTitle("Settings", "Server connection") }
        item { PanelBox { Text("Server URL", color = Foreground); Spacer(Modifier.height(10.dp)); Input(value, { value = it }, LumoraApi.DEFAULT_SERVER_URL, Modifier.fillMaxWidth()); Spacer(Modifier.height(12.dp)); Row { ActionButton("Test") { scope.launch { value = value.ifBlank { LumoraApi.DEFAULT_SERVER_URL }; api.serverUrl = value; status = if (api.healthReady()) "Connected." else "Connection failed."; refresh() } }; Spacer(Modifier.width(8.dp)); ActionButton("Reconnect") { scope.launch { value = value.ifBlank { LumoraApi.DEFAULT_SERVER_URL }; api.serverUrl = value; status = if (api.healthReady()) "Reconnected." else "Connection failed."; refresh(); refreshCatalog() } }; Spacer(Modifier.width(8.dp)); ActionButton("Save") { value = value.ifBlank { LumoraApi.DEFAULT_SERVER_URL }; api.serverUrl = value; status = "Saved."; refreshCatalog() } }; Text(status, color = if (status.contains("Connected") || status.contains("Reconnected") || status.contains("Saved")) Success else Danger, fontSize = 11.sp) } }
        item { PanelBox { Text("Playback engine", color = Foreground); Spacer(Modifier.height(10.dp)); Text("FFmpeg: ${if (health?.ready == true) "Ready" else if (health?.checked == true) "Missing required capabilities" else "Checking…"}", color = Muted, fontSize = 12.sp); Text(health?.capabilities?.entries?.joinToString(" · ") { "${it.key}: ${if (it.value) "yes" else "no"}" }.orEmpty(), color = Muted, fontSize = 11.sp); Spacer(Modifier.height(16.dp)); Text("Generated cache: ${cache?.sizeBytes?.let { "%.2f GiB".format(it / 1024.0 / 1024 / 1024) } ?: "Loading…"} · ${cache?.renditions ?: 0} renditions", color = Muted, fontSize = 12.sp); Spacer(Modifier.height(12.dp)); Row { Input(limit, { limit = it }, "GiB", Modifier.width(120.dp)); Spacer(Modifier.width(8.dp)); ActionButton("Apply") { scope.launch { api.setCacheLimit((limit.toDoubleOrNull() ?: 50.0).times(1024.0 * 1024 * 1024).roundToLong()); refresh() } }; Spacer(Modifier.width(8.dp)); ActionButton("Clear inactive", danger = true) { scope.launch { api.clearCache(); refresh() } } } } }
    }
}

@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
@Composable
private fun PlayerScreen(api: LumoraApi, media: MediaEntry, back: () -> Unit, settings: () -> Unit) {
    val context = LocalContext.current; val scope = rememberCoroutineScope(); val player = remember { ExoPlayer.Builder(context).setSeekBackIncrementMs(10_000).setSeekForwardIncrementMs(10_000).build() }; val mediaSession = remember(player) { MediaSession.Builder(context, player).build() }
    var info by remember { mutableStateOf<PlaybackInfo?>(null) }; var external by remember { mutableStateOf(emptyList<SubtitleTrack>()) }; var selectedSubtitle by remember { mutableStateOf<SubtitleTrack?>(null) }; var tracksPanel by remember { mutableStateOf(false) }; var speedPanel by remember { mutableStateOf(false) }; var error by remember { mutableStateOf("") }; var playbackState by remember { mutableIntStateOf(Player.STATE_IDLE) }; var resizeMode by remember { mutableIntStateOf(AspectRatioFrameLayout.RESIZE_MODE_FIT) }; var resume by remember { mutableLongStateOf(0L) }; var playerView by remember { mutableStateOf<RemotePlayerView?>(null) }
    fun sourceDuration() = info?.duration?.times(1000)?.toLong()?.takeIf { it > 0 } ?: player.duration
    fun load(audioIndex: Int? = null, keepPosition: Long = resume) { scope.launch { runCatching { info = api.prepare(media.id, audioIndex); external = api.subtitleTracks(media.id); val prepared = info ?: return@runCatching; if (prepared.error.isNotEmpty()) error = prepared.error else { val subtitles = selectedSubtitle?.let { listOf(MediaItem.SubtitleConfiguration.Builder(android.net.Uri.parse(it.url)).setMimeType(MimeTypes.TEXT_VTT).setLanguage(it.language).setSelectionFlags(C.SELECTION_FLAG_DEFAULT).build()) }.orEmpty(); player.setMediaItem(MediaItem.Builder().setMediaId(media.id).setUri(prepared.url).setMediaMetadata(MediaMetadata.Builder().setTitle(media.title).setArtist(media.seriesTitle.ifEmpty { "Lumora" }).build()).setSubtitleConfigurations(subtitles).build()); player.prepare(); if (keepPosition > 0) player.seekTo(keepPosition); player.playWhenReady = true } }.onFailure { error = it.message.orEmpty() } } }
    LaunchedEffect(media.id) { resume = api.resumeTime(media.id); load() }
    LaunchedEffect(selectedSubtitle?.id) { if (info?.url?.isNotEmpty() == true) load(info?.selectedAudio, player.currentPosition) }
    LaunchedEffect(player) { while (true) { delay(5000); runCatching { api.saveProgress(media.id, player.currentPosition, sourceDuration()) } } }
    DisposableEffect(player, mediaSession) { val listener = object : Player.Listener { override fun onPlaybackStateChanged(state: Int) { playbackState = state }; override fun onPlayerError(e: androidx.media3.common.PlaybackException) { error = e.message ?: "Playback failed" } }; player.addListener(listener); onDispose { val position = player.currentPosition; val duration = sourceDuration(); if (duration > 0) scope.launch { runCatching { api.saveProgress(media.id, position, duration) } }; player.removeListener(listener); mediaSession.release(); player.release() } }
    SideEffect { RemoteKeys.handler = { keyCode ->
        if (tracksPanel || speedPanel || playerView?.isControllerFullyVisible != false) false else when (keyCode) {
            KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_ENTER -> { if (player.isPlaying) player.pause() else player.play(); true }
            KeyEvent.KEYCODE_DPAD_LEFT -> { player.seekBack(); true }
            KeyEvent.KEYCODE_DPAD_RIGHT -> { player.seekForward(); true }
            KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN -> { playerView?.showController(); true }
            else -> false
        }
    } }
    DisposableEffect(Unit) { onDispose { RemoteKeys.handler = null } }
    LaunchedEffect(tracksPanel, speedPanel, playerView) {
        val panelOpen = tracksPanel || speedPanel
        playerView?.isFocusable = !panelOpen
        playerView?.descendantFocusability = if (panelOpen) ViewGroup.FOCUS_BLOCK_DESCENDANTS else ViewGroup.FOCUS_AFTER_DESCENDANTS
        if (panelOpen) { playerView?.clearFocus(); playerView?.hideController() } else playerView?.requestFocus()
    }
    BackHandler { if (tracksPanel || speedPanel) { tracksPanel = false; speedPanel = false; playerView?.showController() } else back() }
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(factory = { context -> (LayoutInflater.from(context).inflate(R.layout.lumora_player_view, null, false) as RemotePlayerView).apply {
            this.player = player; playerView = this; controllerShowTimeoutMs = 4000
            findViewById<android.widget.TextView>(R.id.lumora_player_title)?.text = media.seriesTitle.ifEmpty { media.title }
            findViewById<android.widget.TextView>(R.id.lumora_player_subtitle)?.text = if (media.seriesId.isNotEmpty()) "Season ${media.season}  •  Episode ${media.number}" else ""
            findViewById<android.view.View>(R.id.lumora_back)?.setOnClickListener { back() }
            findViewById<android.view.View>(R.id.lumora_tracks)?.setOnClickListener { hideController(); tracksPanel = true }
            findViewById<android.view.View>(R.id.lumora_speed)?.setOnClickListener { hideController(); speedPanel = true }
            findViewById<android.view.View>(R.id.lumora_aspect)?.setOnClickListener { resizeMode = if (resizeMode == AspectRatioFrameLayout.RESIZE_MODE_FIT) AspectRatioFrameLayout.RESIZE_MODE_ZOOM else AspectRatioFrameLayout.RESIZE_MODE_FIT; it.isSelected = resizeMode == AspectRatioFrameLayout.RESIZE_MODE_ZOOM }
            findViewById<android.widget.Button>(androidx.media3.ui.R.id.exo_rew_with_amount)?.apply { backgroundTintList = null; setBackgroundResource(R.drawable.player_center_background) }
            findViewById<android.view.View>(androidx.media3.ui.R.id.exo_play_pause)?.setBackgroundResource(R.drawable.player_center_background)
            findViewById<android.widget.Button>(androidx.media3.ui.R.id.exo_ffwd_with_amount)?.apply { backgroundTintList = null; setBackgroundResource(R.drawable.player_center_background) }
            layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT); requestFocus()
        } }, update = { view -> val duration = info?.duration?.times(1000)?.toLong() ?: 0L; view.resizeMode = resizeMode; view.findViewById<SourceDurationTimeBar>(androidx.media3.ui.R.id.exo_progress)?.sourceDurationMs = duration; view.findViewById<android.widget.TextView>(R.id.lumora_duration)?.text = if (duration > 0) formatPlaybackTime(duration) else "--:--" }, modifier = Modifier.fillMaxSize().focusable())
        if (info?.url.isNullOrEmpty() && error.isEmpty()) LoadingState(preparationLabel(info))
        if (error.isNotEmpty()) ErrorState(error, retry = { error = ""; load(info?.selectedAudio, player.currentPosition) }, settings = settings)
        if (tracksPanel) PlayerTracksPanel(info, external, selectedSubtitle, close = { tracksPanel = false; playerView?.showController() }, selectSubtitle = { selectedSubtitle = it; tracksPanel = false }, selectAudio = { val time = player.currentPosition; info = info?.copy(url = "", selectedAudio = it.index); tracksPanel = false; load(it.index, time) }, Modifier.align(Alignment.CenterEnd))
        if (speedPanel) TrackPanel("Playback speed", listOf(.5f, .75f, 1f, 1.25f, 1.5f), player.playbackParameters.speed, label = { "${it}x" }, select = { player.setPlaybackSpeed(it); playerView?.findViewById<android.view.View>(R.id.lumora_speed)?.isSelected = it != 1f; speedPanel = false; playerView?.showController() }, Modifier.align(Alignment.CenterEnd))
    }
}

private fun preparationLabel(info: PlaybackInfo?) = when (info?.state) { "queued" -> "Waiting to prepare"; "processing" -> when (info.method) { "audio-transcode" -> "Optimizing audio for this TV"; "full-transcode" -> "Optimizing video for this TV"; else -> "Preparing video for this TV" } + info.percentage?.let { " · $it%" }.orEmpty(); else -> "Starting video" }

@Composable
private fun PlayerTracksPanel(info: PlaybackInfo?, external: List<SubtitleTrack>, selectedSubtitle: SubtitleTrack?, close: () -> Unit, selectSubtitle: (SubtitleTrack?) -> Unit, selectAudio: (AudioTrack) -> Unit, modifier: Modifier = Modifier) {
    var tab by remember { mutableStateOf(if ((info?.audioTracks?.size ?: 0) > 1) "audio" else "subtitles") }
    val initialFocus = remember { FocusRequester() }
    LaunchedEffect(Unit) { initialFocus.requestFocus() }
    Column(modifier.width(380.dp).fillMaxHeight().background(Bg).padding(22.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) { Text("Audio & Subtitles", color = Foreground, fontSize = 20.sp); Spacer(Modifier.weight(1f)); ActionButton("Close", onClick = close) }
        Spacer(Modifier.height(18.dp)); Row { ActionButton("Audio", Modifier.focusRequester(initialFocus), selected = tab == "audio") { tab = "audio" }; Spacer(Modifier.width(8.dp)); ActionButton("Subtitles", selected = tab == "subtitles") { tab = "subtitles" } }; Spacer(Modifier.height(18.dp))
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            if (tab == "audio") items(info?.audioTracks.orEmpty()) { track -> ActionButton(track.title.ifEmpty { "${track.language} · ${track.channels}ch" }, Modifier.fillMaxWidth(), selected = track.index == info?.selectedAudio) { selectAudio(track) } }
            else { item { ActionButton("Off", Modifier.fillMaxWidth(), selected = selectedSubtitle == null) { selectSubtitle(null) } }; items(external + info?.subtitles.orEmpty()) { track -> ActionButton(track.label, Modifier.fillMaxWidth(), selected = track.id == selectedSubtitle?.id) { selectSubtitle(track) } } }
        }
    }
}

@Composable private fun <T> TrackPanel(title: String, tracks: List<T>, selected: T?, label: (T) -> String, select: (T) -> Unit, modifier: Modifier = Modifier) { val initialFocus = remember { FocusRequester() }; LaunchedEffect(Unit) { initialFocus.requestFocus() }; Column(modifier.width(370.dp).fillMaxHeight().background(Bg).padding(20.dp)) { Text(title, color = Foreground, fontSize = 18.sp); Spacer(Modifier.height(18.dp)); LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) { itemsIndexed(tracks) { index, track -> ActionButton(label(track), Modifier.fillMaxWidth().then(if (index == 0) Modifier.focusRequester(initialFocus) else Modifier), selected = track == selected) { select(track) } } } } }

@Composable private fun PosterCard(title: String, thumbnail: String, meta: String, focused: () -> Unit = {}, blockDown: Boolean = false, click: () -> Unit) { FocusBox(click, Modifier.width(175.dp).then(if (blockDown) Modifier.focusProperties { down = FocusRequester.Cancel } else Modifier), onFocused = focused) { Column { Poster(title, thumbnail, Modifier.fillMaxWidth(), 2f / 3f); Spacer(Modifier.height(8.dp)); Text(title, color = Foreground, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis); if (meta.isNotEmpty()) Text(meta, color = Muted, fontSize = 10.sp) } } }
@Composable private fun Poster(title: String, url: String, modifier: Modifier, aspect: Float) { val bitmap by rememberBitmap(url); Box(modifier.aspectRatio(aspect).clip(RoundedCornerShape(6.dp)).background(Panel), contentAlignment = Alignment.BottomStart) { if (bitmap != null) Image(bitmap!!.asImageBitmap(), title, Modifier.fillMaxSize(), contentScale = ContentScale.Crop); Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = if (bitmap != null) .27f else 0f))); Text(title, color = Color.White.copy(alpha = .84f), fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.padding(12.dp), maxLines = 2) } }
@Composable private fun HeroArtwork(title: String, url: String, modifier: Modifier = Modifier) { val bitmap by rememberBitmap(url); Box(modifier.background(Bg)) { if (bitmap != null) Image(bitmap!!.asImageBitmap(), title, Modifier.fillMaxSize(), contentScale = ContentScale.Crop); Box(Modifier.fillMaxSize().background(Brush.horizontalGradient(listOf(Color.Black, Color.Black.copy(alpha = .78f), Color.Transparent)))); Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = .12f), Color.Black)))) } }
@Composable private fun rememberBitmap(url: String): State<Bitmap?> = produceState(null, url) { if (url.isNotEmpty()) value = withContext(Dispatchers.IO) { runCatching { val connection = URL(url).openConnection() as HttpURLConnection; try { connection.connectTimeout = 8000; connection.readTimeout = 15000; connection.setRequestProperty("Accept", "image/*"); if (connection.responseCode !in 200..299) error("Image request failed"); connection.inputStream.use(BitmapFactory::decodeStream) } finally { connection.disconnect() } }.getOrNull() } }
@Composable private fun FocusBox(onClick: () -> Unit, modifier: Modifier = Modifier, active: Boolean = false, onFocused: () -> Unit = {}, content: @Composable () -> Unit) { var focused by remember { mutableStateOf(false) }; Box(modifier.onFocusChanged { state -> focused = state.isFocused; if (state.isFocused) onFocused() }.border(if (focused) 2.dp else 0.dp, if (focused) Color.White else Color.Transparent, RoundedCornerShape(7.dp)).padding(if (focused) 3.dp else 0.dp).clip(RoundedCornerShape(7.dp)).background(if (focused) Panel2 else if (active) Panel else Color.Transparent).clickable(onClick = onClick).focusable()) { content() } }
@Composable private fun ActionButton(label: String, modifier: Modifier = Modifier, selected: Boolean = false, danger: Boolean = false, icon: ImageVector? = null, onClick: () -> Unit) { var focused by remember { mutableStateOf(false) }; val shape = RoundedCornerShape(6.dp); Box(modifier.onFocusChanged { focused = it.isFocused }.border(if (focused) 2.dp else 0.dp, if (focused) Color.White else Color.Transparent, shape).padding(if (focused) 3.dp else 0.dp).border(if (focused && selected) 2.dp else 0.dp, if (focused && selected) Color.Black else Color.Transparent, shape).clip(shape).background(if (selected) Foreground else if (focused) Panel2 else Panel).clickable(onClick = onClick).focusable().padding(horizontal = 16.dp, vertical = 11.dp), contentAlignment = Alignment.Center) { Row(verticalAlignment = Alignment.CenterVertically) { if (icon != null) { VectorIcon(icon, if (selected) Color.Black else if (danger) Danger else Foreground, Modifier.size(16.dp)); Spacer(Modifier.width(7.dp)) }; Text(label, color = if (selected) Color.Black else if (danger) Danger else Foreground, fontSize = 12.sp, maxLines = 1) } } }
@Composable private fun VectorIcon(icon: ImageVector, tint: Color, modifier: Modifier = Modifier) { Image(icon, null, modifier, colorFilter = ColorFilter.tint(tint)) }
@Composable private fun Input(value: String, change: (String) -> Unit, placeholder: String, modifier: Modifier, onSubmit: (() -> Unit)? = null) { var focused by remember { mutableStateOf(false) }; val keyboard = LocalSoftwareKeyboardController.current; LaunchedEffect(focused) { if (focused) { delay(120); keyboard?.hide() } }; BasicTextField(value, change, modifier.onFocusChanged { focused = it.isFocused }.border(if (focused) 2.dp else 1.dp, if (focused) Color.White else Hairline, RoundedCornerShape(6.dp)).background(Panel, RoundedCornerShape(6.dp)).padding(horizontal = 14.dp, vertical = 12.dp).onPreviewKeyEvent { if (it.nativeKeyEvent.keyCode == KeyEvent.KEYCODE_ENTER && it.nativeKeyEvent.action == KeyEvent.ACTION_DOWN) { if (value.isNotBlank() && onSubmit != null) onSubmit() else keyboard?.show(); true } else false }, textStyle = TextStyle(Foreground, 13.sp), cursorBrush = SolidColor(Foreground), singleLine = true, decorationBox = { inner -> if (value.isEmpty()) Text(placeholder, color = Muted, fontSize = 13.sp) else inner() }) }
@Composable private fun PageTitle(title: String, subtitle: String) { Text(title, color = Foreground, fontSize = 26.sp, fontWeight = FontWeight.SemiBold); Text(subtitle, color = Muted, fontSize = 13.sp) }
@Composable private fun Progress(value: Float, modifier: Modifier) { Box(modifier.height(4.dp).background(Panel, RoundedCornerShape(4.dp))) { Box(Modifier.fillMaxHeight().fillMaxWidth(value.coerceIn(0f, 1f)).background(Foreground, RoundedCornerShape(4.dp))) } }
@Composable private fun RowScope.PlayerProgress(position: Long, duration: Long, seek: (Long) -> Unit) { val fraction = if (duration > 0) position.toFloat() / duration else 0f; Box(Modifier.weight(1f).height(28.dp).padding(vertical = 11.dp).clip(RoundedCornerShape(4.dp)).background(Color.White.copy(alpha = .22f)).pointerInput(duration) { detectTapGestures { offset -> if (duration > 0) seek((duration * (offset.x / size.width).coerceIn(0f, 1f)).toLong()) } }) { Box(Modifier.fillMaxHeight().fillMaxWidth(fraction.coerceIn(0f, 1f)).background(Color.White)) } }
@Composable private fun PanelBox(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) { Column(modifier.clip(RoundedCornerShape(10.dp)).background(Panel).padding(20.dp), content = content) }
@Composable private fun Modal(title: String, close: () -> Unit, content: @Composable ColumnScope.() -> Unit) { Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .75f)), contentAlignment = Alignment.Center) { Column(Modifier.fillMaxWidth(.78f).fillMaxHeight(.88f).clip(RoundedCornerShape(14.dp)).background(Bg).padding(22.dp)) { Row { Text(title, color = Foreground, fontSize = 20.sp); Spacer(Modifier.weight(1f)); ActionButton("Close", onClick = close) }; Spacer(Modifier.height(18.dp)); Column(Modifier.fillMaxSize(), content = content) } } }
@Composable private fun LoadingState(label: String) { Box(Modifier.fillMaxSize().background(Bg), contentAlignment = Alignment.Center) { Text(label, color = Muted, fontSize = 15.sp) } }
@Composable private fun ErrorState(message: String, retry: () -> Unit, settings: () -> Unit) { val context = LocalContext.current; val retryFocus = remember { FocusRequester() }; LaunchedEffect(Unit) { retryFocus.requestFocus() }; Column(Modifier.fillMaxSize().background(Bg), verticalArrangement = Arrangement.Center, horizontalAlignment = Alignment.CenterHorizontally) { Text("Something went wrong", color = Foreground, fontSize = 24.sp); Spacer(Modifier.height(8.dp)); Text(message, color = Danger, fontSize = 13.sp); Spacer(Modifier.height(18.dp)); Row { ActionButton("Retry", Modifier.focusRequester(retryFocus), icon = Icons.Default.Refresh, onClick = retry); Spacer(Modifier.width(10.dp)); ActionButton("Settings", icon = Icons.Default.Settings, onClick = settings); Spacer(Modifier.width(10.dp)); ActionButton("Quit", icon = Icons.Default.Close) { (context as? Activity)?.finishAffinity() } } } }
private fun emptyCatalog() = Catalog(emptyList(), emptyList(), emptyList(), "")
private fun formatPlaybackTime(milliseconds: Long): String { val seconds = (milliseconds.coerceAtLeast(0L) / 1000); val hours = seconds / 3600; val minutes = (seconds % 3600) / 60; val remainder = seconds % 60; return if (hours > 0) "%d:%02d:%02d".format(hours, minutes, remainder) else "%02d:%02d".format(minutes, remainder) }
private fun formatDate(value: String) = runCatching {
    val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSX", Locale.US).apply { timeZone = TimeZone.getTimeZone("UTC") }
    SimpleDateFormat("MMM d, yyyy · HH:mm", Locale.getDefault()).format(parser.parse(value)!!)
}.getOrDefault(value)
private fun parentPath(path: String): String { val cleaned = path.trimEnd('/', '\\'); val index = maxOf(cleaned.lastIndexOf('/'), cleaned.lastIndexOf('\\')); return if (index <= 0) cleaned else cleaned.substring(0, index + 1) }
private suspend fun scanVideoFiles(api: LumoraApi, root: String): List<FsEntry> { if (root.isEmpty()) return emptyList(); val videos = mutableListOf<FsEntry>(); val queue = ArrayDeque<String>(); queue.add(root); while (queue.isNotEmpty()) { val listing = api.listFiles(queue.removeFirst(), "all"); listing.dirs.forEach { queue.add(it.path) }; videos += listing.files.filter { it.extension.lowercase() in setOf(".mp4", ".mkv", ".avi", ".mov", ".m4v", ".webm", ".wmv", ".flv") } }; return videos.sortedBy { it.name.lowercase() } }
@androidx.annotation.OptIn(androidx.media3.common.util.UnstableApi::class)
class RemotePlayerView @JvmOverloads constructor(context: android.content.Context, attrs: android.util.AttributeSet? = null) : PlayerView(context, attrs) {
    var onFullscreenKey: ((Int) -> Boolean)? = null
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN && !isControllerFullyVisible && onFullscreenKey?.invoke(event.keyCode) == true) return true
        return super.dispatchKeyEvent(event)
    }
}

class SourceDurationTimeBar @JvmOverloads constructor(context: android.content.Context, attrs: android.util.AttributeSet? = null) : DefaultTimeBar(context, attrs) {
    var sourceDurationMs: Long = 0
        set(value) { field = value; if (value > 0) super.setDuration(value) }
    override fun setDuration(duration: Long) { super.setDuration(sourceDurationMs.takeIf { it > 0 } ?: duration) }
}
