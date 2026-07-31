const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const storagePath = require('../storage');
const { spawn } = require('node:child_process');
const ffmpegStatic = require('ffmpeg-static');

const root = storagePath('media-cache');
const jobs = new Map();
const queue = [];
let active = null;
let shuttingDown = false;
let limitBytes = Number(process.env.MEDIA_CACHE_LIMIT_BYTES || 50 * 1024 ** 3);
const ffmpegThreads = Math.max(1, Number(process.env.FFMPEG_THREADS || Math.min(4, Math.ceil((os.availableParallelism?.() || os.cpus().length) / 2))));
const minimumPlayableSeconds = Math.max(8, Number(process.env.MEDIA_MINIMUM_BUFFER_SECONDS || 30));

const binary = () => process.env.FFMPEG_PATH || ffmpegStatic;
const renditionId = (fingerprint, audioIndex, method) => crypto.createHash('sha1').update(`${fingerprint}|${audioIndex ?? 'none'}|${method}|fallback-1080p-v3`).digest('hex').slice(0, 16);
const stateFile = (job) => path.join(job.dir, 'state.json');
const publicState = (job) => ({
    renditionId: job.id, method: job.method, state: job.state, processedDuration: job.processedDuration || 0,
    percentage: job.duration ? Math.min(100, Math.round((job.processedDuration || 0) / job.duration * 100)) : null,
    playbackUrl: ['playable', 'complete'].includes(job.state) ? `/api/media/${job.mediaId}/renditions/${job.id}/index.m3u8` : null,
    failure: job.failure || null
});
const persist = (job) => {
    job.persisting = (job.persisting || Promise.resolve()).catch(() => {}).then(async () => {
        await fs.mkdir(job.dir, { recursive: true });
        job.lastAccessedAt = new Date().toISOString();
        const temp = `${stateFile(job)}.tmp`;
        await fs.writeFile(temp, JSON.stringify({ ...publicState(job), fingerprint: job.fingerprint, audioIndex: job.audioIndex, duration: job.duration, lastAccessedAt: job.lastAccessedAt }, null, 2));
        await fs.rename(temp, stateFile(job));
    });
    return job.persisting;
};
const playable = async (job, requireComplete = false) => {
    try {
        const names = await fs.readdir(job.dir);
        if (!names.includes('init.mp4') || !names.includes('index.m3u8')) return false;
        const playlist = await fs.readFile(path.join(job.dir, 'index.m3u8'), 'utf8');
        const segments = playlist.split(/\r?\n/).filter((line) => /^segment\d+\.m4s$/.test(line));
        return segments.length >= 2
            && segments.every((name) => names.includes(name))
            && (!requireComplete || playlist.includes('#EXT-X-ENDLIST'));
    } catch { return false; }
};
const hydrate = (async () => {
    for (const fingerprintEntry of await fs.readdir(root, { withFileTypes: true }).catch(() => [])) {
        if (!fingerprintEntry.isDirectory() || fingerprintEntry.name === 'probes' || fingerprintEntry.name === 'verification') continue;
        const fingerprintDir = path.join(root, fingerprintEntry.name);
        for (const renditionEntry of await fs.readdir(fingerprintDir, { withFileTypes: true }).catch(() => [])) {
            if (!renditionEntry.isDirectory()) continue;
            const dir = path.join(fingerprintDir, renditionEntry.name);
            try {
                const saved = JSON.parse(await fs.readFile(path.join(dir, 'state.json'), 'utf8'));
                if (saved.state === 'complete' && await playable({ dir }, true)) {
                    jobs.set(renditionEntry.name, { ...saved, id: renditionEntry.name, dir });
                } else if (['queued', 'processing', 'playable'].includes(saved.state)) {
                    saved.state = 'interrupted';
                    saved.failure = { code: 'preparation_interrupted', message: 'Playback preparation was interrupted and will restart on the next request' };
                    await fs.writeFile(path.join(dir, 'state.json'), JSON.stringify(saved, null, 2));
                }
            } catch { /* invalid cache entry */ }
        }
    }
})();
const toneMap = (video) => video.hdr ? 'zscale=t=linear:npl=100,tonemap=tonemap=hable:desat=0,zscale=p=bt709:t=bt709:m=bt709:r=tv,' : '';
const argsFor = (job) => {
    const args = ['-y', '-v', 'error', '-filter_threads', String(ffmpegThreads), '-i', job.source, '-map', '0:v:0'];
    if (job.audioIndex !== null) args.push('-map', `0:${job.audioIndex}`); else args.push('-an');
    if (job.method === 'full-transcode') {
        args.push('-vf', `${toneMap(job.video)}scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,format=yuv420p`, '-c:v', 'libx264', '-threads:v', String(ffmpegThreads), '-preset', 'veryfast', '-crf', '21', '-profile:v', 'high', '-level:v', '4.1', '-g', '96', '-keyint_min', '96', '-sc_threshold', '0');
    } else args.push('-c:v', 'copy');
    if (job.audioIndex !== null) {
        if (job.copyAudio) args.push('-c:a', 'copy');
        else args.push('-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '192k', '-ac', '2', '-ar', '48000');
    }
    args.push('-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'event', '-hls_segment_type', 'fmp4', '-hls_fmp4_init_filename', 'init.mp4', '-hls_flags', 'independent_segments+temp_file', '-hls_segment_filename', 'segment%d.m4s', '-progress', 'pipe:2', 'index.m3u8');
    return args;
};
const startNext = () => {
    if (shuttingDown || active || !queue.length) return;
    const job = queue.shift(); active = job; job.state = 'processing'; job.startedAt = Date.now(); persist(job).catch(() => {});
    const child = spawn(binary(), argsFor(job), { windowsHide: true, cwd: job.dir }); job.child = child;
    let progressBuffer = ''; let errorText = '';
    child.stderr.on('data', async (chunk) => {
        progressBuffer += String(chunk); errorText = (errorText + String(chunk)).slice(-4000);
        const lines = progressBuffer.split(/\r?\n/); progressBuffer = lines.pop();
        for (const line of lines) {
            const match = /^out_time_ms=(\d+)/.exec(line);
            if (match) job.processedDuration = Number(match[1]) / 1000000;
        }
        const elapsed = Math.max(1, (Date.now() - job.startedAt) / 1000);
        if (job.state === 'processing' && job.processedDuration >= minimumPlayableSeconds && job.processedDuration / elapsed >= 1.05 && await playable(job)) job.state = 'playable';
        persist(job).catch(() => {});
    });
    child.on('error', (error) => { job.failure = { code: 'ffmpeg_unavailable', message: error.message }; });
    child.on('close', async (code) => {
        job.child = null;
        if (job.stopping) { job.state = 'interrupted'; job.failure = { code: 'preparation_interrupted', message: 'Playback preparation was interrupted and will restart on the next request' }; }
        else if (code === 0 && await playable(job, true)) { job.state = 'complete'; job.processedDuration = job.duration; }
        else if (code === 0) { job.state = 'failed'; job.failure = { code: 'invalid_rendition', message: 'FFmpeg completed without producing a valid HLS rendition' }; }
        else { job.state = 'failed'; if (!job.failure) job.failure = { code: 'transcode_failed', message: errorText.trim() || `ffmpeg exited ${code}` }; }
        await persist(job); active = null; startNext(); evict().catch(() => {});
    });
};

const prepare = async ({ mediaId, source, metadata, decision }) => {
    await hydrate;
    const id = renditionId(metadata.fingerprint, decision.audio?.index, decision.method);
    if (jobs.has(id)) { const existing = jobs.get(id); Object.assign(existing, { mediaId, source, video: metadata.video }); await persist(existing); return publicState(existing); }
    const dir = path.join(root, metadata.fingerprint, id);
    try {
        const saved = JSON.parse(await fs.readFile(path.join(dir, 'state.json'), 'utf8'));
        if (saved.state === 'complete' && await playable({ dir }, true)) {
            const job = { ...saved, id, dir, mediaId, source, video: metadata.video, state: 'complete' }; jobs.set(id, job); await persist(job); return publicState(job);
        }
        await fs.rm(dir, { recursive: true, force: true });
    } catch { /* no persisted rendition */ }
    const job = { id, dir, mediaId, source, fingerprint: metadata.fingerprint, duration: metadata.duration, audioIndex: decision.audio?.index ?? null, video: metadata.video, method: decision.method, copyAudio: decision.method === 'remux', state: 'queued', processedDuration: 0 };
    jobs.set(id, job); await persist(job); queue.push(job); startNext(); return publicState(job);
};
const get = async (id) => {
    await hydrate;
    const job = jobs.get(id); if (!job) return null; await persist(job); return publicState(job);
};
const asset = async (id, fileName) => {
    await hydrate;
    const job = jobs.get(id); if (!job || !/^(index\.m3u8|init\.mp4|segment\d+\.m4s)$/.test(fileName)) return null;
    const target = path.resolve(job.dir, fileName); if (!target.startsWith(`${path.resolve(job.dir)}${path.sep}`)) return null;
    try { await fs.access(target); return { target, complete: job.state === 'complete' }; } catch { return null; }
};
const directorySize = async (dir) => { let total = 0; for (const entry of await fs.readdir(dir, { withFileTypes: true }).catch(() => [])) { const target = path.join(dir, entry.name); total += entry.isDirectory() ? await directorySize(target) : (await fs.stat(target)).size; } return total; };
const stats = async () => { await hydrate; return { sizeBytes: await directorySize(root), limitBytes, active: active ? 1 : 0, queued: queue.length, renditions: jobs.size, ffmpegThreads, minimumPlayableSeconds }; };
const evict = async () => {
    let current = await directorySize(root); if (current <= limitBytes) return;
    const candidates = [...jobs.values()].filter((job) => job.state === 'complete').sort((a, b) => String(a.lastAccessedAt || '').localeCompare(String(b.lastAccessedAt || '')));
    for (const job of candidates) { const size = await directorySize(job.dir); await fs.rm(job.dir, { recursive: true, force: true }); jobs.delete(job.id); current -= size; if (current <= limitBytes) break; }
};
const setLimit = async (value) => { limitBytes = value; await evict(); return stats(); };
const clear = async () => { for (const job of [...jobs.values()]) if (job !== active && job.state !== 'processing') { await fs.rm(job.dir, { recursive: true, force: true }); jobs.delete(job.id); } return stats(); };
const shutdown = async () => {
    shuttingDown = true;
    for (const job of queue) {
        job.state = 'interrupted';
        job.failure = { code: 'preparation_interrupted', message: 'Playback preparation was interrupted and will restart on the next request' };
        await persist(job);
    }
    queue.length = 0;
    if (!active?.child) return;
    active.stopping = true;
    active.state = 'interrupted';
    active.failure = { code: 'preparation_interrupted', message: 'Playback preparation was interrupted and will restart on the next request' };
    await persist(active);
    await new Promise((resolve) => { active.child.once('close', resolve); active.child.kill(); });
};

module.exports = { binary, prepare, get, asset, stats, setLimit, clear, shutdown };
