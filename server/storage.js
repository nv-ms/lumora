const path = require('node:path');

const root = path.resolve(__dirname, 'data');

module.exports = (...segments) => path.join(root, ...segments);
