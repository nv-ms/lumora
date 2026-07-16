const { spawn } = require('node:child_process');
const renditionService = require('./rendition.service');
const probeService = require('./media-probe.service');

let result = { ok: false, checked: false, ffmpegPath: renditionService.binary(), ffprobePath: probeService.binary(), capabilities: {} };

const output = (binary, args) => new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true }); let text = '';
    child.stdout.on('data', (chunk) => { text += chunk; }); child.stderr.on('data', (chunk) => { text += chunk; });
    child.on('error', reject); child.on('close', (code) => code === 0 ? resolve(text) : reject(new Error(`${binary} exited ${code}`)));
});
const check = async () => {
    try {
        const [encoders, formats, filters, probeVersion] = await Promise.all([
            output(renditionService.binary(), ['-hide_banner', '-encoders']), output(renditionService.binary(), ['-hide_banner', '-formats']),
            output(renditionService.binary(), ['-hide_banner', '-filters']), output(probeService.binary(), ['-version'])
        ]);
        const capabilities = { libx264: /\blibx264\b/.test(encoders), aac: /\baac\b/.test(encoders), hls: /\bDE?\s+hls\b/.test(formats), scale: /\bscale\b/.test(filters), pixelConversion: /\bformat\b/.test(filters), toneMapping: /\btonemap\b/.test(filters) && /\bzscale\b/.test(filters), ffprobe: /ffprobe version/i.test(probeVersion) };
        result = { ok: Object.values(capabilities).every(Boolean), checked: true, ffmpegPath: renditionService.binary(), ffprobePath: probeService.binary(), capabilities };
    } catch (error) { result = { ...result, checked: true, error: error.message }; }
    return result;
};

module.exports = { check, get: () => result };
