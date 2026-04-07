# syntax=docker/dockerfile:1
FROM node:22.17.1-alpine AS frontend-build
WORKDIR /app

# 1. 패키지 파일 복사 (루트 기준 frontend 폴더 내부의 것을 복사)
COPY package.json package-lock.json ./
RUN npm ci

# 2. 나머지 소스 코드 복사 (중요: frontend 폴더 '안의 내용'을 /app으로 복사)
COPY index.html jsconfig.json vite.config.js ./
COPY public ./public
COPY src ./src

# 3. 빌드 실행
RUN npm run build

# --- 2단계: 실행 (Nginx) ---
FROM nginx:1.29-alpine AS frontend-runtime

ARG BACKEND_UPSTREAM=waffle-release-wafflebear-backend.helm-service.svc.cluster.local:8080
ARG REALTIME_UPSTREAM=waffle-release-wafflebear-websocket.helm-service.svc.cluster.local:1234

ENV BACKEND_UPSTREAM=${BACKEND_UPSTREAM}
ENV REALTIME_UPSTREAM=${REALTIME_UPSTREAM}

# 빌드된 정적 파일 복사 (보통 빌드 결과물은 dist 또는 build 폴더에 생깁니다)
# Vite/Vue라면 dist, React라면 build일 확률이 높으니 확인해 보세요.
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Nginx 설정 (기존과 동일)
COPY CI-CD/frontend-default.conf.template /etc/nginx/templates/default.conf.template

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

FROM node:22.17.1-alpine AS websocket-deps
WORKDIR /app

COPY websocket-server/package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

FROM node:22.17.1-alpine AS websocket-runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1234
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV YJS_REDIS_PREFIX=wafflebear:yjs
ENV YJS_SNAPSHOT_SAVE_DELAY_MS=150

COPY --from=websocket-deps /app/node_modules ./node_modules
COPY websocket-server/package.json ./package.json
COPY websocket-server/server.js ./server.js

EXPOSE 1234

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || '1234') + '/livez').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["npm", "start"]
