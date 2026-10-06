# Deploy server-ssr บน VPS

เป้าหมาย: `https://mushroom.kitsakorn.com` → Nginx บน VPS → `127.0.0.1:8083` → Express ใน Docker

ใช้แอปหนึ่ง instance เพราะ SQLite และ SSE hub อยู่ใน process เดียวกัน ไม่ต้องติดตั้ง Node.js หรือ SQLite บน VPS

ใช้ `docker-compose.yml` เป็นไฟล์หลักสำหรับทั้ง local และ VPS

## 1. เตรียม VPS และ DNS

- ติดตั้ง Docker Engine และ Compose plugin ตาม [คู่มือ Docker สำหรับ Ubuntu](https://docs.docker.com/engine/install/ubuntu/)
- ตั้ง DNS A ของ `mushroom.kitsakorn.com` ให้ชี้ public IPv4 ของ VPS; เพิ่ม AAAA เฉพาะเมื่อ VPS และ Nginx รองรับ IPv6 แล้ว
- เปิด inbound TCP 80/443 และพอร์ต SSH ที่ใช้งาน พอร์ต 8083 ใช้ภายในเครื่องผ่าน Nginx
- นำ repo มาวางใน `/opt/server-ssr` หรือ directory ที่ต้องการ และเข้า directory นั้น

ทุกคำสั่งด้านล่างให้รันจาก root ของโปรเจ็ค และใช้ชื่อ directory/project เดิมเมื่ออัปเดตเพื่อให้ใช้ volumes เดิม

## 2. ตั้ง environment

หากยังไม่มี `.env`:

```bash
cp .env.example .env
chmod 600 .env
```

แก้ `.env` ให้มีค่าหลัก:

```dotenv
DEVICE_API_KEY=<คีย์จริงที่ตรงกับ ESP32>
SITE_URL=https://mushroom.kitsakorn.com
CORS_ORIGIN=https://mushroom.kitsakorn.com
BIND_ADDRESS=127.0.0.1
TRUST_PROXY=1
```

ถ้าเริ่มติดตั้งใหม่ สร้างคีย์ด้วย `openssl rand -hex 32` แล้วใส่ใน `.env` และ firmware ให้ตรงกัน ถ้ามี ESP32 ใช้งานอยู่ ให้ใช้คีย์เดิม แอปจะปฏิเสธค่าว่างและ placeholder ใน production

ค่า `FARM_*` ใน template เป็นข้อมูลตัวอย่าง ให้เปลี่ยนเป็นข้อมูลฟาร์มจริงก่อนเปิดเว็บไซต์สาธารณะ หรือเว้นช่องนั้นว่างเพื่อซ่อนช่องทางติดต่อ

Compose กำหนด `NODE_ENV=production`, `PORT=8083` และ `DB_PATH=/app/data/mushroom.db` เอง ดังนั้นค่า PORT/DB_PATH เดิมใน `.env` จะไม่เปลี่ยนพอร์ตหรือที่เก็บข้อมูลของ container

## 3. Build และเริ่มแอป

```bash
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
curl --fail http://127.0.0.1:8083/healthz
```

รอให้ container แสดง `healthy` แล้วเปิด `http://localhost:8083/dashboard` เพื่อลองในเครื่อง local

เครื่องที่มี Compose รุ่นเก่าให้ใช้ `docker-compose -f docker-compose.yml` แทน `docker compose -f docker-compose.yml` ทุกคำสั่ง

เมื่ออัปเดต environment ด้วย Compose รุ่นเก่า ให้สร้าง container ใหม่ด้วยสองคำสั่งนี้ โดย named volumes ยังอยู่:

```bash
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml up -d --build
```

ค่าเริ่มต้น bind เฉพาะ localhost หากต้องการทดลองจากเครื่องอื่นใน LAN ให้ตั้ง `BIND_ADDRESS=0.0.0.0` และ `TRUST_PROXY=false` แล้วรัน `up -d` อีกครั้ง เมื่อติดตั้งหลัง Nginx ให้กลับมาใช้ค่าตามข้อ 2

ข้อมูลใหม่เก็บใน named volumes `mushroom_data` และ `mushroom_logs` ซึ่งใช้สิทธิ์ของ user `node` แอปไม่ต้องรันเป็น root และ volumes จะคงอยู่เมื่อ restart, rebuild หรือ `down` ห้ามใช้ `down -v` ถ้าต้องการเก็บข้อมูล

การเริ่ม Compose ครั้งแรกสร้างฐานข้อมูลใหม่ ไม่ได้นำ `./data/mushroom.db` เดิมเข้าไปเอง หากต้องการย้ายประวัติเดิม ดูข้อ 6

## 4. ติดตั้ง Nginx และ HTTPS

ตัวอย่างสำหรับ Ubuntu/Debian ที่ใช้ Nginx บน host:

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
sudo cp deploy/nginx/mushroom.kitsakorn.com.conf /etc/nginx/sites-available/mushroom.kitsakorn.com
sudo ln -s /etc/nginx/sites-available/mushroom.kitsakorn.com /etc/nginx/sites-enabled/mushroom.kitsakorn.com
sudo nginx -t
sudo systemctl reload nginx
```

ถ้า symlink หรือ virtual host ของโดเมนนี้มีอยู่แล้ว ให้ปรับไฟล์เดิมแทนการสร้างซ้ำ ไม่ต้องลบเว็บไซต์อื่นใน VPS

หลัง DNS ชี้มายัง VPS และ HTTP เข้าถึงได้แล้ว:

```bash
sudo certbot --nginx -d mushroom.kitsakorn.com --redirect
sudo certbot renew --dry-run
curl --fail https://mushroom.kitsakorn.com/healthz
curl --fail --no-buffer --max-time 20 https://mushroom.kitsakorn.com/api/sensors/events
```

คำสั่ง SSE ควรได้รับ `: heartbeat` ภายใน 15 วินาที และจบด้วย curl exit code 28 เมื่อครบเวลาที่กำหนด ซึ่งเป็นผลปกติของการทดสอบ stream นี้

ไฟล์ Nginx ปิด buffering สำหรับ SSE และแทนที่ forwarded headers ก่อนส่งต่อ แอปตั้ง `TRUST_PROXY=1` เพื่อให้ rate limit แยก IP ผู้ใช้จริงได้ การตั้งค่านี้อิง topology ที่มี Nginx หนึ่งตัวตามภาพด้านบน หากเพิ่ม CDN/load balancer ให้ปรับ real IP และ proxy trust ให้ตรงกับระบบนั้น

ESP32 ส่งข้อมูลไปยัง:

```text
https://mushroom.kitsakorn.com/api/sensors/readings
https://mushroom.kitsakorn.com/api/system/decisions
https://mushroom.kitsakorn.com/api/system/plugs
```

ทุก POST ต้องมี `Content-Type: application/json` และ `X-API-Key` ที่ตรงกับ `.env` ฝั่ง firmware ต้องรองรับ HTTPS และตรวจใบรับรองของ server

## 5. อัปเดตและดูสถานะ

```bash
git pull
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs --tail=100 -f app
```

เมื่อหยุดแอป ระบบปิด SSE, scheduler และ SQLite ก่อนออก เพื่อให้ restart ได้ภายใน grace period แอป restart อัตโนมัติเมื่อ process ล้มและเมื่อ Docker เริ่มใหม่; healthcheck ใช้แสดงสถานะ ไม่ได้ restart container ที่ unhealthy โดยอัตโนมัติ

## 6. สำรองและย้ายฐานข้อมูล

การสำรองแบบง่ายนี้หยุดแอปชั่วคราว เพื่อให้ SQLite ปิดและ checkpoint WAL ก่อนคัดลอก:

```bash
mkdir -p backups
docker compose -f docker-compose.yml stop app
docker compose -f docker-compose.yml cp app:/app/data/mushroom.db "backups/mushroom-$(date +%Y%m%d-%H%M%S).db"
docker compose -f docker-compose.yml start app
```

หากคำสั่งคัดลอกล้มเหลว ให้รัน `start app` เพื่อเปิดบริการกลับก่อนตรวจปัญหา เก็บสำเนา backup ไว้อีกเครื่องด้วย

สำหรับ Compose รุ่นเก่าที่ไม่มีคำสั่ง `cp` ใช้ `docker cp` กับ container ID จาก `docker-compose -f docker-compose.yml ps -q app`

การย้ายประวัติจาก `./data/mushroom.db` ต้องหยุด Node/PM2 ตัวเดิมก่อนและสำรองฐานข้อมูลนั้นให้ครบ ห้ามคัดลอกเฉพาะไฟล์ `.db` จากฐานข้อมูลที่ยังเขียน WAL อยู่

เพื่อ restore ให้หยุด `app`, คัดลอกฐานข้อมูลที่ checkpoint แล้วลง named volume แทนไฟล์เดิมด้วยสิทธิ์ `node:node`, และเริ่มแอปกลับ หลีกเลี่ยง `docker cp` เข้าไปตรงๆ หากทำให้ไฟล์เป็น root ตัวอย่างด้านล่างเขียนไฟล์ด้วย user ของแอปและลบ sidecar เดิมหลังหยุดแอปแล้ว:

```bash
docker compose -f docker-compose.yml stop app
docker compose -f docker-compose.yml run --rm --no-deps -T app node -e '
const fs = require("node:fs");
for (const suffix of ["-wal", "-shm"]) fs.rmSync(process.env.DB_PATH + suffix, { force: true });
fs.writeFileSync(process.env.DB_PATH, fs.readFileSync(0));
' < backups/FILE_TO_RESTORE.db
docker compose -f docker-compose.yml start app
curl --fail http://127.0.0.1:8083/healthz
```

## เอกสารอ้างอิง

- [Docker Compose services](https://docs.docker.com/reference/compose-file/services/)
- [Compose environment interpolation](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)
- [Express behind proxies](https://expressjs.com/en/guide/behind-proxies/)
- [Nginx proxy buffering และ timeouts](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
