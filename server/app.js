const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { WebSocket, WebSocketServer } = require('ws');

const healthRoutes = require('./routes/health.routes');
const mediaRoutes = require('./routes/media.routes');
const libraryRoutes = require('./routes/library.routes');
const assetRoutes = require('./routes/asset.routes');
const transcoderHealth = require('./services/transcoder-health.service');
const renditionService = require('./services/rendition.service');

const app = express();
const port = Number(process.env.PORT || 8787);
const frontendDir = path.resolve(__dirname, 'frontend');

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

app.use(express.static(frontendDir));
app.get(/^(?!\/api).*/, (req, res, next) => {
    const acceptsHtml = req.accepts('html');
    const isGetRequest = req.method === 'GET';
    const hasFileExtension = path.extname(req.path) !== '';

    if (!isGetRequest || !acceptsHtml || hasFileExtension) {
        return next();
    }

    return res.sendFile(path.join(frontendDir, 'index.html'));
});

app.use((error, req, res, next) => {
    res.status(500).json({ error: error.message || 'Server error' });
});

const server = http.createServer(app);
const sockets = new WebSocketServer({ server, path: '/ws' });

sockets.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'status', ok: true }));
    const heartbeat = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping', time: new Date().toISOString() }));
        }
    }, 15000);
    socket.on('close', () => clearInterval(heartbeat));
});

server.listen(port, () => {
    console.log(`Media server listening on http://localhost:${port}`);
});

transcoderHealth.check().then((health) => {
    if (!health.ok) console.error('Playback capabilities unavailable', health);
});
process.once('SIGINT', () => { sockets.close(); renditionService.shutdown(); process.exit(0); });
process.once('SIGTERM', () => { sockets.close(); renditionService.shutdown(); process.exit(0); });
