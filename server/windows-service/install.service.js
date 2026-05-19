const path = require('node:path');
const { Service } = require('node-windows');

const svc = new Service({
    name: 'Lumora Media Server',
    description: 'Lumora local media streaming server',
    script: path.resolve(__dirname, '..', 'app.js'),
    workingDirectory: path.resolve(__dirname, '..')
});

svc.on('install', () => svc.start());
svc.install();

