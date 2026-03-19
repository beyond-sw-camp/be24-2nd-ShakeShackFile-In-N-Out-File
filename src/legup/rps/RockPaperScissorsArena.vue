<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { useAuthStore } from "@/stores/useAuthStore";
import { useRockPaperScissorsSocket } from "@/legup/rps/useRockPaperScissorsSocket";

const authStore = useAuthStore();
const socket = useRockPaperScissorsSocket(authStore);

const roomInput = ref("");
const chatInput = ref("");
const joinError = ref("");
const selectedChoice = ref("");
let typingTimer = null;

const choiceCards = [
  { id: "rock", label: "바위", image: "/legup/rps/images/rock.png" },
  { id: "paper", label: "보", image: "/legup/rps/images/paper.png" },
  { id: "scissors", label: "가위", image: "/legup/rps/images/scissors.png" },
];

const roomState = computed(() => socket.roomState.value);
const players = computed(() => Array.isArray(roomState.value.players) ? roomState.value.players : []);
const connectionState = computed(() => socket.connectionState.value);
const socketError = computed(() => socket.socketError.value);
const currentRoomId = computed(() => socket.currentRoomId.value);
const myUserId = computed(() => Number(authStore.user?.idx ?? 0));
const myPlayer = computed(() => players.value.find((player) => Number(player.userIdx) === myUserId.value) || null);
const opponentPlayer = computed(() => players.value.find((player) => Number(player.userIdx) !== myUserId.value) || null);
const canSubmitChoice = computed(() => Boolean(currentRoomId.value) && roomState.value.status !== "RESULT");
const resultSummary = computed(() => {
  const result = roomState.value.result;
  if (!result) {
    return "";
  }

  if (result.outcome === "DRAW") {
    return "이번 라운드는 무승부입니다.";
  }

  return `${result.winnerNickname} 승리`;
});

const formatTime = (value) => {
  if (!value) {
    return "방금 전";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const joinRoom = async () => {
  joinError.value = "";
  try {
    await socket.joinRoom(roomInput.value);
    selectedChoice.value = "";
  } catch (error) {
    joinError.value = error?.message || "방에 참여하지 못했습니다.";
  }
};

const leaveRoom = () => {
  socket.leaveRoom();
  selectedChoice.value = "";
  chatInput.value = "";
  roomInput.value = "";
};

const chooseCard = (choiceId) => {
  if (!canSubmitChoice.value) {
    return;
  }

  selectedChoice.value = choiceId;
  socket.sendChoice(choiceId);
};

const submitChat = () => {
  const message = chatInput.value.trim();
  if (!message) {
    return;
  }

  socket.sendChat(message);
  socket.sendTyping(false);
  chatInput.value = "";
};

const handleChatInput = () => {
  if (!currentRoomId.value) {
    return;
  }

  socket.sendTyping(true);
  if (typingTimer) {
    window.clearTimeout(typingTimer);
  }

  typingTimer = window.setTimeout(() => {
    socket.sendTyping(false);
    typingTimer = null;
  }, 1200);
};

const resetRound = () => {
  selectedChoice.value = "";
  socket.resetRound();
};

onBeforeUnmount(() => {
  if (typingTimer) {
    window.clearTimeout(typingTimer);
    typingTimer = null;
  }
  socket.disconnect();
});
</script>

<template>
  <section class="rps-shell">
    <header class="rps-hero">
      <div>
        <p class="rps-hero__eyebrow">Live Match</p>
        <h2>Rock Paper Scissors</h2>
        <p class="rps-hero__copy">현재 프로젝트 웹소켓으로 방을 만들고 바로 대결할 수 있는 멀티플레이 미니게임입니다.</p>
      </div>
      <div class="rps-hero__status">
        <span class="rps-pill" :class="`state-${connectionState}`">{{ connectionState }}</span>
        <span class="rps-pill is-room">{{ currentRoomId || "대기 중" }}</span>
      </div>
    </header>

    <div class="rps-layout">
      <section class="rps-board">
        <div v-if="!currentRoomId" class="rps-join">
          <label class="rps-field">
            <span>방 코드</span>
            <input v-model="roomInput" type="text" maxlength="24" placeholder="예: match-01" />
          </label>
          <button type="button" class="rps-primary-button" @click="joinRoom">방 입장</button>
          <p v-if="joinError" class="rps-error">{{ joinError }}</p>
          <p v-if="socketError" class="rps-error">{{ socketError }}</p>
        </div>

        <template v-else>
          <div class="rps-board__header">
            <div>
              <p class="rps-board__label">현재 방</p>
              <strong>{{ currentRoomId }}</strong>
            </div>
            <div class="rps-board__actions">
              <button type="button" class="rps-secondary-button" @click="resetRound">다시 하기</button>
              <button type="button" class="rps-secondary-button" @click="leaveRoom">방 나가기</button>
            </div>
          </div>

          <div class="rps-player-grid">
            <article class="rps-player-card" :class="{ 'is-me': myPlayer }">
              <p class="rps-player-card__label">나</p>
              <strong>{{ myPlayer?.nickname || "대기 중" }}</strong>
              <span>{{ myPlayer?.choiceLocked ? "선택 완료" : "선택 전" }}</span>
              <small>승 {{ myPlayer?.winCount || 0 }}</small>
            </article>
            <article class="rps-player-card">
              <p class="rps-player-card__label">상대</p>
              <strong>{{ opponentPlayer?.nickname || "상대 접속 대기" }}</strong>
              <span>{{ opponentPlayer?.choiceLocked ? "선택 완료" : "선택 전" }}</span>
              <small>승 {{ opponentPlayer?.winCount || 0 }}</small>
            </article>
          </div>

          <div class="rps-choices">
            <button
              v-for="choice in choiceCards"
              :key="choice.id"
              type="button"
              class="rps-choice-card"
              :class="{ 'is-active': selectedChoice === choice.id }"
              :disabled="!canSubmitChoice"
              @click="chooseCard(choice.id)"
            >
              <img :src="choice.image" :alt="choice.label" />
              <span>{{ choice.label }}</span>
            </button>
          </div>

          <div class="rps-result-card">
            <p class="rps-board__label">라운드 상태</p>
            <strong>{{ roomState.status }}</strong>
            <p>{{ resultSummary || "두 명이 모두 선택하면 결과가 표시됩니다." }}</p>
            <div v-if="roomState.result" class="rps-result-grid">
              <div>
                <span>승자</span>
                <strong>{{ roomState.result.winnerNickname || "무승부" }}</strong>
              </div>
              <div>
                <span>선택</span>
                <strong>{{ roomState.result.winnerChoice || "-" }}</strong>
              </div>
              <div>
                <span>패자 선택</span>
                <strong>{{ roomState.result.loserChoice || roomState.result.winnerChoice || "-" }}</strong>
              </div>
            </div>
          </div>
        </template>
      </section>

      <aside class="rps-chat-panel">
        <div class="rps-chat-panel__head">
          <div>
            <p class="rps-board__label">실시간 채팅</p>
            <strong>Room Chat</strong>
          </div>
          <span v-if="roomState.typingNickname" class="rps-typing">{{ roomState.typingNickname }} 입력 중...</span>
        </div>

        <div class="rps-chat-log">
          <div
            v-for="message in roomState.messages"
            :key="`${message.nickname}-${message.createdAt}-${message.message}`"
            class="rps-chat-message"
            :class="{ 'is-system': message.nickname === 'system', 'is-mine': Number(message.userIdx) === myUserId }"
          >
            <strong>{{ message.nickname }}</strong>
            <p>{{ message.message }}</p>
            <small>{{ formatTime(message.createdAt) }}</small>
          </div>
          <p v-if="!roomState.messages.length" class="rps-chat-empty">아직 메시지가 없습니다.</p>
        </div>

        <div class="rps-chat-form">
          <input
            v-model="chatInput"
            type="text"
            :disabled="!currentRoomId"
            placeholder="메시지를 입력하세요"
            @input="handleChatInput"
            @keyup.enter="submitChat"
          />
          <button type="button" class="rps-primary-button" :disabled="!currentRoomId" @click="submitChat">전송</button>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.rps-shell {
  height: 100%;
  min-height: 100%;
  overflow: auto;
  padding: 1rem;
  color: #eff7ff;
  background:
    radial-gradient(circle at top left, rgba(56, 189, 248, 0.12), transparent 24%),
    linear-gradient(180deg, rgba(4, 17, 29, 0.94), rgba(5, 11, 20, 0.98));
}

.rps-hero {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: flex-start;
  padding: 1.4rem 1.5rem;
  border-radius: 24px;
  background: rgba(8, 23, 38, 0.92);
  border: 1px solid rgba(118, 146, 173, 0.18);
}

.rps-hero__eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #7dd3fc;
}

.rps-hero h2 {
  margin: 0;
  font-size: 1.9rem;
}

.rps-hero__copy {
  margin: 0.45rem 0 0;
  max-width: 42rem;
  color: rgba(225, 236, 250, 0.78);
}

.rps-hero__status {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.rps-pill {
  padding: 0.45rem 0.85rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.14);
  font-weight: 700;
  text-transform: uppercase;
}

.state-connected {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

.state-connecting {
  background: rgba(250, 204, 21, 0.18);
  color: #fde68a;
}

.state-error {
  background: rgba(248, 113, 113, 0.16);
  color: #fca5a5;
}

.is-room {
  color: #cfe5ff;
}

.rps-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 0.9fr);
  gap: 1rem;
  margin-top: 1rem;
}

.rps-board,
.rps-chat-panel {
  border-radius: 24px;
  border: 1px solid rgba(118, 146, 173, 0.16);
  background: rgba(6, 16, 27, 0.94);
  box-shadow: 0 18px 52px rgba(1, 7, 14, 0.28);
}

.rps-board {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.rps-join {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  justify-content: center;
  min-height: 28rem;
}

.rps-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.rps-field span,
.rps-board__label {
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #7dd3fc;
}

.rps-field input,
.rps-chat-form input {
  width: 100%;
  border: 1px solid rgba(118, 146, 173, 0.18);
  border-radius: 14px;
  background: rgba(10, 24, 38, 0.92);
  color: #eff7ff;
  padding: 0.9rem 1rem;
}

.rps-primary-button,
.rps-secondary-button {
  border: 0;
  border-radius: 14px;
  font-weight: 700;
  cursor: pointer;
}

.rps-primary-button {
  padding: 0.9rem 1rem;
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  color: white;
}

.rps-secondary-button {
  padding: 0.75rem 0.95rem;
  background: rgba(148, 163, 184, 0.12);
  color: #eff7ff;
}

.rps-error {
  margin: 0;
  color: #fda4af;
}

.rps-board__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.rps-board__actions {
  display: flex;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.rps-player-grid,
.rps-result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.rps-player-card,
.rps-result-card {
  padding: 1rem;
  border-radius: 18px;
  background: rgba(12, 29, 46, 0.82);
  border: 1px solid rgba(118, 146, 173, 0.14);
}

.rps-player-card.is-me {
  border-color: rgba(56, 189, 248, 0.42);
}

.rps-player-card p,
.rps-result-card p {
  margin: 0 0 0.4rem;
}

.rps-player-card strong,
.rps-result-card strong {
  display: block;
  font-size: 1.1rem;
}

.rps-player-card span,
.rps-player-card small,
.rps-result-grid span {
  color: rgba(225, 236, 250, 0.72);
}

.rps-choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.9rem;
}

.rps-choice-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-height: 180px;
  border: 1px solid rgba(118, 146, 173, 0.14);
  border-radius: 20px;
  background: rgba(9, 24, 38, 0.9);
  color: #eff7ff;
}

.rps-choice-card.is-active {
  border-color: rgba(56, 189, 248, 0.46);
  box-shadow: 0 16px 30px rgba(56, 189, 248, 0.15);
}

.rps-choice-card img {
  width: 88px;
  height: 88px;
  object-fit: contain;
}

.rps-chat-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.rps-chat-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1.1rem 1.1rem 0;
}

.rps-typing {
  color: #93c5fd;
  font-size: 0.86rem;
}

.rps-chat-log {
  flex: 1;
  min-height: 18rem;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.1rem;
}

.rps-chat-message {
  padding: 0.85rem 0.9rem;
  border-radius: 16px;
  background: rgba(12, 29, 46, 0.82);
  border: 1px solid rgba(118, 146, 173, 0.14);
}

.rps-chat-message.is-system {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.2);
}

.rps-chat-message.is-mine {
  border-color: rgba(56, 189, 248, 0.32);
}

.rps-chat-message strong,
.rps-chat-message p,
.rps-chat-message small {
  display: block;
  margin: 0;
}

.rps-chat-message p {
  margin-top: 0.3rem;
  line-height: 1.45;
}

.rps-chat-message small {
  margin-top: 0.35rem;
  color: rgba(225, 236, 250, 0.6);
}

.rps-chat-empty {
  margin: auto 0;
  text-align: center;
  color: rgba(225, 236, 250, 0.56);
}

.rps-chat-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  padding: 0 1.1rem 1.1rem;
}

@media (max-width: 1080px) {
  .rps-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .rps-shell {
    padding: 0.75rem;
  }

  .rps-hero,
  .rps-board,
  .rps-chat-panel {
    border-radius: 18px;
  }

  .rps-player-grid,
  .rps-result-grid,
  .rps-choices,
  .rps-chat-form {
    grid-template-columns: 1fr;
  }
}
</style>
