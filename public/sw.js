// 1. 푸시 알림 수신 시
self.addEventListener('push', function(e) {
    if (e.data) {
        let payload = {
            title: '새 메시지',
            message: '채팅이 도착했습니다.',
            roomIdx: null,
            unreadCount: 0
        };

        try {
            payload = e.data.json();
        } catch (err) {
            payload.message = e.data.text();
        }

        // [역할 1] 열려있는 모든 탭에 실시간 데이터 전송 (목록 갱신용)
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
            clients.forEach(client => {
                client.postMessage({
                    type: 'NEW_MESSAGE',
                    roomIdx: payload.roomIdx,
                    lastMsg: payload.message,
                    unreadCount: payload.unreadCount
                });
            });
        });

        // [역할 2] 시스템 알림 띄우기
        const options = {
            body: payload.message,
            icon: '/favicon.ico', 
            badge: '/favicon.ico',
            data: { 
                roomIdx: payload.roomIdx  // URL 대신 roomIdx만 저장
            },
            tag: `chat-room-${payload.roomIdx}`,
            renotify: true,
            vibrate: [200, 100, 200]
        };

        e.waitUntil(
            self.registration.showNotification(payload.title, options)
        );
    }
});

// 2. 푸시 알림 클릭 시
self.addEventListener('notificationclick', function(e) {
    e.notification.close(); 
    const roomIdx = e.notification.data.roomIdx;

    e.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
            // 이미 앱이 켜져 있는 탭이 있다면 포커스 후 해당 방 열기 지시
            for (let i = 0; i < clientList.length; i++) {
                const client = clientList[i];
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.focus();
                    return client.postMessage({
                        type: 'OPEN_CHAT_ROOM',
                        roomIdx: roomIdx
                    });
                }
            }
            // 앱이 꺼져 있다면 메인 페이지 새로 열기
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});