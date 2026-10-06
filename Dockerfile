FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node src ./src
COPY --chown=node:node views ./views
COPY --chown=node:node public ./public

RUN mkdir -p data logs && chown node:node data logs

ENV NODE_ENV=production
ENV PORT=8083
ENV TZ=Asia/Bangkok
USER node

EXPOSE 8083

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8083) + '/healthz', { signal: AbortSignal.timeout(3000) }).then(res => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
