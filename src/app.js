const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const navLocals = require('./middleware/navLocals');
const site = require('./config/site');
const dashboardRoutes = require('./routes/dashboard.routes');
const sensorsRoutes = require('./routes/sensors.routes');
const healthRoutes = require('./routes/health.routes');
const systemRoutes = require('./routes/system.routes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
// static ถูก cache 1 วันใน production — ต่อ ?v= ท้าย URL ของ css/js ให้เปลี่ยนทุกครั้งที่ server
// เริ่มใหม่ (deploy) ไม่งั้น browser จะรัน dashboard.client.js ตัวเก่าค้างอยู่ได้ถึง 1 วัน
app.locals.assetVersion = Date.now().toString(36);
app.locals.site = site;

app.use(helmet({
  // The same production container is also served over HTTP at localhost:8083.
  // Nginx handles HTTPS redirects; HSTS is added only to HTTPS requests below.
  strictTransportSecurity: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      workerSrc: ["'self'", 'blob:'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null,
    },
  },
}));
const hsts = helmet.strictTransportSecurity();
app.use((req, res, next) => req.secure ? hsts(req, res, next) : next());
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
app.use(compression({
  filter: (req, res) => {
    // SSE ต้องไม่ถูกบีบอัด ไม่งั้น event ค้างใน gzip buffer ไม่ถึง browser — เช็คจาก originalUrl
    // เพราะตอนที่ filter ถูกเรียก (writeHead ใน router ที่ mount ไว้) req.path เหลือแค่ '/events'
    if (req.originalUrl.startsWith('/api/sensors/events')) return false;
    return compression.filter(req, res);
  },
}));
app.use(express.json({ limit: '32kb' }));
app.use(requestLogger);
app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: config.isProduction ? '1d' : 0 }));
// Chart.js เสิร์ฟจากเครื่องเอง ไม่พึ่ง CDN — หน้างานอาจมีแค่ LAN/เน็ตมือถือช้า
app.use('/vendor/chart.js', express.static(path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist'), { maxAge: config.isProduction ? '7d' : 0 }));
// ฟอนต์ (Noto Sans Thai + Inter) เสิร์ฟจากเครื่องเอง — ไม่พึ่ง Google Fonts ไฟล์เปลี่ยนเฉพาะตอนอัปเดตแพ็กเกจ
const fontPackages = { 'noto-sans-thai': '@fontsource-variable/noto-sans-thai', inter: '@fontsource-variable/inter' };
Object.entries(fontPackages).forEach(([name, pkg]) => {
  app.use(`/vendor/fonts/${name}`, express.static(path.join(__dirname, '..', 'node_modules', pkg, 'files'), { maxAge: config.isProduction ? '30d' : 0, immutable: config.isProduction }));
});

app.use(navLocals);

app.use('/api/sensors', sensorsRoutes);
app.use('/api/system', systemRoutes);
app.use('/healthz', healthRoutes);
app.use('/', dashboardRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
