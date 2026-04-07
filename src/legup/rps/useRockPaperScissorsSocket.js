import { ref } from "vue";
import SockJS from "sockjs-client";
import Stomp from "stompjs";
import { apiPath } from "@/utils/backendUrl";

const createEmptyRoomState = (roomId = "") => ({
  roomId,
  status: "WAITING",
  players: [],
  messages: [],
  typingNickname: "",
  result: null,
  updatedAt: null,
});

const normalizeRoomState = (payload = {}) => ({
  roomId: payload.roomId ?? "",
  status: payload.status ?? "WAITING",
  players: Array.isArray(payload.players) ? payload.players : [],
  messages: Array.isArray(payload.messages) ? payload.messages : [],
  typingNickname: payload.typingNickname ?? "",
  result: payload.result ?? null,
  updatedAt: payload.updatedAt ?? null,
});

export function useRockPaperScissorsSocket(authStore) {
  const roomState = ref(createEmptyRoomState());
  const currentRoomId = ref("");
  const connectionState = ref("idle");
  const socketError = ref("");

  let stompClient = null;
  let roomSubscription = null;

  const getHeaders = () => ({
    Authorization: `Bearer ${authStore.token}`,
  });

  const ensureConnection = async () => {
    if (!authStore.token) {
      throw new Error("로그인이 필요합니다.");
    }

    if (stompClient?.connected) {
      return;
    }

    connectionState.value = "connecting";
    socketError.value = "";

    const socket = new SockJS(apiPath("/ws-stomp"));
    stompClient = Stomp.over(socket);
    stompClient.debug = () => {};

    await new Promise((resolve, reject) => {
      stompClient.connect(
        getHeaders(),
        () => {
          connectionState.value = "connected";
          resolve();
        },
        (error) => {
          connectionState.value = "error";
          socketError.value = "가위바위보 서버에 연결하지 못했습니다.";
          reject(error);
        },
      );
    });
  };

  const subscribeRoom = (roomId) => {
    if (roomSubscription) {
      roomSubscription.unsubscribe();
      roomSubscription = null;
    }

    roomSubscription = stompClient.subscribe(`/sub/game/rps/room/${roomId}`, (message) => {
      roomState.value = normalizeRoomState(JSON.parse(message.body));
    });
  };

  const joinRoom = async (roomId) => {
    const normalizedRoomId = String(roomId || "").trim();
    if (!normalizedRoomId) {
      throw new Error("방 코드를 입력해 주세요.");
    }

    await ensureConnection();
    subscribeRoom(normalizedRoomId);
    currentRoomId.value = normalizedRoomId;
    roomState.value = createEmptyRoomState(normalizedRoomId);
    stompClient.send("/pub/game/rps/join", getHeaders(), JSON.stringify({ roomId: normalizedRoomId }));
  };

  const sendChoice = (choice) => {
    if (!stompClient?.connected || !currentRoomId.value) {
      return;
    }

    stompClient.send(
      "/pub/game/rps/choice",
      getHeaders(),
      JSON.stringify({ roomId: currentRoomId.value, choice }),
    );
  };

  const sendChat = (message) => {
    if (!stompClient?.connected || !currentRoomId.value) {
      return;
    }

    stompClient.send(
      "/pub/game/rps/chat",
      getHeaders(),
      JSON.stringify({ roomId: currentRoomId.value, message }),
    );
  };

  const sendTyping = (typing) => {
    if (!stompClient?.connected || !currentRoomId.value) {
      return;
    }

    stompClient.send(
      "/pub/game/rps/typing",
      getHeaders(),
      JSON.stringify({ roomId: currentRoomId.value, typing: Boolean(typing) }),
    );
  };

  const resetRound = () => {
    if (!stompClient?.connected || !currentRoomId.value) {
      return;
    }

    stompClient.send(
      "/pub/game/rps/reset",
      getHeaders(),
      JSON.stringify({ roomId: currentRoomId.value }),
    );
  };

  const leaveRoom = () => {
    if (stompClient?.connected && currentRoomId.value) {
      try {
        stompClient.send(
          "/pub/game/rps/leave",
          getHeaders(),
          JSON.stringify({ roomId: currentRoomId.value }),
        );
      } catch (error) {
        console.error("가위바위보 퇴장 알림 실패:", error);
      }
    }

    if (roomSubscription) {
      roomSubscription.unsubscribe();
      roomSubscription = null;
    }

    roomState.value = createEmptyRoomState();
    currentRoomId.value = "";
  };

  const disconnect = () => {
    leaveRoom();

    if (stompClient) {
      try {
        stompClient.disconnect(() => {});
      } catch (error) {
        console.error("가위바위보 소켓 종료 실패:", error);
      }
    }

    stompClient = null;
    connectionState.value = "disconnected";
  };

  return {
    roomState,
    currentRoomId,
    connectionState,
    socketError,
    joinRoom,
    sendChoice,
    sendChat,
    sendTyping,
    resetRound,
    leaveRoom,
    disconnect,
  };
}
