const express = require('express');

const healthRoutes = require('./routes/health.routes.cjs');
const mediaRoutes = require('./routes/media.routes.cjs');
const libraryRoutes = require('./routes/library.routes.cjs');
const assetRoutes = require('./routes/asset.routes.cjs');

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

app.use('/api', healthRoutes);
app.use('/api', mediaRoutes);
app.use('/api', libraryRoutes);
app.use('/api', assetRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error, req, res, next) => {
  res.status(500).json({ error: error.message || 'Server error' });
});

app.listen(port, () => {
  console.log(`Media server listening on http://localhost:${port}`);
});
