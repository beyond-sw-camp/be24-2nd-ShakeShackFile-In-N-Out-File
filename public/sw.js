// 알림 수신 이벤트
self.addEventListener('push', function(event) {
    if (event.data) {
        const data = event.data.json(); // Payload DTO 구조
        const options = {
            body: data.message,
            icon: '/favicon.ico', // 앱 로고 경로
            badge: '/img/badge.png',
            data: {
                roomIdx: data.roomIdx
            }
        };

        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );

        // 헤더의 알림 드롭다운과 통신하기 위한 채널
        const bc = new BroadcastChannel('notif_channel');
        bc.postMessage(data);
    }
});

// 알림 클릭 이벤트
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/') // 알림 클릭 시 메인 페이지로 이동
    );
});