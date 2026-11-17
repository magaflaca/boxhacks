import { createServer } from 'node:http';
import { createContainer } from './container.js';
import { config } from './core/config.js';
import { createDrive } from './storage/drive.js';

const container = createContainer({ config, createDrive });
await container.start();

const server = createServer(container.app);
server.requestTimeout = 0;
server.listen(config.port, config.host, () => {
  const backend = config.drive ? `Drive (${config.drive.folderName})` : 'solo disco local';
  console.log(`boxhacks en http://${config.host}:${config.port} - almacen: ${backend}`);
});

function shutdown() {
  server.close(() => {
    container.stop();
    process.exit(0);
  });
  server.closeIdleConnections();
  setTimeout(() => process.exit(0), 10_000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
