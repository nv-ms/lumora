const POLICY_VERSION = '1';

const SDR_TRANSFERS = new Set(['', 'unknown', 'bt709', 'smpte170m', 'bt470bg']);
const SAFE_PROFILES = new Set(['baseline', 'constrained baseline', 'main', 'high']);

const selectAudio = (metadata, requestedIndex) => {
    if (!metadata.audio.length) return null;
    if (requestedIndex !== undefined) return metadata.audio.find((track) => track.index === requestedIndex) || null;
    return metadata.audio.find((track) => track.default) || metadata.audio[0];
};

const safeVideo = (video) => video.codec === 'h264'
    && SAFE_PROFILES.has(video.profile.toLowerCase())
    && (!video.level || video.level <= 41)
    && video.pixelFormat === 'yuv420p'
    && video.width <= 1920 && video.height <= 1080
    && SDR_TRANSFERS.has(video.colorTransfer)
    && !video.dolbyVision;

const safeAudio = (audio) => !audio || (audio.codec === 'aac' && audio.profile.toLowerCase().includes('lc') && audio.channels <= 2);

const evaluate = (metadata, requestedIndex) => {
    if (metadata.error) return { method: 'reject', reason: metadata.error.code };
    if (!metadata.video) return { method: 'reject', reason: 'missing_video' };
    const audio = selectAudio(metadata, requestedIndex);
    if (requestedIndex !== undefined && !audio) return { method: 'reject', reason: 'audio_stream_not_found' };
    const videoOkay = safeVideo(metadata.video);
    const audioOkay = safeAudio(audio);
    if (requestedIndex !== undefined && videoOkay) return { method: 'audio-transcode', reason: 'selected_audio_stream', audio };
    const directContainer = metadata.containers.some((name) => ['mov', 'mp4', 'm4a', '3gp', '3g2', 'mj2'].includes(name));
    if (videoOkay && audioOkay && directContainer) return { method: 'direct', reason: 'browser_compatible', audio };
    if (videoOkay && audioOkay) return { method: 'remux', reason: 'container_incompatible', audio };
    if (videoOkay) return { method: 'audio-transcode', reason: 'audio_incompatible', audio };
    return { method: 'full-transcode', reason: metadata.video.hdr ? 'hdr_video' : 'video_incompatible', audio };
};

module.exports = { POLICY_VERSION, evaluate, selectAudio, safeVideo, safeAudio };
