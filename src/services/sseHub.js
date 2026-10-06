const logger = require('../utils/logger');

const HEARTBEAT_MS = 15000;

class SseHub {
  constructor() {
    this.clients = new Set();
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    this.heartbeatTimer.unref();
  }

  addClient(res) {
    this.clients.add(res);
    logger.debug('SSE client connected', { count: this.clients.size });
  }

  removeClient(res) {
    this.clients.delete(res);
    logger.debug('SSE client disconnected', { count: this.clients.size });
  }

  broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const res of this.clients) {
      res.write(payload);
    }
  }

  heartbeat() {
    for (const res of this.clients) {
      res.write(': heartbeat\n\n');
    }
  }

  close() {
    clearInterval(this.heartbeatTimer);
    for (const res of this.clients) res.end();
    this.clients.clear();
  }
}

module.exports = new SseHub();
