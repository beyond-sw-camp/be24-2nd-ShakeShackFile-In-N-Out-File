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

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const isAppOpen = clients.some((client) =>
        client.url.includes(self.location.origin) && client.visibilityState === 'visible'
      )

      if (isAppOpen) {
        // 웹이 열려있으면 → Header 알림으로만 전달, OS 푸시 안 띄움
        clients.forEach((client) => {
          if (payload.type === 'invite' || payload.type === 'general') {
            client.postMessage({ channel: 'notification', payload })
          } else {
            client.postMessage({
              type: 'NEW_MESSAGE',
              notifType: 'message',
              title: payload.title,
              roomIdx: payload.roomIdx,
              lastMsg: payload.message,
              message: payload.message,
              unreadCount: payload.unreadCount,
            })
          }
        })
        return // OS 푸시 띄우지 않고 종료
      }

      // 웹이 닫혀있으면 → BroadcastChannel + OS 푸시
      if (payload.type === 'invite' || payload.type === 'general') {
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('notif_channel')
          channel.postMessage(payload)
          channel.close()
        }
        clients.forEach((client) => {
          client.postMessage({ channel: 'notification', payload })
        })
      } else {
        clients.forEach((client) => {
          client.postMessage({
            type: 'NEW_MESSAGE',
            notifType: 'message',
            title: payload.title,
            roomIdx: payload.roomIdx,
            lastMsg: payload.message,
            message: payload.message,
            unreadCount: payload.unreadCount,
          })
        })
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

      return self.registration.showNotification(payload.title, options)
    })
  )
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