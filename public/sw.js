// ── 1. 푸시 알림 수신 ─────────────────────────────────────────────────────
self.addEventListener('push', function (e) {
    if (!e.data) return;

    // 기본 페이로드
    let payload = {
        type: 'general',
        uuid: '',
        title: '새 알림',
        message: '알림이 도착했습니다.',
        roomIdx: null,
        unreadCount: 0
    };

    try {
        Object.assign(payload, e.data.json());
    } catch (err) {
        payload.message = e.data.text();
    }

    // ── ★ 초대 알림: BroadcastChannel 로 Header.vue 에 전달 ───────────────
    if (payload.type === 'invite') {
        const bc = new BroadcastChannel('notif_channel');
        bc.postMessage({
            type:    'invite',
            uuid:    payload.uuid,
            title:   payload.title,
            message: payload.message
        });
        bc.close();
    } else {
        // ── 채팅 메시지: 기존 방식대로 열린 탭에 직접 postMessage ─────────
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type:        'NEW_MESSAGE',
                    roomIdx:     payload.roomIdx,
                    lastMsg:     payload.message,
                    unreadCount: payload.unreadCount
                });
            });
        });
    }

    // ── 시스템 알림 (초대 / 채팅 공통) ────────────────────────────────────
    const isInvite = payload.type === 'invite';
    const options = {
        body:     payload.message,
        icon:     '/favicon.ico',
        badge:    '/favicon.ico',
        data: {
            type:    payload.type,
            uuid:    payload.uuid    ?? null,
            roomIdx: payload.roomIdx ?? null
        },
        tag:      isInvite
                    ? `invite-${payload.uuid}`
                    : `chat-room-${payload.roomIdx}`,
        renotify: true,
        vibrate:  [200, 100, 200]
    };

    e.waitUntil(
        self.registration.showNotification(payload.title, options)
    );
});

// ── 2. 푸시 알림 클릭 ─────────────────────────────────────────────────────
self.addEventListener('notificationclick', function (e) {
    e.notification.close();

    const { type, roomIdx } = e.notification.data;

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    // 초대 알림 클릭 시 → 앱 포커스만 (헤더 종 드롭다운에서 수락/거절)
                    if (type !== 'invite') {
                        client.postMessage({ type: 'OPEN_CHAT_ROOM', roomIdx });
                    }
                    return;
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});