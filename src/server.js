const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const scheduler = require('./services/scheduler');
const sseHub = require('./services/sseHub');
const db = require('./db');

const server = app.listen(config.port, () => {
  logger.info(`Mushroom dashboard server listening on port ${config.port}`, {
    env: config.nodeEnv,
  });
});

// Node's default keepAliveTimeout (5s) is shorter than the SSE heartbeat interval,
// which causes idle /api/sensors/events connections to be force-closed and reconnected
// in a loop. Raise it well above the heartbeat interval (see services/sseHub.js).
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

const schedulerTimer = scheduler.start();
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`Received ${signal}, shutting down gracefully...`);
  clearInterval(schedulerTimer);
  sseHub.close();
  server.close((err) => {
    if (err) {
      logger.error('Error during shutdown', { error: err.message });
      process.exit(1);
    }
    db.close();
    logger.info('Server closed. Bye.');
    process.exit(0);
  });
  server.closeIdleConnections();

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.stack || reason });
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { error: err.stack || err.message });
  process.exit(1);
});
