import http from 'node:http'
import https from 'node:https'
import { randomUUID } from 'node:crypto'
import Redis from 'ioredis'
import * as Y from '@y/y'
import * as awarenessProtocol from '@y/protocols/awareness'
import {
  getYDoc,
  setContentInitializor,
  setPersistence,
  setupWSConnection,
} from '@y/websocket-server/utils'
import { WebSocketServer } from 'ws'

const HOST = process.env.HOST || '0.0.0.0'
const PORT = Number.parseInt(process.env.PORT || '1234', 10)
const REDIS_HOST = process.env.REDIS_HOST || 'redis'
const REDIS_PORT = Number.parseInt(process.env.REDIS_PORT || '6379', 10)
const REDIS_SENTINEL_MASTER = String(process.env.REDIS_SENTINEL_MASTER || '').trim()
const REDIS_SENTINEL_NODES = String(process.env.REDIS_SENTINEL_NODES || '').trim()
const REDIS_PASSWORD = String(process.env.REDIS_PASSWORD || '').trim()
const REDIS_PREFIX = process.env.YJS_REDIS_PREFIX || 'wafflebear:yjs'
const SNAPSHOT_SAVE_DELAY_MS = Number.parseInt(
  process.env.YJS_SNAPSHOT_SAVE_DELAY_MS || '150',
  10,
)
const NODE_ID = process.env.POD_NAME || process.env.HOSTNAME || randomUUID()
const BACKEND_PROTOCOL = String(process.env.BACKEND_PROTOCOL || 'http')
  .trim()
  .toLowerCase()
  .startsWith('https')
  ? 'https:'
  : 'http:'
const BACKEND_HOST = process.env.BACKEND_HOST || 'backend-app'
const BACKEND_PORT = Number.parseInt(process.env.BACKEND_PORT || '8080', 10)
const BACKEND_UPSTREAM = `${BACKEND_HOST}:${BACKEND_PORT}`
const BACKEND_CLIENT = BACKEND_PROTOCOL === 'https:' ? https : http

const REDIS_ORIGIN = Symbol('redis-origin')
const SNAPSHOT_ORIGIN = Symbol('snapshot-origin')
const REDIS_RETRY_DELAY_MS = Number.parseInt(process.env.REDIS_RETRY_DELAY_MS || '1000', 10)
let redisChannelsSubscribed = false

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const parseSentinelNodes = (rawValue) =>
  String(rawValue || '')
    .split(/[, \n\t]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, rawPort] = entry.split(':')
      return {
        host: host.trim(),
        port: Number.parseInt(rawPort || '26379', 10) || 26379,
      }
    })

const buildRedisOptions = () => {
  const sentinels = parseSentinelNodes(REDIS_SENTINEL_NODES)

  if (sentinels.length > 0 && REDIS_SENTINEL_MASTER) {
    const options = {
      sentinels,
      name: REDIS_SENTINEL_MASTER,
      role: 'master',
      maxRetriesPerRequest: null,
      retryStrategy: (times) => Math.min(times * 500, 5000),
      sentinelRetryStrategy: (times) => Math.min(times * 500, 5000),
    }

    if (REDIS_PASSWORD) {
      options.password = REDIS_PASSWORD
    }

    return options
  }

  const options = {
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null,
    retryStrategy: (times) => Math.min(times * 500, 5000),
  }

  if (REDIS_PASSWORD) {
    options.password = REDIS_PASSWORD
  }

  return options
}

const createRedisClient = () => new Redis(buildRedisOptions())

const redisPub = createRedisClient()
const redisSub = createRedisClient()

const attachRedisEventLogging = (client, label) => {
  client.on('error', (error) => {
    console.error(`[REDIS:${label}]`, error)
  })

  client.on('close', () => {
    if (label === 'sub') {
      redisChannelsSubscribed = false
    }
  })

  client.on('end', () => {
    if (label === 'sub') {
      redisChannelsSubscribed = false
    }
  })

  client.on('reconnecting', () => {
    if (label === 'sub') {
      redisChannelsSubscribed = false
    }
  })
}

attachRedisEventLogging(redisPub, 'pub')
attachRedisEventLogging(redisSub, 'sub')

const docStates = new Map()

const updateChannel = (docName) => `${REDIS_PREFIX}:update:${encodeURIComponent(docName)}`
const awarenessChannel = (docName) => `${REDIS_PREFIX}:awareness:${encodeURIComponent(docName)}`
const snapshotKey = (docName) => `${REDIS_PREFIX}:snapshot:${encodeURIComponent(docName)}`

const normalizeDocName = (rawValue) => {
  const decoded = decodeURIComponent(String(rawValue || '').trim())
  const normalized = decoded
    .replace(/^\/+|\/+$/g, '')
    .replace(/^wss(?:\/|$)/, '')
  return normalized || 'default'
}

const isRealtimeProxyPath = (pathname) =>
  pathname.startsWith('/api/sse') || pathname.startsWith('/api/ws-stomp')

// Backend app is mounted under the /api context path, so keep the original path intact
// when proxying realtime HTTP and websocket upgrade traffic.
const rewriteProxyPath = (pathname, search = '') => `${pathname}${search}`

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
])

const sanitizeHeaders = (headers) =>
  Object.fromEntries(
    Object.entries(headers || {}).filter(([name]) => !HOP_BY_HOP_HEADERS.has(name.toLowerCase())),
  )

const buildUpgradeResponseHeaders = (headers, req) => {
  const responseHeaders = sanitizeHeaders(headers)
  // WebSocket handshakes still need Upgrade/Connection on the 101 response,
  // even though we strip hop-by-hop headers for normal HTTP proxying.
  responseHeaders.connection = headers?.connection || 'Upgrade'
  responseHeaders.upgrade = headers?.upgrade || req?.headers?.upgrade || 'websocket'
  return responseHeaders
}

const appendForwardedFor = (existingValue, remoteAddress) => {
  if (!remoteAddress) {
    return existingValue
  }

  if (!existingValue) {
    return remoteAddress
  }

  return `${existingValue}, ${remoteAddress}`
}

const buildProxyHeaders = (req, { upgrade = false } = {}) => {
  const headers = { ...req.headers }
  headers.host = BACKEND_UPSTREAM
  headers['x-forwarded-host'] = req.headers.host || BACKEND_UPSTREAM
  headers['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'http'
  headers['x-forwarded-for'] = appendForwardedFor(
    req.headers['x-forwarded-for'],
    req.socket?.remoteAddress,
  )

  if (upgrade) {
    headers.connection = 'Upgrade'
  } else {
    delete headers.connection
    delete headers.upgrade
  }

  return headers
}

const proxyHttpRequest = (req, res, upstreamPath) => {
  const proxyReq = BACKEND_CLIENT.request(
    {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      method: req.method,
      path: upstreamPath,
      headers: buildProxyHeaders(req),
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, sanitizeHeaders(proxyRes.headers))
      proxyRes.pipe(res)
    },
  )

  proxyReq.on('error', (error) => {
    console.error('[REALTIME] HTTP proxy failed', error)
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' })
    }
    res.end('Realtime proxy upstream unavailable')
  })

  req.on('aborted', () => proxyReq.destroy())
  res.on('close', () => proxyReq.destroy())

  req.pipe(proxyReq)
}

const proxyUpgradeRequest = (req, socket, head, upstreamPath) => {
  const proxyReq = BACKEND_CLIENT.request(
    {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      method: req.method,
      path: upstreamPath,
      headers: buildProxyHeaders(req, { upgrade: true }),
    },
  )

  proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
    const statusLine = `HTTP/1.1 ${proxyRes.statusCode || 101} ${proxyRes.statusMessage || 'Switching Protocols'}`
    const headerLines = Object.entries(buildUpgradeResponseHeaders(proxyRes.headers, req)).flatMap(
      ([name, value]) =>
        Array.isArray(value) ? value.map((item) => `${name}: ${item}`) : `${name}: ${value}`,
    )

    socket.write(`${statusLine}\r\n${headerLines.join('\r\n')}\r\n\r\n`)

    if (proxyHead && proxyHead.length > 0) {
      socket.write(proxyHead)
    }

    if (head && head.length > 0) {
      proxySocket.write(head)
    }

    proxySocket.pipe(socket).pipe(proxySocket)
  })

  proxyReq.on('response', (proxyRes) => {
    console.error('[REALTIME] expected websocket upgrade but received HTTP response', proxyRes.statusCode)
    socket.destroy()
  })

  proxyReq.on('error', (error) => {
    console.error('[REALTIME] websocket proxy failed', error)
    socket.destroy()
  })

  proxyReq.end()
}

const ensureState = (docName, doc) => {
  let state = docStates.get(docName)
  if (!state) {
    state = {
      docName,
      doc,
      ready: false,
      readyPromise: null,
      snapshotTimer: null,
      pendingMessages: [],
      docUpdateHandler: null,
      awarenessUpdateHandler: null,
      listenersAttached: false,
    }
    docStates.set(docName, state)
  } else {
    state.doc = doc
  }
  return state
}

const serializeEnvelope = (docName, kind, data) => ({
  sourceNode: NODE_ID,
  docName,
  kind,
  data: Buffer.from(data).toString('base64'),
})

const publishEnvelope = async (docName, kind, data) => {
  await redisPub.publish(
    kind === 'awareness' ? awarenessChannel(docName) : updateChannel(docName),
    JSON.stringify(serializeEnvelope(docName, kind, data)),
  )
}

const persistSnapshot = async (state) => {
  if (!state?.doc || !state.doc.name) {
    return
  }

  const encoded = Y.encodeStateAsUpdate(state.doc)
  await redisPub.set(snapshotKey(state.doc.name), Buffer.from(encoded))
}

const scheduleSnapshotSave = (state) => {
  if (!state?.doc || !state.doc.name) {
    return
  }

  if (state.snapshotTimer) {
    clearTimeout(state.snapshotTimer)
  }

  state.snapshotTimer = setTimeout(async () => {
    state.snapshotTimer = null
    try {
      await persistSnapshot(state)
    } catch (error) {
      console.error('[YJS] snapshot save failed', error)
    }
  }, SNAPSHOT_SAVE_DELAY_MS)
}

const attachListeners = (state) => {
  if (!state?.doc || state.listenersAttached) {
    return
  }

  state.docUpdateHandler = (update, origin) => {
    if (origin !== SNAPSHOT_ORIGIN) {
      scheduleSnapshotSave(state)
    }

    if (origin === SNAPSHOT_ORIGIN || origin === REDIS_ORIGIN) {
      return
    }

    void publishEnvelope(state.docName, 'update', update).catch((error) => {
      console.error('[YJS] failed to publish update', error)
    })
  }

  state.awarenessUpdateHandler = ({ added, updated, removed }, origin) => {
    if (origin === SNAPSHOT_ORIGIN || origin === REDIS_ORIGIN) {
      return
    }

    const changedClients = added.concat(updated, removed)
    if (changedClients.length === 0) {
      return
    }

    const encoded = awarenessProtocol.encodeAwarenessUpdate(state.doc.awareness, changedClients)
    void publishEnvelope(state.docName, 'awareness', encoded).catch((error) => {
      console.error('[YJS] failed to publish awareness', error)
    })
  }

  state.doc.on('update', state.docUpdateHandler)
  state.doc.awareness.on('update', state.awarenessUpdateHandler)
  state.listenersAttached = true
}

const applyRedisMessage = (state, envelope) => {
  if (!state?.doc || !envelope) {
    return
  }

  if (envelope.sourceNode === NODE_ID) {
    return
  }

  const payload = new Uint8Array(Buffer.from(envelope.data || '', 'base64'))

  if (envelope.kind === 'awareness') {
    awarenessProtocol.applyAwarenessUpdate(state.doc.awareness, payload, REDIS_ORIGIN)
    return
  }

  Y.applyUpdate(state.doc, payload, REDIS_ORIGIN)
}

const flushPendingMessages = (state) => {
  if (!state?.pendingMessages?.length) {
    return
  }

  const pending = state.pendingMessages.splice(0, state.pendingMessages.length)
  for (const envelope of pending) {
    applyRedisMessage(state, envelope)
  }
}

setContentInitializor(async (doc) => {
  const state = ensureState(doc.name, doc)
  if (state.readyPromise) {
    return state.readyPromise
  }

  state.readyPromise = (async () => {
    try {
      attachListeners(state)

      const snapshot = await redisPub.getBuffer(snapshotKey(doc.name))
      if (snapshot && snapshot.length > 0) {
        Y.applyUpdate(doc, new Uint8Array(snapshot), SNAPSHOT_ORIGIN)
      }

      if (state.pendingMessages.length > 0) {
        flushPendingMessages(state)
      }

      state.ready = true
    } catch (error) {
      console.error(`[YJS] initialization failed for ${doc.name}`, error)
      throw error
    }
  })()

  return state.readyPromise
})

setPersistence({
  bindState: (docName, doc) => {
    ensureState(docName, doc)
  },
  writeState: async (docName, doc) => {
    const state = docStates.get(docName) || ensureState(docName, doc)

    if (state.snapshotTimer) {
      clearTimeout(state.snapshotTimer)
      state.snapshotTimer = null
    }

    if (doc) {
      state.doc = doc
    }

    try {
      if (state.doc) {
        await persistSnapshot(state)
      }
    } finally {
      if (state.listenersAttached && state.docUpdateHandler) {
        state.doc.off('update', state.docUpdateHandler)
      }
      if (state.listenersAttached && state.awarenessUpdateHandler && state.doc?.awareness) {
        state.doc.awareness.off('update', state.awarenessUpdateHandler)
      }
      state.listenersAttached = false
      state.docUpdateHandler = null
      state.awarenessUpdateHandler = null
      state.pendingMessages = []
      state.ready = false
      state.readyPromise = null
      docStates.delete(docName)
    }
  },
})

redisSub.on('pmessageBuffer', (pattern, channel, message) => {
  try {
    const channelName = channel.toString('utf8')
    const rawDocName = channelName.slice(channelName.lastIndexOf(':') + 1)
    const docName = normalizeDocName(rawDocName)
    const state = docStates.get(docName)
    if (!state) {
      return
    }

    const envelope = JSON.parse(message.toString('utf8'))
    if (envelope.sourceNode === NODE_ID) {
      return
    }

    if (!state.ready) {
      state.pendingMessages.push(envelope)
      return
    }

    applyRedisMessage(state, envelope)
  } catch (error) {
    console.error('[YJS] failed to handle redis message', error)
  }
})

const subscribeToRedisChannels = async () => {
  while (true) {
    try {
      await redisSub.psubscribe(
        `${REDIS_PREFIX}:update:*`,
        `${REDIS_PREFIX}:awareness:*`,
      )
      redisChannelsSubscribed = true
      console.log('[REDIS:sub] subscribed to YJS channels')
      return
    } catch (error) {
      console.error('[REDIS:sub] subscribe failed', error)
      await delay(REDIS_RETRY_DELAY_MS)
    }
  }
}

const handleConnection = async (ws, req) => {
  const docName = normalizeDocName((req.url || '').slice(1).split('?')[0])
  const doc = getYDoc(docName, true)

  try {
    await doc.whenInitialized
    setupWSConnection(ws, req, { docName, gc: true })
  } catch (error) {
    console.error(`[YJS] failed to initialize doc ${docName}`, error)
    try {
      ws.close()
    } catch (closeError) {
      console.error('[YJS] websocket close failed', closeError)
    }
  }
}

const isRedisReady = () =>
  redisPub.status === 'ready' &&
  redisSub.status === 'ready' &&
  redisChannelsSubscribed

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url || '/', 'http://localhost')

  if (requestUrl.pathname === '/livez') {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('ok')
    return
  }

  if (requestUrl.pathname === '/readyz') {
    const statusCode = isRedisReady() ? 200 : 503
    res.writeHead(statusCode, { 'Content-Type': 'text/plain' })
    res.end(statusCode === 200 ? 'ready' : 'redis not ready')
    return
  }

  if (isRealtimeProxyPath(requestUrl.pathname)) {
    proxyHttpRequest(req, res, rewriteProxyPath(requestUrl.pathname, requestUrl.search))
    return
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('WaffleBear realtime gateway')
})

const wss = new WebSocketServer({ noServer: true })

wss.on('connection', (ws, req) => {
  void handleConnection(ws, req)
})

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url || '/', 'http://localhost')

  if (requestUrl.pathname.startsWith('/api/ws-stomp')) {
    proxyUpgradeRequest(request, socket, head, rewriteProxyPath(requestUrl.pathname, requestUrl.search))
    return
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request)
  })
})

void subscribeToRedisChannels()

server.listen(PORT, HOST, () => {
  console.log(`WaffleBear realtime gateway listening on ${HOST}:${PORT}`)
})
