const path = require('node:path');
const fs = require('node:fs/promises');
const bridgeService = require('../services/bridge.service.cjs');

const mediaController = {
  async getFiles(req, res, next) {
    try {
      const { filesystemService } = await bridgeService.getModules();
      return res.status(200).json({ files: await filesystemService.listFilesFromSources(req.query.mode || 'video') });
    } catch (error) { return next(error); }
  },

  async uploadFile(req, res, next) {
    try {
      const { httpService } = await bridgeService.getModules();
      const category = req.query.category || 'media';
      const valid = new Set(['media', 'subtitle', 'image', 'trailer']);
      if (!valid.has(category)) return res.status(400).json({ error: 'Invalid upload category' });
      const { fileName, fileBuffer } = await httpService.readMultipartFile(req);
      const outDir = path.resolve(`data/uploads/${category}`);
      await fs.mkdir(outDir, { recursive: true });
      const outPath = httpService.ensureWithin(outDir, `${Date.now()}-${fileName}`);
      await fs.writeFile(outPath, fileBuffer);
      return res.status(200).json({ path: outPath, fileName });
    } catch (error) { return next(error); }
  },

  async getFolders(req, res, next) {
    try {
      const { filesystemService } = await bridgeService.getModules();
      return res.status(200).json({ folders: await filesystemService.listFoldersFromSources() });
    } catch (error) { return next(error); }
  },

  async getFsRoots(req, res, next) {
    try {
      const { filesystemService } = await bridgeService.getModules();
      return res.status(200).json({ roots: await filesystemService.getSystemRoots() });
    } catch (error) { return next(error); }
  },

  async getFsList(req, res, next) {
    try {
      const { filesystemService } = await bridgeService.getModules();
      if (!req.query.path) return res.status(400).json({ error: 'path is required' });
      return res.status(200).json(await filesystemService.listPathEntries(req.query.path, req.query.mode || 'all'));
    } catch (error) { return next(error); }
  },

  async streamMedia(req, res, next) {
    try {
      const { catalogService, httpService } = await bridgeService.getModules();
      const media = await catalogService.ensureCachedMedia(req.params.id);
      if (!media) return res.status(404).json({ error: 'Media not found' });
      await httpService.streamMedia(req, res, media);
      return undefined;
    } catch (error) { return next(error); }
  },
};

module.exports = mediaController;
