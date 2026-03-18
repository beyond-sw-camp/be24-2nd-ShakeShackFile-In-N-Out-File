self.addEventListener('push', (event) => {
  if (!event.data) return

  const payload = {
    notificationId: null,
    type: 'general',
    uuid: null,
    title: '새 알림',
    message: '알림이 도착했습니다.',
    roomIdx: null,
    unreadCount: 0,
    createdAt: null,
  }

  try {
    Object.assign(payload, event.data.json())
  } catch (error) {
    payload.message = event.data.text()
  }

  if (payload.type === 'invite' || payload.type === 'general') {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel('notif_channel')
      channel.postMessage(payload)
      channel.close()
    }

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            channel: 'notification',
            payload,
          })
        })
      }),
    )
  } else {
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'NEW_MESSAGE',
            roomIdx: payload.roomIdx,
            lastMsg: payload.message,
            unreadCount: payload.unreadCount,
          })
        })
      }),
    )
  }

  const isInvite = payload.type === 'invite'
  const options = {
    body: payload.message,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      notificationId: payload.notificationId,
      type: payload.type,
      uuid: payload.uuid,
      roomIdx: payload.roomIdx,
    },
    tag: isInvite
      ? `invite-${payload.notificationId ?? payload.uuid ?? Date.now()}`
      : `chat-room-${payload.roomIdx ?? Date.now()}`,
    renotify: true,
    vibrate: [200, 100, 200],
  }

  event.waitUntil(self.registration.showNotification(payload.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const { type, roomIdx } = event.notification.data || {}

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          if (type !== 'invite') {
            client.postMessage({ type: 'OPEN_CHAT_ROOM', roomIdx })
          }
          return undefined
        }
      }

      if (clients.openWindow) {
        return clients.openWindow('/')
      }

      return undefined
    }),
  )
})
