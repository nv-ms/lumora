const express = require('express');
const path = require('node:path');
const fs = require('node:fs');

const healthRoutes = require('./routes/health.routes');
const mediaRoutes = require('./routes/media.routes');
const libraryRoutes = require('./routes/library.routes');
const assetRoutes = require('./routes/asset.routes');
const transcoderHealth = require('./services/transcoder-health.service');
const renditionService = require('./services/rendition.service');

const app = express();
const port = Number(process.env.PORT || 8787);
const distDir = path.resolve(__dirname, '../dist');
const hasDist = fs.existsSync(path.join(distDir, 'index.html'));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
    res.setHeader('Access-Control-Expose-Headers', 'Accept-Ranges, Content-Length, Content-Range');
    if (req.method === 'OPTIONS') return res.status(204).end();
    return next();
});

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

app.use('/api', healthRoutes);
app.use('/api', mediaRoutes);
app.use('/api', libraryRoutes);
app.use('/api', assetRoutes);

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
});

if (hasDist) {
    app.use(express.static(distDir));
    app.get(/^(?!\/api).*/, (req, res, next) => {
        const acceptsHtml = req.accepts('html');
        const isGetRequest = req.method === 'GET';
        const hasFileExtension = path.extname(req.path) !== '';

        if (!isGetRequest || !acceptsHtml || hasFileExtension) {
            return next();
        }

        return res.sendFile(path.join(distDir, 'index.html'));
    });
}

app.use((error, req, res, next) => {
    res.status(500).json({ error: error.message || 'Server error' });
});

app.listen(port, () => {
    console.log(`Media server listening on http://localhost:${port}`);
});

transcoderHealth.check().then((health) => {
    if (!health.ok) console.error('Playback capabilities unavailable', health);
});
process.once('SIGINT', () => { renditionService.shutdown(); process.exit(0); });
process.once('SIGTERM', () => { renditionService.shutdown(); process.exit(0); });
