<script setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useAuthStore } from '@/stores/useAuthStore'
import {
  getOpenHexagonAvatarSrc,
  OPEN_HEXAGON_AVATARS,
  pickOpenHexagonProfile,
} from '@/legup/openhexagon/avatarManifest'
import { useOpenHexagonSocket } from '@/legup/openhexagon/useOpenHexagonSocket'

const TAU = Math.PI * 2
const LANE_COUNT = 6
const STORAGE_KEY = 'open-hexagon-best-seconds'
const STATE_SYNC_INTERVAL_MS = 90
const DEFAULT_PLAYER_ANGLE = -Math.PI / 2

const authStore = useAuthStore()

const canvasRef = ref(null)
const surfaceRef = ref(null)
const serverClockOffsetMs = ref(0)
const frameClockMs = ref(Date.now())
const viewport = reactive({ width: 960, height: 720 })
const inputState = reactive({ left: false, right: false })
const ui = reactive({
  started: false,
  running: false,
  gameOver: false,
  survivalSeconds: 0,
  difficultyLabel: 'Calm',
})

const displayName = computed(() => {
  const rawName =
    authStore.user?.name ||
    authStore.user?.userName ||
    authStore.user?.nickname ||
    authStore.user?.email

  if (!rawName) {
    return 'Pilot'
  }

  return String(rawName).split('@')[0]
})

const localBestSeconds = ref(0)

const myUserId = computed(() => Number(authStore.user?.idx ?? 0))
const localStyle = computed(() => pickOpenHexagonProfile(myUserId.value || displayName.value.length || 1))

const lobbySocket = useOpenHexagonSocket(authStore)
const lobby = lobbySocket.lobby
const connectionState = lobbySocket.connectionState
const socketError = lobbySocket.socketError
const playerRoster = computed(() => (Array.isArray(lobby.value.players) ? lobby.value.players : []))
const matchState = computed(() => lobby.value.match ?? {})
const leaderboardEntries = computed(() =>
  Array.isArray(lobby.value.leaderboard) ? lobby.value.leaderboard : [],
)
const remotePlayers = computed(() =>
  playerRoster.value.filter((player) => Number(player.userIdx) !== myUserId.value),
)
const localRosterEntry = computed(() =>
  playerRoster.value.find((player) => Number(player.userIdx) === myUserId.value) ?? null,
)
const derivedMatchStatus = computed(() => {
  const status = matchState.value.status ?? 'LOBBY'
  const roundStartMs = parseServerTime(matchState.value.roundStartsAt)

  if (status === 'COUNTDOWN' && roundStartMs && frameClockMs.value + serverClockOffsetMs.value >= roundStartMs) {
    return 'RUNNING'
  }

  return status
})
const isLobbyPhase = computed(() => derivedMatchStatus.value === 'LOBBY')
const isCountdownPhase = computed(() => derivedMatchStatus.value === 'COUNTDOWN')
const isRunningPhase = computed(() => derivedMatchStatus.value === 'RUNNING')
const readyCount = computed(() => Number(matchState.value.readyCount ?? 0))
const playerCount = computed(() => Number(matchState.value.playerCount ?? lobby.value.onlineCount ?? 0))

const engine = {
  playerAngle: DEFAULT_PLAYER_ANGLE,
  worldRotation: 0,
  animationId: 0,
  lastFrameTime: 0,
  submittedScore: false,
  lastPresenceSyncAt: 0,
  activeRoundNumber: 0,
}

const avatarImages = new Map()

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const wrapAngle = (angle) => {
  const wrapped = angle % TAU
  return wrapped >= 0 ? wrapped : wrapped + TAU
}

const polarPoint = (centerX, centerY, radius, angle) => ({
  x: centerX + Math.cos(angle) * radius,
  y: centerY + Math.sin(angle) * radius,
})

const toRgba = (hexColor, alpha) => {
  const normalized = String(hexColor || '').replace('#', '')

  if (normalized.length !== 6) {
    return `rgba(89, 214, 255, ${alpha})`
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const getMetrics = () => {
  const minSide = Math.min(viewport.width, viewport.height)

  return {
    centerX: viewport.width / 2,
    centerY: viewport.height / 2,
    sectorAngle: TAU / LANE_COUNT,
    coreRadius: minSide * 0.11,
    playerOrbit: minSide * 0.24,
    playerSize: Math.max(11, minSide * 0.017),
    spawnRadius: minSide * 0.66,
    lanePadding: 0.06,
  }
}

const loadLocalBest = () => {
  const saved = Number(localStorage.getItem(STORAGE_KEY) || 0)
  localBestSeconds.value = Number.isFinite(saved) ? saved : 0
}

const saveLocalBest = () => {
  localStorage.setItem(STORAGE_KEY, String(localBestSeconds.value))
}

const formatSeconds = (value) => `${Number(value || 0).toFixed(2)}s`

const formatUpdatedAt = (value) => {
  if (!value) {
    return 'No signal yet'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const difficultyDescriptor = (seconds) => {
  if (seconds >= 45) return 'Overclocked'
  if (seconds >= 30) return 'Hyper'
  if (seconds >= 18) return 'Tense'
  if (seconds >= 8) return 'Rising'
  return 'Calm'
}

const getServerNowMs = () => frameClockMs.value + serverClockOffsetMs.value

const parseServerTime = (value) => {
  if (!value) {
    return null
  }

  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? null : parsed
}

const getRoundStartMs = () => parseServerTime(matchState.value.roundStartsAt)

const getCountdownEndMs = () => parseServerTime(matchState.value.countdownEndsAt)

const countdownSecondsLeft = computed(() => {
  const countdownEndMs = getCountdownEndMs()

  if (!countdownEndMs || !isCountdownPhase.value) {
    return 0
  }

  return Math.max(0, Math.ceil((countdownEndMs - getServerNowMs()) / 1000))
})

const primaryButtonLabel = computed(() => {
  if (isRunningPhase.value) {
    return 'Match running'
  }

  if (isCountdownPhase.value) {
    return `${countdownSecondsLeft.value || 0}s countdown`
  }

  return localRosterEntry.value?.ready ? 'Cancel ready' : 'Ready up'
})

const matchStatusLabel = computed(() => {
  if (isRunningPhase.value) return 'Running'
  if (isCountdownPhase.value) return 'Countdown'
  return 'Lobby'
})

const getPlayerAccent = (player) => player?.accentColor || localStyle.value.accentColor

const getPlayerAvatarIndex = (player) => {
  const rawIndex = Number(player?.avatarIndex ?? localStyle.value.avatarIndex)
  return clamp(Number.isFinite(rawIndex) ? rawIndex : 0, 0, OPEN_HEXAGON_AVATARS.length - 1)
}

const getPlayerAvatarSrc = (player) => getOpenHexagonAvatarSrc(getPlayerAvatarIndex(player))

const getPlayerAngle = (player) => {
  const rawAngle = Number(player?.angle)
  return Number.isFinite(rawAngle) ? wrapAngle(rawAngle) : DEFAULT_PLAYER_ANGLE
}

const currentLocalPlayer = computed(() => {
  if (localRosterEntry.value) {
    return localRosterEntry.value
  }

  return {
    userIdx: myUserId.value,
    nickname: displayName.value,
    avatarIndex: localStyle.value.avatarIndex,
    accentColor: localStyle.value.accentColor,
    angle: engine.playerAngle,
    playing: ui.running,
    alive: !ui.gameOver,
    currentScore: ui.survivalSeconds,
  }
})

const loadAvatars = async () => {
  await Promise.all(
    OPEN_HEXAGON_AVATARS.map(
      (src, index) =>
        new Promise((resolve) => {
          const image = new Image()
          image.onload = () => {
            avatarImages.set(index, image)
            resolve()
          }
          image.onerror = () => resolve()
          image.src = src
        }),
    ),
  )

  drawFrame()
}

const buildJoinPayload = () => ({
  nickname: displayName.value,
})

const buildPresencePayload = (overrides = {}) => ({
  angle: Number(engine.playerAngle.toFixed(4)),
  scoreSeconds: Number(ui.survivalSeconds.toFixed(3)),
  alive: !ui.gameOver,
  ...overrides,
})

const broadcastPresence = (force = false, overrides = {}) => {
  const now = performance.now()

  if (!force && now - engine.lastPresenceSyncAt < STATE_SYNC_INTERVAL_MS) {
    return
  }

  engine.lastPresenceSyncAt = now
  lobbySocket.sendState(buildPresencePayload(overrides))
}

const toggleReady = () => {
  if (isRunningPhase.value) {
    return
  }

  lobbySocket.sendReady(!localRosterEntry.value?.ready)
}

const getDifficultyAt = (elapsedSeconds) => 1 + Math.min(elapsedSeconds / 18, 4.6)

const getSharedWorldRotation = (elapsedSeconds) => {
  const roundSeed = Number(matchState.value.roundSeed ?? 0)
  const phaseOffset = ((roundSeed % 4096) / 4096) * TAU
  const difficulty = getDifficultyAt(elapsedSeconds)
  const baseSpin = elapsedSeconds * (0.52 + difficulty * 0.11)
  const harmonic =
    Math.sin(elapsedSeconds * 0.9 + phaseOffset) * 0.65 +
    Math.cos(elapsedSeconds * 0.33 + phaseOffset * 0.5) * 0.22

  return wrapAngle(phaseOffset + baseSpin + harmonic)
}

const getRoundElapsedSeconds = () => {
  const roundStartMs = getRoundStartMs()

  if (!roundStartMs) {
    return 0
  }

  return Math.max(0, (getServerNowMs() - roundStartMs) / 1000)
}

const appendPatternObstacles = (buffer, pattern, metrics, elapsedSeconds) => {
  const spawnAtSeconds = Number(pattern.spawnAtMs ?? 0) / 1000
  const age = elapsedSeconds - spawnAtSeconds

  if (age < 0) {
    return
  }

  const difficulty = getDifficultyAt(spawnAtSeconds)
  const patternType = pattern.patternType ?? 'gate'
  const ringCount = Number(pattern.ringCount ?? 1)
  const safeStart = Number(pattern.safeStart ?? 0)
  const safeWidth = patternType === 'gate' ? 1 : 2

  for (let ringIndex = 0; ringIndex < ringCount; ringIndex += 1) {
    const offsetSafeStart = (safeStart + ringIndex) % LANE_COUNT
    const baseRadius = metrics.spawnRadius + 140 + ringIndex * 110
    const thickness = 30 + difficulty * 5
    const speed = 195 + difficulty * 42 + ringIndex * 14
    const radius = baseRadius - speed * age

    if (radius <= metrics.coreRadius * 0.78) {
      continue
    }

    for (let lane = 0; lane < LANE_COUNT; lane += 1) {
      const inSafeWindow =
        lane === offsetSafeStart ||
        (safeWidth === 2 && lane === (offsetSafeStart + 1) % LANE_COUNT)

      if (patternType === 'spiral') {
        const spiralLane = (safeStart + ringIndex + lane) % LANE_COUNT
        const shouldBlock =
          spiralLane !== offsetSafeStart && spiralLane !== (offsetSafeStart + 1) % LANE_COUNT

        if (!shouldBlock) {
          continue
        }

        buffer.push({
          lane,
          radius: metrics.spawnRadius + 160 + ringIndex * 120 - (205 + difficulty * 44 + ringIndex * 18) * age,
          thickness: 32 + difficulty * 6,
          speed: 205 + difficulty * 44 + ringIndex * 18,
          hue: 340 - lane * 18 + ringIndex * 12,
        })
        continue
      }

      if (patternType === 'zigzag') {
        const parityBlock = (lane + ringIndex) % 2 === 0
        if (!parityBlock || inSafeWindow) {
          continue
        }
      } else if (inSafeWindow) {
        continue
      }

      buffer.push({
        lane,
        radius,
        thickness,
        speed,
        hue: 15 + lane * 12 + ringIndex * 15,
      })
    }
  }
}

const getActiveObstacles = (metrics, elapsedSeconds) => {
  const patterns = Array.isArray(matchState.value.patterns) ? matchState.value.patterns : []
  const obstacles = []

  for (const pattern of patterns) {
    appendPatternObstacles(obstacles, pattern, metrics, elapsedSeconds)
  }

  return obstacles
}

const isAngleInsideSector = (angle, start, end) => {
  const normalizedAngle = wrapAngle(angle)
  const normalizedStart = wrapAngle(start)
  const normalizedEnd = wrapAngle(end)

  if (normalizedStart <= normalizedEnd) {
    return normalizedAngle >= normalizedStart && normalizedAngle <= normalizedEnd
  }

  return normalizedAngle >= normalizedStart || normalizedAngle <= normalizedEnd
}

const stopLoop = () => {
  if (engine.animationId) {
    cancelAnimationFrame(engine.animationId)
    engine.animationId = 0
  }
}

const resetGame = () => {
  engine.playerAngle = DEFAULT_PLAYER_ANGLE
  engine.worldRotation = 0
  engine.lastFrameTime = 0
  engine.submittedScore = false
  engine.lastPresenceSyncAt = 0

  ui.started = false
  ui.running = false
  ui.gameOver = false
  ui.survivalSeconds = 0
  ui.difficultyLabel = difficultyDescriptor(0)

  drawFrame()
}

const reportScore = () => {
  if (engine.submittedScore) {
    return
  }

  engine.submittedScore = true
  lobbySocket.submitScore(Number(ui.survivalSeconds.toFixed(3)))
}

const finishGame = () => {
  ui.running = false
  ui.gameOver = true

  if (ui.survivalSeconds > localBestSeconds.value) {
    localBestSeconds.value = Number(ui.survivalSeconds.toFixed(2))
    saveLocalBest()
  }

  broadcastPresence(true, { alive: false })
  reportScore()
}

const drawPolygon = (ctx, centerX, centerY, radius, sides, rotation, fillStyle, strokeStyle) => {
  ctx.beginPath()

  for (let index = 0; index < sides; index += 1) {
    const angle = rotation + (TAU / sides) * index
    const point = polarPoint(centerX, centerY, radius, angle)

    if (index === 0) {
      ctx.moveTo(point.x, point.y)
    } else {
      ctx.lineTo(point.x, point.y)
    }
  }

  ctx.closePath()

  if (fillStyle) {
    ctx.fillStyle = fillStyle
    ctx.fill()
  }

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle
    ctx.stroke()
  }
}

const drawObstacle = (ctx, metrics, obstacle) => {
  const outerRadius = obstacle.radius
  const innerRadius = obstacle.radius - obstacle.thickness
  const startAngle = engine.worldRotation + obstacle.lane * metrics.sectorAngle + metrics.lanePadding
  const endAngle = engine.worldRotation + (obstacle.lane + 1) * metrics.sectorAngle - metrics.lanePadding

  const outerStart = polarPoint(metrics.centerX, metrics.centerY, outerRadius, startAngle)
  const outerEnd = polarPoint(metrics.centerX, metrics.centerY, outerRadius, endAngle)
  const innerEnd = polarPoint(metrics.centerX, metrics.centerY, innerRadius, endAngle)
  const innerStart = polarPoint(metrics.centerX, metrics.centerY, innerRadius, startAngle)

  const glow = ctx.createLinearGradient(outerStart.x, outerStart.y, innerEnd.x, innerEnd.y)
  glow.addColorStop(0, `hsla(${obstacle.hue}, 100%, 66%, 0.96)`)
  glow.addColorStop(1, `hsla(${(obstacle.hue + 40) % 360}, 100%, 48%, 0.85)`)

  ctx.beginPath()
  ctx.moveTo(outerStart.x, outerStart.y)
  ctx.lineTo(outerEnd.x, outerEnd.y)
  ctx.lineTo(innerEnd.x, innerEnd.y)
  ctx.lineTo(innerStart.x, innerStart.y)
  ctx.closePath()
  ctx.fillStyle = glow
  ctx.shadowBlur = 22
  ctx.shadowColor = `hsla(${obstacle.hue}, 100%, 62%, 0.55)`
  ctx.fill()
  ctx.shadowBlur = 0
}

const drawFallbackTriangle = (ctx, x, y, size, accentColor) => {
  ctx.beginPath()
  ctx.moveTo(x, y - size * 0.86)
  ctx.lineTo(x - size * 0.88, y + size * 0.7)
  ctx.lineTo(x + size * 0.88, y + size * 0.7)
  ctx.closePath()
  ctx.fillStyle = accentColor
  ctx.fill()
}

const drawPlayerMarker = (ctx, metrics, player, { local = false, slotIndex = 0 } = {}) => {
  const accentColor = getPlayerAccent(player)
  const angle = local ? wrapAngle(engine.playerAngle) : getPlayerAngle(player)
  const remoteSlot = Number(player?.orbitSlot ?? slotIndex)
  const orbitOffset = local ? -metrics.playerSize * 1.15 : metrics.playerSize * (2.8 + remoteSlot * 0.92)
  const markerRadius = metrics.playerOrbit + orbitOffset
  const markerCenter = polarPoint(metrics.centerX, metrics.centerY, markerRadius, angle)
  const markerSize = local ? metrics.playerSize * 4.9 : metrics.playerSize * 3.75
  const haloRadius = markerSize * (local ? 0.56 : 0.5)
  const isPlaying = local ? ui.running : Boolean(player.playing)
  const isAlive = local ? !ui.gameOver : Boolean(player.alive)

  ctx.save()
  ctx.globalAlpha = local ? 1 : isPlaying ? 0.94 : 0.62

  ctx.beginPath()
  ctx.arc(markerCenter.x, markerCenter.y, haloRadius + 8, 0, TAU)
  ctx.fillStyle = toRgba(accentColor, local ? 0.28 : 0.18)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(markerCenter.x, markerCenter.y, haloRadius, 0, TAU)
  ctx.fillStyle = 'rgba(4, 16, 24, 0.92)'
  ctx.shadowBlur = local ? 24 : 14
  ctx.shadowColor = toRgba(accentColor, 0.42)
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.lineWidth = local ? 4 : 3
  ctx.strokeStyle = accentColor
  ctx.stroke()

  const image = avatarImages.get(getPlayerAvatarIndex(player))

  if (image) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(markerCenter.x, markerCenter.y, haloRadius - 3, 0, TAU)
    ctx.clip()
    ctx.drawImage(
      image,
      markerCenter.x - haloRadius + 1,
      markerCenter.y - haloRadius + 1,
      (haloRadius - 1) * 2,
      (haloRadius - 1) * 2,
    )
    ctx.restore()
  } else {
    drawFallbackTriangle(ctx, markerCenter.x, markerCenter.y + 2, haloRadius * 0.9, accentColor)
  }

  if (!isAlive) {
    ctx.beginPath()
    ctx.moveTo(markerCenter.x - haloRadius * 0.7, markerCenter.y - haloRadius * 0.7)
    ctx.lineTo(markerCenter.x + haloRadius * 0.7, markerCenter.y + haloRadius * 0.7)
    ctx.moveTo(markerCenter.x + haloRadius * 0.7, markerCenter.y - haloRadius * 0.7)
    ctx.lineTo(markerCenter.x - haloRadius * 0.7, markerCenter.y + haloRadius * 0.7)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)'
    ctx.lineWidth = 3
    ctx.stroke()
  }

  const label = local ? `${displayName.value} (you)` : player.nickname
  if (label) {
    ctx.font = '600 12px ui-sans-serif, system-ui'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#eef9ff'
    ctx.fillText(label, markerCenter.x, markerCenter.y + haloRadius + 18)
  }

  const scoreText = formatSeconds(local ? ui.survivalSeconds : player.currentScore)
  ctx.font = '600 11px ui-sans-serif, system-ui'
  ctx.fillStyle = toRgba(accentColor, 0.94)
  ctx.fillText(scoreText, markerCenter.x, markerCenter.y - haloRadius - 12)
  ctx.restore()
}

const drawPlayers = (ctx, metrics) => {
  remotePlayers.value.forEach((player, index) => {
    drawPlayerMarker(ctx, metrics, player, { local: false, slotIndex: index })
  })

  drawPlayerMarker(ctx, metrics, currentLocalPlayer.value, { local: true })
}

const drawBackdrop = (ctx, metrics) => {
  const gradient = ctx.createRadialGradient(
    metrics.centerX,
    metrics.centerY,
    metrics.coreRadius * 0.35,
    metrics.centerX,
    metrics.centerY,
    metrics.spawnRadius * 1.25,
  )
  gradient.addColorStop(0, '#02141f')
  gradient.addColorStop(0.35, '#08273d')
  gradient.addColorStop(1, '#01070b')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, viewport.width, viewport.height)

  for (let lane = 0; lane < 18; lane += 1) {
    const angle = engine.worldRotation * 0.55 + (TAU / 18) * lane
    const start = polarPoint(metrics.centerX, metrics.centerY, metrics.coreRadius * 0.8, angle)
    const end = polarPoint(metrics.centerX, metrics.centerY, metrics.spawnRadius * 1.08, angle)
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.strokeStyle = `rgba(95, 214, 255, ${lane % 3 === 0 ? 0.12 : 0.05})`
    ctx.lineWidth = lane % 3 === 0 ? 2.2 : 1
    ctx.stroke()
  }

  ctx.beginPath()
  ctx.arc(metrics.centerX, metrics.centerY, metrics.playerOrbit - metrics.playerSize * 1.15, 0, TAU)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
  ctx.lineWidth = 2
  ctx.stroke()

  for (let ringIndex = 0; ringIndex < Math.max(remotePlayers.value.length, 1); ringIndex += 1) {
    ctx.beginPath()
    ctx.arc(
      metrics.centerX,
      metrics.centerY,
      metrics.playerOrbit + metrics.playerSize * (2.8 + ringIndex * 0.92),
      0,
      TAU,
    )
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.045)'
    ctx.lineWidth = 1.25
    ctx.stroke()
  }
}

const drawCore = (ctx, metrics) => {
  drawPolygon(ctx, metrics.centerX, metrics.centerY, metrics.coreRadius * 1.25, 6, engine.worldRotation, 'rgba(12, 35, 56, 0.95)', 'rgba(88, 220, 255, 0.3)')
  drawPolygon(ctx, metrics.centerX, metrics.centerY, metrics.coreRadius * 0.84, 6, -engine.worldRotation * 1.5, 'rgba(255, 94, 157, 0.22)', 'rgba(255, 181, 212, 0.42)')
  drawPolygon(ctx, metrics.centerX, metrics.centerY, metrics.coreRadius * 0.45, 6, engine.worldRotation * 2.4, '#fff0c4', null)
}

const drawOverlay = (ctx) => {
  if (isRunningPhase.value && !ui.gameOver) {
    return
  }

  let title = 'Open Hexagon'
  let subtitle = 'Ready up to begin a synchronized run.'

  if (isCountdownPhase.value) {
    title = String(countdownSecondsLeft.value || 0)
    subtitle = 'All pilots locked in. Shared countdown in progress.'
  } else if (ui.gameOver && isRunningPhase.value) {
    title = 'Signal Lost'
    subtitle = 'You crashed. Remaining players are still in the round.'
  } else if (localRosterEntry.value?.ready) {
    title = 'Ready'
    subtitle = `Waiting for everyone: ${readyCount.value}/${playerCount.value}`
  }

  ctx.fillStyle = 'rgba(2, 8, 15, 0.58)'
  ctx.fillRect(0, 0, viewport.width, viewport.height)

  ctx.fillStyle = '#f4fbff'
  ctx.textAlign = 'center'
  ctx.font = '700 38px ui-sans-serif, system-ui'
  ctx.fillText(title, viewport.width / 2, viewport.height / 2 - 18)
  ctx.font = '500 16px ui-sans-serif, system-ui'
  ctx.fillStyle = 'rgba(240, 247, 255, 0.8)'
  ctx.fillText(subtitle, viewport.width / 2, viewport.height / 2 + 18)
}

const drawFrame = () => {
  const canvas = canvasRef.value

  if (!canvas) {
    return
  }

  const context = canvas.getContext('2d')
  const metrics = getMetrics()
  const elapsedSeconds = isRunningPhase.value ? getRoundElapsedSeconds() : 0
  const activeObstacles = isRunningPhase.value ? getActiveObstacles(metrics, elapsedSeconds) : []

  engine.worldRotation = getSharedWorldRotation(elapsedSeconds)

  context.clearRect(0, 0, viewport.width, viewport.height)
  drawBackdrop(context, metrics)
  activeObstacles.forEach((obstacle) => drawObstacle(context, metrics, obstacle))
  drawCore(context, metrics)
  drawPlayers(context, metrics)
  drawOverlay(context)
}

const updateCollision = (metrics, activeObstacles) => {
  for (const obstacle of activeObstacles) {
    const outerRadius = obstacle.radius
    const innerRadius = obstacle.radius - obstacle.thickness
    const radialOverlap =
      metrics.playerOrbit + metrics.playerSize > innerRadius &&
      metrics.playerOrbit - metrics.playerSize < outerRadius

    if (!radialOverlap) {
      continue
    }

    const startAngle = engine.worldRotation + obstacle.lane * metrics.sectorAngle + metrics.lanePadding
    const endAngle = engine.worldRotation + (obstacle.lane + 1) * metrics.sectorAngle - metrics.lanePadding

    if (isAngleInsideSector(engine.playerAngle, startAngle, endAngle)) {
      finishGame()
      return
    }
  }
}

const updateGame = (deltaTime) => {
  if (!isRunningPhase.value || ui.gameOver) {
    return
  }

  const metrics = getMetrics()
  const elapsedSeconds = getRoundElapsedSeconds()
  const difficulty = getDifficultyAt(elapsedSeconds)
  const turnSpeed = 3.9 + difficulty * 0.52

  if (inputState.left) {
    engine.playerAngle -= turnSpeed * deltaTime
  }

  if (inputState.right) {
    engine.playerAngle += turnSpeed * deltaTime
  }

  engine.playerAngle = wrapAngle(engine.playerAngle)
  ui.survivalSeconds = elapsedSeconds
  ui.difficultyLabel = difficultyDescriptor(elapsedSeconds)

  broadcastPresence()
  updateCollision(metrics, getActiveObstacles(metrics, elapsedSeconds))
}

const gameLoop = (timestamp) => {
  frameClockMs.value = Date.now()

  if (!engine.lastFrameTime) {
    engine.lastFrameTime = timestamp
  }

  const deltaTime = clamp((timestamp - engine.lastFrameTime) / 1000, 0, 0.032)
  engine.lastFrameTime = timestamp

  ui.running =
    isRunningPhase.value &&
    (Boolean(localRosterEntry.value?.playing) || Boolean(localRosterEntry.value?.ready)) &&
    !ui.gameOver
  ui.started = isCountdownPhase.value || isRunningPhase.value

  if (isRunningPhase.value && engine.activeRoundNumber !== Number(matchState.value.roundNumber ?? 0)) {
    engine.activeRoundNumber = Number(matchState.value.roundNumber ?? 0)
    engine.playerAngle = DEFAULT_PLAYER_ANGLE
    engine.submittedScore = false
    ui.gameOver = false
  }

  if (isLobbyPhase.value && engine.activeRoundNumber !== 0) {
    engine.activeRoundNumber = 0
    ui.running = false
    ui.started = false
    ui.gameOver = false
    ui.survivalSeconds = 0
    ui.difficultyLabel = difficultyDescriptor(0)
    engine.playerAngle = DEFAULT_PLAYER_ANGLE
  }

  updateGame(deltaTime)
  drawFrame()

  engine.animationId = requestAnimationFrame(gameLoop)
}

const startGame = () => {
  toggleReady()
}

const restartGame = () => {
  engine.playerAngle = DEFAULT_PLAYER_ANGLE
}

const updateCanvasSize = () => {
  const canvas = canvasRef.value
  const surface = surfaceRef.value

  if (!canvas || !surface) {
    return
  }

  const rect = surface.getBoundingClientRect()
  const width = Math.max(rect.width, 320)
  const height = Math.max(rect.height, 420)
  const ratio = window.devicePixelRatio || 1

  viewport.width = width
  viewport.height = height

  canvas.width = Math.floor(width * ratio)
  canvas.height = Math.floor(height * ratio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const context = canvas.getContext('2d')
  context.setTransform(ratio, 0, 0, ratio, 0, 0)

  drawFrame()
}

const onKeyDown = (event) => {
  if (['ArrowLeft', 'a', 'A'].includes(event.key)) {
    inputState.left = true
  }

  if (['ArrowRight', 'd', 'D'].includes(event.key)) {
    inputState.right = true
  }

  if (event.code === 'Space' && isLobbyPhase.value) {
    event.preventDefault()
    startGame()
  }
}

const onKeyUp = (event) => {
  if (['ArrowLeft', 'a', 'A'].includes(event.key)) {
    inputState.left = false
  }

  if (['ArrowRight', 'd', 'D'].includes(event.key)) {
    inputState.right = false
  }
}

const handlePress = (direction, pressed) => {
  inputState[direction] = pressed
}

watch(
  playerRoster,
  () => {
    if (!ui.running) {
      drawFrame()
    }
  },
  { deep: true },
)

watch(
  () => matchState.value.serverTime,
  (serverTime) => {
    const parsed = parseServerTime(serverTime)
    if (parsed) {
      serverClockOffsetMs.value = parsed - Date.now()
    }
  },
  { immediate: true },
)

watch(
  () => localRosterEntry.value?.alive,
  (alive) => {
    if (isRunningPhase.value && alive === false) {
      ui.gameOver = true
      ui.running = false
    }
  },
)

onMounted(async () => {
  if (!authStore.token) {
    authStore.checkLogin()
  }

  loadLocalBest()
  updateCanvasSize()
  resetGame()
  await loadAvatars()
  engine.animationId = requestAnimationFrame(gameLoop)

  window.addEventListener('resize', updateCanvasSize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)

  try {
    await lobbySocket.ensureConnection(buildJoinPayload())
    broadcastPresence(true, { alive: true, scoreSeconds: 0 })
  } catch (error) {
    console.error('Failed to initialize the Open Hexagon lobby:', error)
  }
})

onUnmounted(() => {
  stopLoop()
  lobbySocket.leave()
  window.removeEventListener('resize', updateCanvasSize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})
</script>

<template>
  <section class="open-hexagon-page">
    <div class="hero-panel">
      <div>
        <p class="eyebrow">Easter Egg</p>
        <h1>Open Hexagon</h1>
        <p class="hero-copy">
          Avatars are now assigned by the server, all pilots share one countdown,
          and the incoming walls are synchronized from the same match pattern queue.
        </p>
      </div>

      <div class="hero-actions">
        <button class="primary-button" :disabled="isRunningPhase" @click="startGame">
          {{ primaryButtonLabel }}
        </button>
        <button class="secondary-button" @click="restartGame">
          Recenter ship
        </button>
      </div>
    </div>

    <div class="game-layout">
      <div class="game-shell">
        <div class="status-strip">
          <div class="status-card">
            <span class="status-label">Current</span>
            <strong>{{ formatSeconds(ui.survivalSeconds) }}</strong>
          </div>
          <div class="status-card">
            <span class="status-label">Best local</span>
            <strong>{{ formatSeconds(localBestSeconds) }}</strong>
          </div>
          <div class="status-card">
            <span class="status-label">Match</span>
            <strong>{{ matchStatusLabel }}</strong>
          </div>
          <div class="status-card">
            <span class="status-label">Ready</span>
            <strong>{{ readyCount }}/{{ playerCount }}</strong>
          </div>
          <div class="status-card" :class="`state-${connectionState}`">
            <span class="status-label">Socket</span>
            <strong>{{ connectionState }}</strong>
          </div>
        </div>

        <div ref="surfaceRef" class="canvas-surface">
          <canvas ref="canvasRef" class="game-canvas"></canvas>
        </div>

        <div class="control-row">
          <button
            class="control-button"
            @touchstart.prevent="handlePress('left', true)"
            @touchend.prevent="handlePress('left', false)"
            @mousedown.prevent="handlePress('left', true)"
            @mouseup.prevent="handlePress('left', false)"
            @mouseleave.prevent="handlePress('left', false)"
          >
            Rotate left
          </button>
          <button
            class="control-button"
            @touchstart.prevent="handlePress('right', true)"
            @touchend.prevent="handlePress('right', false)"
            @mousedown.prevent="handlePress('right', true)"
            @mouseup.prevent="handlePress('right', false)"
            @mouseleave.prevent="handlePress('right', false)"
          >
            Rotate right
          </button>
        </div>

        <p v-if="socketError" class="socket-error">{{ socketError }}</p>
      </div>

      <aside class="info-rail">
        <section class="info-card">
          <div class="card-head">
            <h2>Live lobby</h2>
            <span class="pill">{{ lobby.onlineCount }} online</span>
          </div>
          <p class="muted-copy">
            Avatar assignment, ready state, countdown, and live position are all synchronized through STOMP.
          </p>
          <ul class="player-list">
            <li
              v-for="player in playerRoster"
              :key="player.userIdx"
              class="player-item"
              :class="{ active: player.playing }"
            >
              <div class="player-meta">
                <img
                  class="player-avatar"
                  :src="getPlayerAvatarSrc(player)"
                  :alt="player.nickname"
                  :style="{
                    borderColor: getPlayerAccent(player),
                    boxShadow: `0 0 0 3px ${toRgba(getPlayerAccent(player), 0.18)}`,
                  }"
                />
                <div>
                  <strong>{{ player.nickname }}</strong>
                  <small>
                    {{ player.playing ? 'Playing now' : player.ready ? 'Ready' : 'Idle in lobby' }}
                  </small>
                </div>
              </div>
              <small>{{ formatSeconds(player.currentScore) }}</small>
            </li>
            <li v-if="!playerRoster.length" class="player-item empty">No pilots connected yet.</li>
          </ul>
        </section>

        <section class="info-card">
          <div class="card-head">
            <h2>Leaderboard</h2>
            <span class="pill accent">Live</span>
          </div>
          <ol class="leaderboard">
            <li
              v-for="entry in leaderboardEntries"
              :key="entry.userIdx"
              class="leaderboard-item"
              :class="{ mine: Number(entry.userIdx) === myUserId }"
            >
              <div class="player-meta">
                <img
                  class="player-avatar"
                  :src="getPlayerAvatarSrc(entry)"
                  :alt="entry.nickname"
                  :style="{
                    borderColor: getPlayerAccent(entry),
                    boxShadow: `0 0 0 3px ${toRgba(getPlayerAccent(entry), 0.18)}`,
                  }"
                />
                <div>
                  <strong>{{ entry.nickname }}</strong>
                  <small>{{ formatUpdatedAt(entry.updatedAt) }}</small>
                </div>
              </div>
              <span>{{ formatSeconds(entry.bestScore) }}</span>
            </li>
            <li v-if="!leaderboardEntries.length" class="leaderboard-item empty">
              No scores posted yet.
            </li>
          </ol>
        </section>

        <section class="info-card">
          <div class="card-head">
            <h2>Controls</h2>
          </div>
          <ul class="tip-list">
            <li><code>A</code> / <code>D</code> or arrow keys rotate the avatar.</li>
            <li>Everyone must ready up before the 3 second countdown begins.</li>
            <li>The round uses one shared pattern schedule for every screen.</li>
            <li>Each player gets a server-assigned avatar image and color.</li>
            <li>Open it from the profile dropdown Games menu.</li>
          </ul>
        </section>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.open-hexagon-page {
  height: 100%;
  min-height: 100%;
  overflow: auto;
  padding: 1rem;
  box-sizing: border-box;
  display: grid;
  gap: 1.5rem;
  color: #f4fbff;
  --surface-dark: #05131d;
  --surface-mid: #0a2536;
  --surface-soft: rgba(11, 31, 44, 0.78);
  --line-soft: rgba(124, 224, 255, 0.18);
  --line-strong: rgba(124, 224, 255, 0.4);
  --accent-main: #59d6ff;
  --accent-warm: #ff8f70;
  --text-soft: rgba(235, 247, 255, 0.74);
}

.hero-panel {
  display: flex;
  justify-content: space-between;
  gap: 1.2rem;
  align-items: end;
  padding: 1.6rem 1.8rem;
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(114, 255, 219, 0.12), transparent 26%),
    radial-gradient(circle at top right, rgba(255, 139, 102, 0.16), transparent 28%),
    linear-gradient(135deg, #071723, #102f43 58%, #1e4355);
  box-shadow: 0 28px 60px rgba(2, 10, 18, 0.28);
}

.eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: #7fe3ff;
}

.hero-panel h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.4rem);
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.hero-copy {
  max-width: 58rem;
  margin: 0.85rem 0 0;
  color: var(--text-soft);
  line-height: 1.65;
}

.hero-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: end;
}

.primary-button,
.secondary-button,
.control-button {
  border: 0;
  border-radius: 999px;
  padding: 0.9rem 1.2rem;
  font-weight: 700;
  cursor: pointer;
}

.primary-button {
  background: linear-gradient(135deg, #ff9261, #ff4f88);
  color: white;
  box-shadow: 0 16px 36px rgba(255, 93, 132, 0.34);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.7;
  box-shadow: none;
}

.secondary-button {
  background: rgba(255, 255, 255, 0.08);
  color: #f4fbff;
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.game-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.7fr) minmax(18rem, 0.95fr);
  gap: 1.4rem;
}

.game-shell,
.info-card {
  background:
    linear-gradient(180deg, rgba(7, 25, 38, 0.94), rgba(3, 13, 20, 0.97)),
    linear-gradient(135deg, rgba(89, 214, 255, 0.08), transparent 50%);
  border: 1px solid var(--line-soft);
  box-shadow: 0 24px 60px rgba(2, 8, 15, 0.24);
}

.game-shell {
  border-radius: 28px;
  padding: 1rem;
  display: grid;
  gap: 1rem;
}

.status-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 0.75rem;
}

.status-card {
  padding: 0.9rem 1rem;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.status-card strong {
  font-size: 1.15rem;
}

.status-label {
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(233, 247, 255, 0.6);
}

.state-connected {
  border-color: rgba(80, 255, 184, 0.35);
}

.state-connecting {
  border-color: rgba(255, 214, 92, 0.35);
}

.state-error,
.state-disconnected {
  border-color: rgba(255, 105, 105, 0.35);
}

.canvas-surface {
  min-height: 32rem;
  height: min(42rem, 58vh);
  border-radius: 22px;
  overflow: hidden;
  background:
    radial-gradient(circle at top, rgba(113, 235, 255, 0.1), transparent 20%),
    linear-gradient(180deg, #051520, #02080d);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.game-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.control-row {
  display: none;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.control-button {
  background: rgba(255, 255, 255, 0.08);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.14);
}

.socket-error {
  margin: 0;
  color: #ffb6b6;
}

.info-rail {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.info-card {
  border-radius: 24px;
  padding: 1.2rem;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.8rem;
}

.card-head h2 {
  margin: 0;
  font-size: 1.05rem;
}

.pill {
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  font-size: 0.78rem;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.08);
  color: #dff7ff;
}

.pill.accent {
  background: rgba(89, 214, 255, 0.16);
  color: #7fe8ff;
}

.muted-copy {
  margin: 0 0 1rem;
  color: var(--text-soft);
  line-height: 1.55;
}

.player-list,
.leaderboard,
.tip-list {
  display: grid;
  gap: 0.7rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.player-item,
.leaderboard-item {
  padding: 0.8rem 0.9rem;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.player-item {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.player-item.active {
  border-color: rgba(89, 214, 255, 0.28);
  background: rgba(89, 214, 255, 0.08);
}

.player-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.player-meta div {
  display: grid;
  gap: 0.18rem;
}

.player-avatar {
  width: 2.6rem;
  height: 2.6rem;
  object-fit: cover;
  border-radius: 50%;
  border: 3px solid transparent;
  background: rgba(4, 16, 24, 0.9);
  flex-shrink: 0;
}

.player-item small,
.leaderboard-item small {
  color: rgba(238, 247, 255, 0.62);
}

.leaderboard-item {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  align-items: center;
}

.leaderboard-item > div {
  display: grid;
  gap: 0.22rem;
}

.leaderboard-item.mine {
  border-color: rgba(127, 232, 255, 0.28);
  background: rgba(89, 214, 255, 0.08);
}

.empty {
  color: var(--text-soft);
}

.tip-list li {
  padding: 0.7rem 0.85rem;
  border-radius: 15px;
  background: rgba(255, 255, 255, 0.04);
  line-height: 1.55;
}

.tip-list code {
  background: rgba(255, 255, 255, 0.08);
  padding: 0.12rem 0.38rem;
  border-radius: 999px;
}

@media (max-width: 1100px) {
  .game-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .open-hexagon-page {
    padding: 0.85rem;
  }

  .hero-panel {
    align-items: start;
    flex-direction: column;
  }

  .status-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .control-row {
    display: grid;
  }

  .canvas-surface {
    min-height: 24rem;
    height: 28rem;
  }
}

@media (max-width: 640px) {
  .open-hexagon-page {
    min-height: auto;
    height: auto;
    padding: 0.7rem;
  }

  .hero-panel,
  .game-shell,
  .info-card {
    border-radius: 22px;
  }

  .status-strip {
    grid-template-columns: 1fr;
  }

  .player-item,
  .leaderboard-item {
    align-items: start;
    flex-direction: column;
  }

  .canvas-surface {
    height: 24rem;
  }
}
</style>
