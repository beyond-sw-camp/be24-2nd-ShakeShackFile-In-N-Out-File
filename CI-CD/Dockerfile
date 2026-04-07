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

ARG BACKEND_UPSTREAM=backend-service:8080
ARG REALTIME_UPSTREAM=websocket-server-service:1234

# 빌드된 정적 파일 복사 (보통 빌드 결과물은 dist 또는 build 폴더에 생깁니다)
# Vite/Vue라면 dist, React라면 build일 확률이 높으니 확인해 보세요.
COPY --from=frontend-build /app/dist /usr/share/nginx/html

# Nginx 설정 (기존과 동일)
RUN printf "server {\n\
    listen 80;\n\
    charset utf-8;\n\
    underscores_in_headers on;\n\
    root /usr/share/nginx/html;\n\
    index index.html index.htm;\n\
\n\
    location ^~ /assets/ {\n\
        try_files \$uri =404;\n\
    }\n\
\n\
    location ^~ /src/ {\n\
        return 404;\n\
    }\n\
\n\
    location = /favicon.ico {\n\
        try_files \$uri =404;\n\
    }\n\
\n\
    location = /sw.js {\n\
        try_files \$uri =404;\n\
    }\n\
\n\
    location / {\n\
        try_files \$uri \$uri/ /index.html;\n\
    }\n\
\n\
    location ^~ /api/ws-stomp {\n\
        proxy_pass http://$REALTIME_UPSTREAM;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade \$http_upgrade;\n\
        proxy_set_header Connection \"upgrade\";\n\
        proxy_set_header Host \$host;\n\
        proxy_set_header X-Real-IP \$remote_addr;\n\
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto \$scheme;\n\
    }\n\
\n\
    location ^~ /api/sse {\n\
        proxy_pass http://$REALTIME_UPSTREAM;\n\
        proxy_http_version 1.1;\n\
        proxy_buffering off;\n\
        proxy_cache off;\n\
        proxy_read_timeout 3600s;\n\
        proxy_set_header Host \$host;\n\
        proxy_set_header X-Real-IP \$remote_addr;\n\
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto \$scheme;\n\
    }\n\
\n\
    location ^~ /wss {\n\
        proxy_pass http://$REALTIME_UPSTREAM;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Upgrade \$http_upgrade;\n\
        proxy_set_header Connection \"upgrade\";\n\
        proxy_set_header Host \$host;\n\
        proxy_set_header X-Real-IP \$remote_addr;\n\
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto \$scheme;\n\
    }\n\
\n\
    location = /api {\n\
        proxy_pass http://$BACKEND_UPSTREAM;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Host \$host;\n\
        proxy_set_header X-Real-IP \$remote_addr;\n\
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto \$scheme;\n\
    }\n\
\n\
    location ^~ /api/ {\n\
        proxy_pass http://$BACKEND_UPSTREAM;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header Host \$host;\n\
        proxy_set_header X-Real-IP \$remote_addr;\n\
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto \$scheme;\n\
    }\n\
}\n" > /etc/nginx/conf.d/default.conf

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
