package com.lumora.tv.data

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

data class MediaEntry(
    val id: String, val title: String, val kind: String, val path: String, val extension: String,
    val thumbnailUrl: String, val progress: Float?, val currentTime: Double, val duration: Double,
    val lastWatchedAt: String, val modifiedAt: String, val available: Boolean, val season: Int = 0,
    val number: Int = 0, val seriesId: String = "", val seriesTitle: String = "", val subtitles: List<String> = emptyList(),
    val trailerPath: String = ""
)
data class Season(val number: Int, val episodes: List<MediaEntry>)
data class SeriesEntry(
    val id: String, val title: String, val path: String, val sourceFolder: String, val thumbnailUrl: String,
    val available: Boolean, val subtitles: List<String>, val trailerPath: String, val seasons: List<Season>
)
data class Catalog(val movies: List<MediaEntry>, val series: List<SeriesEntry>, val sources: List<String>, val generatedAt: String) {
    val episodes = series.flatMap { show -> show.seasons.flatMap { season -> season.episodes.map { it.copy(seriesId = show.id, seriesTitle = show.title, season = season.number) } } }
    val allMedia get() = movies + episodes
    val history get() = allMedia.filter { it.lastWatchedAt.isNotEmpty() }.sortedByDescending { it.lastWatchedAt }
    val continueWatching get() = history.filter { (it.progress ?: 0f) > 0f && (it.progress ?: 0f) < 1f }
    val recentlyAdded get() = allMedia.sortedByDescending { it.modifiedAt }
}
data class AudioTrack(val index: Int, val language: String, val title: String, val codec: String, val channels: Int)
data class SubtitleTrack(val id: String, val label: String, val language: String, val url: String)
data class PlaybackInfo(val state: String, val method: String, val duration: Double, val percentage: Int?, val url: String, val pollingUrl: String, val audioTracks: List<AudioTrack>, val selectedAudio: Int?, val subtitles: List<SubtitleTrack>, val error: String)
data class FsEntry(val name: String, val path: String, val type: String, val extension: String = "")
data class FsListing(val roots: List<String> = emptyList(), val dirs: List<FsEntry> = emptyList(), val files: List<FsEntry> = emptyList())
data class CacheStats(val sizeBytes: Long, val limitBytes: Long, val renditions: Int, val active: Int, val queued: Int)
data class Health(val ready: Boolean, val checked: Boolean, val capabilities: Map<String, Boolean>)

class LumoraApi(context: Context) {
    private val preferences = context.getSharedPreferences("lumora", Context.MODE_PRIVATE)
    var serverUrl: String
        get() = preferences.getString("server_url", DEFAULT_SERVER_URL).orEmpty().ifBlank { DEFAULT_SERVER_URL }
        set(value) { preferences.edit().putString("server_url", value.trim().trimEnd('/')).apply() }

    companion object {
        const val DEFAULT_SERVER_URL = "http://192.168.20.106:8787"
    }

    suspend fun healthReady() = runCatching { request("/api/health").optBoolean("ok") }.getOrDefault(false)
    suspend fun health(): Health {
        val playback = request("/api/health").optJSONObject("playback") ?: JSONObject()
        val capabilities = playback.optJSONObject("capabilities") ?: JSONObject()
        return Health(playback.optBoolean("ok"), playback.optBoolean("checked"), capabilities.keys().asSequence().associateWith { capabilities.optBoolean(it) })
    }
    suspend fun cacheStats(): CacheStats = request("/api/media-cache").toCacheStats()
    suspend fun setCacheLimit(bytes: Long) = request("/api/media-cache/limit", "POST", JSONObject().put("limitBytes", bytes)).toCacheStats()
    suspend fun clearCache() = request("/api/media-cache/clear", "POST", JSONObject()).toCacheStats()

    suspend fun catalog(): Catalog {
        val json = request("/api/catalog")
        val generatedAt = json.optString("generatedAt")
        fun thumbnail(path: String) = absolute(path).let { "$it?v=${encode(generatedAt)}" }
        val movies = json.optJSONArray("movies").objects().map { movie -> movie.toMedia("movie").copy(thumbnailUrl = thumbnail(movie.optString("thumbnailUrl"))) }
        val series = json.optJSONArray("series").objects().map { show ->
            val seasons = show.optJSONArray("seasons").objects().map { season -> Season(season.optInt("number"), season.optJSONArray("episodes").objects().map { episode -> episode.toMedia("episode", season.optInt("number"), show.optString("id"), show.optString("title")).copy(thumbnailUrl = thumbnail(episode.optString("thumbnailUrl"))) }) }
            SeriesEntry(show.optString("id"), show.optString("title", "Untitled"), show.optString("path"), show.optString("sourceFolder"), thumbnail(show.optString("thumbnailUrl")), show.optBoolean("available", true), show.optJSONArray("subtitles").strings(), show.optString("trailerPath"), seasons)
        }
        return Catalog(movies, series, json.optJSONArray("sources").strings(), generatedAt)
    }

    suspend fun playbackInfo(mediaId: String): PlaybackInfo = parsePlayback(request("/api/media/$mediaId/playback"), mediaId)
    suspend fun prepare(mediaId: String, audioIndex: Int? = null): PlaybackInfo {
        val body = JSONObject(); if (audioIndex != null) body.put("audioStreamIndex", audioIndex)
        var info = parsePlayback(request("/api/media/$mediaId/playback", "POST", body), mediaId)
        while (info.url.isEmpty() && info.error.isEmpty()) {
            if (info.pollingUrl.isEmpty()) return info.copy(error = "Playback URL was not returned")
            delay(1000); info = parsePlayback(request(info.pollingUrl), mediaId, info)
        }
        return info
    }
    suspend fun subtitleTracks(mediaId: String): List<SubtitleTrack> = request("/api/subtitles/$mediaId").optJSONArray("tracks").objects().map { SubtitleTrack("ext:${it.optString("id")}", it.optString("label"), it.optString("lang", "und"), absolute(it.optString("url"))) }
    suspend fun resumeTime(mediaId: String): Long = request("/api/playback/$mediaId").optJSONObject("playback")?.optDouble("currentTime", 0.0)?.times(1000)?.toLong() ?: 0L
    suspend fun saveProgress(mediaId: String, positionMs: Long, durationMs: Long) { if (durationMs > 0) request("/api/playback/$mediaId", "POST", JSONObject().put("currentTime", positionMs / 1000.0).put("duration", durationMs / 1000.0).put("progress", positionMs.toDouble() / durationMs)) }

    suspend fun roots() = FsListing(roots = request("/api/fs/roots").optJSONArray("roots").strings())
    suspend fun listFiles(path: String, mode: String) = request("/api/fs/list?path=${encode(path)}&mode=${encode(mode)}").let { json -> FsListing(dirs = json.optJSONArray("dirs").objects().map { it.toFs() }, files = json.optJSONArray("files").objects().map { it.toFs() }) }
    suspend fun createMovie(title: String, filePath: String, subtitles: List<String>, thumbnail: String, trailer: String) = request("/api/library/movie", "POST", JSONObject().put("title", title).put("filePath", filePath).put("subtitles", JSONArray(subtitles)).put("thumbnailPath", thumbnail).put("trailerPath", trailer))
    suspend fun createSeries(title: String, episodeFiles: List<JSONObject>, subtitles: List<String>, thumbnail: String, trailer: String) = request("/api/library/series", "POST", JSONObject().put("title", title).put("episodeFiles", JSONArray(episodeFiles)).put("subtitles", JSONArray(subtitles)).put("thumbnailPath", thumbnail).put("trailerPath", trailer))
    suspend fun update(type: String, id: String, body: JSONObject) = request("/api/library/$type/$id/update", "POST", body)
    suspend fun delete(type: String, id: String) = request("/api/library/$type/$id/delete", "POST", JSONObject())
    suspend fun addSource(path: String) = request("/api/sources/add", "POST", JSONObject().put("path", path))
    suspend fun deleteSource(path: String) = request("/api/sources/delete", "POST", JSONObject().put("path", path))

    private fun parsePlayback(json: JSONObject, mediaId: String, previous: PlaybackInfo? = null): PlaybackInfo {
        val compatibility = json.optJSONObject("compatibility")
        val audio = json.optJSONArray("audioTracks").objects().map { AudioTrack(it.optInt("index"), it.optString("language", "und"), it.optString("title"), it.optString("codec"), it.optInt("channels")) }.ifEmpty { previous?.audioTracks ?: emptyList() }
        val embedded = json.optJSONArray("subtitles").objects().filter { it.optBoolean("supported") }.map { SubtitleTrack("emb:${it.optInt("index")}", it.optString("title").ifEmpty { "${it.optString("language", "und")} subtitles" }, it.optString("language", "und"), absolute("/api/media/$mediaId/embedded-subtitles/${it.optInt("index")}.vtt")) }
        return PlaybackInfo(json.optString("state", previous?.state ?: "processing"), compatibility?.optString("method") ?: json.optString("method", previous?.method ?: ""), json.optDouble("duration", previous?.duration ?: 0.0), if (json.has("percentage") && !json.isNull("percentage")) json.optInt("percentage") else null, json.optString("playbackUrl").takeIf { it.isNotEmpty() }?.let(::absolute) ?: "", json.optString("pollingUrl", previous?.pollingUrl ?: ""), audio, if (json.has("selectedAudioStreamIndex") && !json.isNull("selectedAudioStreamIndex")) json.optInt("selectedAudioStreamIndex") else previous?.selectedAudio, embedded.ifEmpty { previous?.subtitles ?: emptyList() }, json.optJSONObject("failure")?.optString("message").orEmpty())
    }

    private suspend fun request(path: String, method: String = "GET", body: JSONObject? = null): JSONObject = withContext(Dispatchers.IO) {
        check(serverUrl.isNotEmpty()) { "Set the Lumora server address first" }
        val connection = URL(absolute(path)).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method; connection.connectTimeout = 8000; connection.readTimeout = 30000; connection.setRequestProperty("Accept", "application/json")
            if (body != null) { connection.doOutput = true; connection.setRequestProperty("Content-Type", "application/json"); connection.outputStream.use { it.write(body.toString().toByteArray()) } }
            val text = (if (connection.responseCode in 200..299) connection.inputStream else connection.errorStream)?.bufferedReader()?.use { it.readText() }.orEmpty()
            if (connection.responseCode !in 200..299) { val error = runCatching { JSONObject(text) }.getOrDefault(JSONObject()); throw IllegalStateException(error.optJSONObject("failure")?.optString("message") ?: error.optString("error", "Server error ${connection.responseCode}")) }
            JSONObject(text.ifEmpty { "{}" })
        } finally { connection.disconnect() }
    }
    private fun absolute(path: String) = if (path.startsWith("http://") || path.startsWith("https://")) path else "$serverUrl$path"
    private fun encode(value: String) = URLEncoder.encode(value, Charsets.UTF_8.name())
}

private fun JSONArray?.objects() = if (this == null) emptyList() else (0 until length()).map { getJSONObject(it) }
private fun JSONArray?.strings() = if (this == null) emptyList() else (0 until length()).map { getString(it) }
private fun JSONObject.toMedia(kind: String, season: Int = 0, seriesId: String = "", seriesTitle: String = "") = MediaEntry(optString("id"), optString("title", "Untitled"), kind, optString("path"), optString("extension"), optString("thumbnailUrl"), if (has("progress") && !isNull("progress")) optDouble("progress").toFloat() else null, optDouble("currentTime"), optDouble("duration"), optString("lastWatchedAt"), optString("modifiedAt"), optBoolean("available", true), season, optInt("number"), seriesId, seriesTitle, optJSONArray("subtitles").strings(), optString("trailerPath"))
private fun JSONObject.toFs() = FsEntry(optString("name"), optString("path"), optString("type"), optString("ext"))
private fun JSONObject.toCacheStats() = CacheStats(optLong("sizeBytes"), optLong("limitBytes"), optInt("renditions"), optInt("active"), optInt("queued"))
