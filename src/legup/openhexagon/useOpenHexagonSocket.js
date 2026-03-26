import { ref } from 'vue'
import SockJS from 'sockjs-client'
import Stomp from 'stompjs'
import { api } from '@/plugins/axiosinterceptor'

const createEmptyLobby = () => ({
  onlineCount: 0,
  players: [],
  leaderboard: [],
  match: {
    status: 'LOBBY',
    playerCount: 0,
    readyCount: 0,
    roundNumber: 0,
    roundSeed: null,
    countdownStartedAt: null,
    countdownEndsAt: null,
    roundStartsAt: null,
    serverTime: null,
    patterns: [],
  },
  updatedAt: null,
})

const normalizeLobby = (payload = {}) => ({
  onlineCount: Number(payload.onlineCount ?? 0),
  players: Array.isArray(payload.players) ? payload.players : [],
  leaderboard: Array.isArray(payload.leaderboard) ? payload.leaderboard : [],
  match: {
    status: payload.match?.status ?? 'LOBBY',
    playerCount: Number(payload.match?.playerCount ?? 0),
    readyCount: Number(payload.match?.readyCount ?? 0),
    roundNumber: Number(payload.match?.roundNumber ?? 0),
    roundSeed: payload.match?.roundSeed ?? null,
    countdownStartedAt: payload.match?.countdownStartedAt ?? null,
    countdownEndsAt: payload.match?.countdownEndsAt ?? null,
    roundStartsAt: payload.match?.roundStartsAt ?? null,
    serverTime: payload.match?.serverTime ?? null,
    patterns: Array.isArray(payload.match?.patterns) ? payload.match.patterns : [],
  },
  updatedAt: payload.updatedAt ?? null,
})

export function useOpenHexagonSocket(authStore) {
  const lobby = ref(createEmptyLobby())
  const connectionState = ref('idle')
  const socketError = ref('')

  let stompClient = null
  let joinedLobby = false
  let joinPayload = null

  const getHeaders = () => ({
    Authorization: `Bearer ${authStore.token}`,
  })

  const fetchSnapshot = async () => {
    try {
      const response = await api.get('/game/openhexagon/state')
      lobby.value = normalizeLobby(response.data?.result)
    } catch (error) {
      console.error('Failed to load Open Hexagon lobby snapshot:', error)
    }
  }

  const publishJoin = (payload) => {
    if (!stompClient?.connected || !payload) {
      return
    }

    joinPayload = payload
    joinedLobby = true

    stompClient.send('/pub/game/openhexagon/join', getHeaders(), JSON.stringify(payload))
  }

  const ensureConnection = async (payload) => {
    await fetchSnapshot()

    joinPayload = payload

    if (!authStore.token || stompClient?.connected) {
      if (stompClient?.connected && !joinedLobby && joinPayload) {
        publishJoin(joinPayload)
      }

      return
    }

    connectionState.value = 'connecting'
    socketError.value = ''

    const socket = new SockJS('https://api.fileinnout.kro.kr/ws-stomp')
    stompClient = Stomp.over(socket)
    stompClient.debug = () => {}

    await new Promise((resolve, reject) => {
      stompClient.connect(
        getHeaders(),
        () => {
          connectionState.value = 'connected'

          stompClient.subscribe('/sub/game/openhexagon/lobby', (message) => {
            lobby.value = normalizeLobby(JSON.parse(message.body))
          })

          publishJoin(joinPayload)

          resolve()
        },
        (error) => {
          connectionState.value = 'error'
          socketError.value = 'WebSocket connection failed.'
          console.error('Open Hexagon socket error:', error)
          reject(error)
        },
      )
    })
  }

  const submitScore = (scoreSeconds) => {
    if (!stompClient?.connected) {
      return
    }

    stompClient.send(
      '/pub/game/openhexagon/score',
      getHeaders(),
      JSON.stringify({ scoreSeconds }),
    )
  }

  const sendReady = (ready) => {
    if (!stompClient?.connected || !joinedLobby) {
      return
    }

    stompClient.send(
      '/pub/game/openhexagon/ready',
      getHeaders(),
      JSON.stringify({ ready: Boolean(ready) }),
    )
  }

  const sendState = (statePayload) => {
    if (!stompClient?.connected || !joinedLobby) {
      return
    }

    stompClient.send(
      '/pub/game/openhexagon/state',
      getHeaders(),
      JSON.stringify(statePayload),
    )
  }

  const leave = () => {
    if (!stompClient) {
      connectionState.value = 'disconnected'
      return
    }

    if (stompClient.connected && joinedLobby) {
      try {
        stompClient.send('/pub/game/openhexagon/leave', getHeaders(), '{}')
      } catch (error) {
        console.error('Failed to notify lobby leave:', error)
      }
    }

    try {
      stompClient.disconnect(() => {})
    } catch (error) {
      console.error('Failed to disconnect Open Hexagon socket:', error)
    }

    stompClient = null
    joinedLobby = false
    connectionState.value = 'disconnected'
  }

  return {
    lobby,
    connectionState,
    socketError,
    fetchSnapshot,
    ensureConnection,
    submitScore,
    sendReady,
    sendState,
    leave,
  }
}
