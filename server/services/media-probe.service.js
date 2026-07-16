const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const ffprobeStatic = require('ffprobe-static');
const ffmpegStatic = require('ffmpeg-static');
const policy = require('./playback-policy.service');

const cacheDir = path.resolve('data/media-cache/probes');
const pending = new Map();
const queue = [];
let running = 0;

const binary = () => process.env.FFPROBE_PATH || ffprobeStatic.path;
const fingerprint = async (filePath) => {
    const resolved = path.resolve(filePath);
    const stat = await fs.stat(resolved);
    return crypto.createHash('sha256').update(`${resolved}|${stat.size}|${stat.mtimeMs}|${policy.POLICY_VERSION}`).digest('hex');
};

const normalize = (json, sourceFingerprint) => {
    const streams = Array.isArray(json.streams) ? json.streams : [];
    const rawVideo = streams.find((stream) => stream.codec_type === 'video');
    const transfer = String(rawVideo?.color_transfer || '').toLowerCase();
    const colorSpace = String(rawVideo?.color_space || '').toLowerCase();
    const sideData = rawVideo?.side_data_list || [];
    const video = rawVideo ? {
        index: rawVideo.index, codec: String(rawVideo.codec_name || ''), profile: String(rawVideo.profile || ''), level: Number(rawVideo.level || 0),
        pixelFormat: String(rawVideo.pix_fmt || ''), width: Number(rawVideo.width || 0), height: Number(rawVideo.height || 0),
        colorSpace, colorTransfer: transfer, colorPrimaries: String(rawVideo.color_primaries || '').toLowerCase(),
        hdr: ['smpte2084', 'arib-std-b67'].includes(transfer) || colorSpace === 'bt2020nc',
        dolbyVision: sideData.some((entry) => /dovi|dolby vision/i.test(entry.side_data_type || ''))
    } : null;
    const mapTrack = (stream) => ({
        index: stream.index, codec: String(stream.codec_name || ''), profile: String(stream.profile || ''), channels: Number(stream.channels || 0),
        language: stream.tags?.language || 'und', title: stream.tags?.title || '', default: Boolean(stream.disposition?.default)
    });
    const audio = streams.filter((stream) => stream.codec_type === 'audio').map(mapTrack);
    const subtitles = streams.filter((stream) => stream.codec_type === 'subtitle').map((stream) => ({
        ...mapTrack(stream), supported: ['subrip', 'srt', 'webvtt', 'ass', 'ssa', 'mov_text'].includes(stream.codec_name)
    }));
    return {
        fingerprint: sourceFingerprint, policyVersion: policy.POLICY_VERSION,
        containers: String(json.format?.format_name || '').split(',').filter(Boolean), duration: Number(json.format?.duration || 0),
        video, audio, subtitles
    };
};

const run = (filePath, sourceFingerprint) => new Promise((resolve) => {
    const child = spawn(binary(), ['-v', 'error', '-show_format', '-show_streams', '-print_format', 'json', filePath], { windowsHide: true });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { if (stderr.length < 4000) stderr += chunk; });
    child.on('error', (error) => resolve({ fingerprint: sourceFingerprint, error: { code: 'probe_unavailable', message: error.message } }));
    child.on('close', async (code) => {
        let result;
        try { result = code === 0 ? normalize(JSON.parse(stdout), sourceFingerprint) : { fingerprint: sourceFingerprint, error: { code: 'probe_failed', message: stderr.trim() || `ffprobe exited ${code}` } }; }
        catch (error) { result = { fingerprint: sourceFingerprint, error: { code: 'invalid_probe_output', message: error.message } }; }
        await fs.mkdir(cacheDir, { recursive: true });
        await fs.writeFile(path.join(cacheDir, `${sourceFingerprint}.json.tmp`), JSON.stringify(result, null, 2));
        await fs.rename(path.join(cacheDir, `${sourceFingerprint}.json.tmp`), path.join(cacheDir, `${sourceFingerprint}.json`));
        resolve(result);
    });
});

const drain = () => {
    while (running < 2 && queue.length) {
        const job = queue.shift(); running += 1;
        run(job.filePath, job.key).then(job.resolve).finally(() => { running -= 1; pending.delete(job.key); drain(); });
    }
};

const probe = async (filePath) => {
    const key = await fingerprint(filePath);
    try { return JSON.parse(await fs.readFile(path.join(cacheDir, `${key}.json`), 'utf8')); } catch { /* cache miss */ }
    if (pending.has(key)) return pending.get(key);
    const promise = new Promise((resolve) => { queue.push({ filePath, key, resolve }); drain(); });
    pending.set(key, promise);
    return promise;
};

const extractSubtitle = async (filePath, streamIndex) => {
    const metadata = await probe(filePath);
    const track = metadata.subtitles?.find((entry) => entry.index === streamIndex);
    if (!track || !track.supported) return null;
    const dir = path.join(cacheDir, metadata.fingerprint, 'subtitles'); const target = path.join(dir, `${streamIndex}.vtt`);
    try { await fs.access(target); return target; } catch { /* extract on demand */ }
    await fs.mkdir(dir, { recursive: true });
    const temp = `${target}.tmp`;
    await new Promise((resolve, reject) => {
        const child = spawn(process.env.FFMPEG_PATH || ffmpegStatic, ['-y', '-v', 'error', '-i', filePath, '-map', `0:${streamIndex}`, '-f', 'webvtt', temp], { windowsHide: true });
        let stderr = ''; child.stderr.on('data', (chunk) => { stderr += chunk; }); child.on('error', reject);
        child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr.trim() || `subtitle extraction exited ${code}`)));
    });
    await fs.rename(temp, target); return target;
};

module.exports = { binary, fingerprint, probe, normalize, extractSubtitle };
