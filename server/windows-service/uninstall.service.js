const { Service } = require('node-windows');

const svc = new Service({
    name: 'Lumora Media Server',
    script: ''
});

svc.uninstall();

