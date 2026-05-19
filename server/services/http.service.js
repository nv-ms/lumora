const path = require('node:path');
const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const utilService = require('./util.service');

const httpService = {
    safePath: (baseDir, fileName) => {
        const safeName = path.basename(fileName).replace(/[^\w.\- ()[\]]+/g, '_');
        return path.join(baseDir, safeName);
    },

    readMultipart: async (req) => {
        const contentType = req.headers['content-type'] || '';
        const match = /boundary=(.+)$/.exec(contentType);
        if (!match) throw new Error('Invalid multipart request');
        const boundary = `--${match[1]}`;

        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString('binary');
        const parts = raw.split(boundary).filter((part) => part.includes('Content-Disposition'));
        if (!parts.length) throw new Error('No file payload found');

        const part = parts[0];
        const fileNameMatch = /filename=\"([^\"]+)\"/.exec(part);
        if (!fileNameMatch) throw new Error('No filename found');
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) throw new Error('Malformed multipart body');

        const binaryBody = part.slice(headerEnd + 4, part.lastIndexOf('\r\n'));
        return {
            fileName: fileNameMatch[1],
            fileBuffer: Buffer.from(binaryBody, 'binary')
        };
    },

    stream: async (req, res, media) => {
        const stat = await fs.stat(media.path);
        const total = stat.size;
        const range = req.headers.range;
        const contentType = utilService.mime[path.extname(media.path).toLowerCase()] || 'application/octet-stream';

        if (!range) {
            res.writeHead(200, {
                'Content-Type': contentType,
                'Content-Length': total,
                'Accept-Ranges': 'bytes',
                'Content-Disposition': `inline; filename="${media.name}"`
            });
            createReadStream(media.path).pipe(res);
            return;
        }

        const match = /bytes=(\d+)-(\d*)/.exec(range);
        if (!match) {
            res.writeHead(416, { 'Content-Range': `bytes */${total}` });
            res.end();
            return;
        }

        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : total - 1;
        if (start >= total || end >= total) {
            res.writeHead(416, { 'Content-Range': `bytes */${total}` });
            res.end();
            return;
        }

        res.writeHead(206, {
            'Content-Type': contentType,
            'Content-Length': end - start + 1,
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Disposition': `inline; filename="${media.name}"`
        });
        createReadStream(media.path, { start, end }).pipe(res);
    }
};

module.exports = httpService;
