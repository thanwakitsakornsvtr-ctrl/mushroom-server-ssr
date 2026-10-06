const path = require('node:path');
require('dotenv').config();

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const deviceApiKey = required('DEVICE_API_KEY', isProduction ? undefined : 'dev-local-key').trim();
if (!deviceApiKey) {
  throw new Error('DEVICE_API_KEY must not be empty');
}
if (isProduction && ['dev-local-key', 'change-me-to-a-long-random-string'].includes(deviceApiKey)) {
  throw new Error('DEVICE_API_KEY must be set to a non-placeholder value in production');
}

// A numeric value is a hop count; an address/subnet list is also supported.
// Never trust every proxy: that allows clients to forge rate-limit identities.
const trustProxyValue = (process.env.TRUST_PROXY || 'false').trim();
if (trustProxyValue === 'true') {
  throw new Error('TRUST_PROXY must be false, a hop count, or trusted addresses/subnets');
}
const trustProxy = trustProxyValue === 'false'
  ? false
  : /^\d+$/.test(trustProxyValue)
    ? Number(trustProxyValue)
    : trustProxyValue.split(',').map((value) => value.trim()).filter(Boolean);

const dbPath = process.env.DB_PATH
  || (process.env.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'mushroom.db')
    : './data/mushroom.db');

module.exports = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 8083,
  deviceApiKey,
  trustProxy,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  // ใช้สร้าง canonical / og:url / ลิงก์รูปแชร์ — ตั้งเป็นโดเมนจริงตอน deploy
  siteUrl: (process.env.SITE_URL || '').replace(/\/+$/, ''),
  dbPath: path.resolve(process.cwd(), dbPath),
  dataRetentionDays: Number(process.env.DATA_RETENTION_DAYS) || 30,
  deviceOfflineSeconds: Number(process.env.DEVICE_OFFLINE_SECONDS) || 60,
  // ESP32 รายงานสถานะปลั๊กทุก 30 วิ — เงียบเกินนี้ถือว่าไม่ทราบสถานะจริงของปลั๊กแล้ว
  readingBroadcastMs: Number(process.env.READING_BROADCAST_MS) || 5000,
  plugStaleSeconds: Number(process.env.PLUG_STALE_SECONDS) || 90,
  logLevel: process.env.LOG_LEVEL || 'info',
  logDir: path.resolve(process.cwd(), 'logs'),
};
