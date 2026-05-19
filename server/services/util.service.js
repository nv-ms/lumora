const path = require('node:path');

const mime = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.webm': 'video/webm',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv'
};

const utilService = {
    mime,
    videoExts: new Set(Object.keys(mime)),
    imageExts: new Set(['.jpg', '.jpeg', '.png', '.webp']),
    norm: (value) => path.resolve(value).replace(/[\\/]+/g, '/').toLowerCase(),
    hue: (seed) => {
        let hash = 0;
        for (let idx = 0; idx < seed.length; idx += 1) {
            hash = (hash << 5) - hash + seed.charCodeAt(idx);
        }
        return String(Math.abs(hash) % 360);
    },
    subtitleLang: (fileName) => {
        const lower = fileName.toLowerCase();
        if (lower.includes('.en.')) return 'en';
        if (lower.includes('.es.')) return 'es';
        if (lower.includes('.fr.')) return 'fr';
        return 'und';
    },
    parseEpisode: (fileName) => {
        const match = /S(\d{1,2})E(\d{1,2})/i.exec(fileName);
        if (!match) return null;
        return { season: Number(match[1]), episode: Number(match[2]) };
    },
    srtToVtt: (srt) => {
        const clean = srt.replace(/\r/g, '').trim();
        const blocks = clean.split(/\n\n+/);
        const cues = blocks
            .map((block) => {
                const lines = block.split('\n');
                if (!lines.length) return null;
                const timeLine = lines[0].includes('-->') ? lines[0] : lines[1];
                if (!timeLine || !timeLine.includes('-->')) return null;
                const [startRaw, endRaw] = timeLine.split('-->').map((entry) => entry.trim());
                const textIndex = lines[0].includes('-->') ? 1 : 2;
                const text = lines.slice(textIndex).join('\n').trim();
                if (!text) return null;
                return `${startRaw.replace(',', '.')} --> ${endRaw.replace(',', '.')}\n${text
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')}`;
            })
            .filter(Boolean);
        return `WEBVTT\n\n${cues.join('\n\n')}\n`;
    }
};

module.exports = utilService;