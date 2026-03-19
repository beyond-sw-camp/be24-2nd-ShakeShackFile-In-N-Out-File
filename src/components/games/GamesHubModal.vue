<script setup>
import { computed, ref, watch } from "vue";
import OpenHexagonArena from "@/legup/openhexagon/OpenHexagonArena.vue";
import RockPaperScissorsArena from "@/legup/rps/RockPaperScissorsArena.vue";

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  canAccess: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["close"]);

const gameCatalog = [
  {
    id: "openhexagon",
    name: "Open Hexagon Arena",
    description: "현재 웹소켓을 재사용하는 실시간 멀티플레이 서바이벌 게임",
    badge: "멀티플레이",
    accent: "is-live",
    type: "component",
  },
  {
    id: "ladder",
    name: "사다리 타기",
    description: "브라우저에서 바로 즐길 수 있는 빠른 사다리 게임",
    badge: "싱글플레이",
    accent: "is-casual",
    type: "iframe",
    path: "/legup/ladder/index.html",
  },
  {
    id: "roulette",
    name: "Roulette",
    description: "가볍게 돌려보는 웹 룰렛 미니게임",
    badge: "싱글플레이",
    accent: "is-casino",
    type: "iframe",
    path: "/legup/roulette/index.html",
  },
  {
    id: "rps",
    name: "Rock Paper Scissors",
    description: "방 코드를 만들어 실시간으로 붙는 가위바위보 대전 게임",
    badge: "멀티플레이",
    accent: "is-duel",
    type: "component",
  },
];

const selectedGameId = ref(gameCatalog[0].id);
const frameRefreshKey = ref(Date.now());
const isExpandedView = ref(true);
const isSidebarCollapsed = ref(false);

const selectedGame = computed(() => (
  gameCatalog.find((game) => game.id === selectedGameId.value) || gameCatalog[0]
));

const selectedGameFrameSrc = computed(() => {
  if (selectedGame.value.type !== "iframe") {
    return "";
  }

  return `${selectedGame.value.path}?t=${frameRefreshKey.value}`;
});

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) return;
    selectedGameId.value = gameCatalog[0].id;
    frameRefreshKey.value = Date.now();
    isExpandedView.value = true;
    isSidebarCollapsed.value = false;
  },
);

const selectGame = (gameId) => {
  selectedGameId.value = gameId;
  if (selectedGame.value.type === "iframe") {
    frameRefreshKey.value = Date.now();
  }
};

const reloadSelectedGame = () => {
  if (selectedGame.value.type !== "iframe") {
    return;
  }

  frameRefreshKey.value = Date.now();
};

const toggleExpandedView = () => {
  isExpandedView.value = !isExpandedView.value;
};

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value;
};

const handleBackdropClick = (event) => {
  if (event.target === event.currentTarget) {
    emit("close");
  }
};
</script>

<template>
  <div v-if="isOpen" class="games-hub-overlay" @click="handleBackdropClick">
    <section
      class="games-hub-modal"
      :class="{ 'is-expanded': isExpandedView, 'is-sidebar-collapsed': isSidebarCollapsed }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="games-hub-title"
    >
      <header class="games-hub-header">
        <div>
          <p class="games-hub-eyebrow">Premium Arcade</p>
          <h2 id="games-hub-title">Games</h2>
          <p class="games-hub-subtitle">프리미엄 이상 전용 미니게임 모음입니다.</p>
        </div>
        <div class="games-hub-header__actions">
          <button type="button" class="games-hub-icon-button" @click="toggleSidebar">
            {{ isSidebarCollapsed ? "목록 보기" : "목록 접기" }}
          </button>
          <button type="button" class="games-hub-icon-button" @click="toggleExpandedView">
            {{ isExpandedView ? "기본 크기" : "크게 보기" }}
          </button>
          <button
            v-if="selectedGame.type === 'iframe'"
            type="button"
            class="games-hub-icon-button"
            @click="reloadSelectedGame"
          >
            새로고침
          </button>
          <button type="button" class="games-hub-close" @click="emit('close')">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </header>

      <div v-if="canAccess" class="games-hub-body">
        <aside class="games-sidebar">
          <button
            v-for="game in gameCatalog"
            :key="game.id"
            type="button"
            class="games-sidebar__item"
            :class="{ 'is-active': selectedGameId === game.id }"
            @click="selectGame(game.id)"
          >
            <div class="games-sidebar__title-row">
              <strong>{{ game.name }}</strong>
              <span class="games-sidebar__badge" :class="game.accent">{{ game.badge }}</span>
            </div>
            <p>{{ game.description }}</p>
          </button>
        </aside>

        <div class="games-stage">
          <div class="games-stage__meta">
            <div>
              <p class="games-stage__label">{{ selectedGame.badge }}</p>
              <h3>{{ selectedGame.name }}</h3>
            </div>
            <p class="games-stage__description">{{ selectedGame.description }}</p>
          </div>

          <div class="games-stage__surface">
            <OpenHexagonArena v-if="selectedGame.id === 'openhexagon'" />
            <RockPaperScissorsArena v-else-if="selectedGame.id === 'rps'" />
            <iframe
              v-else
              :key="selectedGameFrameSrc"
              :src="selectedGameFrameSrc"
              class="games-stage__frame"
              title="game-frame"
            />
          </div>
        </div>
      </div>

      <div v-else class="games-hub-blocked">
        <h3>게임 이용 권한이 없습니다.</h3>
        <p>프리미엄 또는 관리자 계정에서만 게임 센터를 열 수 있습니다.</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.games-hub-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: rgba(5, 12, 20, 0.72);
  backdrop-filter: blur(10px);
}

.games-hub-modal {
  width: min(1320px, 100%);
  height: min(860px, calc(100vh - 3rem));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(120, 146, 172, 0.28);
  border-radius: 28px;
  background:
    radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 28%),
    linear-gradient(160deg, rgba(6, 18, 31, 0.96), rgba(8, 14, 24, 0.98));
  color: #eef7ff;
  box-shadow: 0 32px 120px rgba(3, 10, 18, 0.45);
}

.games-hub-modal.is-expanded {
  width: min(1500px, calc(100vw - 1rem));
  height: calc(100vh - 1rem);
}

.games-hub-modal.is-sidebar-collapsed .games-hub-body {
  grid-template-columns: minmax(0, 1fr);
}

.games-hub-modal.is-sidebar-collapsed .games-sidebar {
  display: none;
}

.games-hub-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.5rem 1.75rem 1.2rem;
  border-bottom: 1px solid rgba(120, 146, 172, 0.16);
}

.games-hub-eyebrow {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #7dd3fc;
}

.games-hub-header h2 {
  margin: 0;
  font-size: 2rem;
  font-weight: 700;
}

.games-hub-subtitle {
  margin: 0.35rem 0 0;
  color: rgba(226, 238, 255, 0.78);
}

.games-hub-header__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.games-hub-icon-button,
.games-hub-close {
  border: 1px solid rgba(125, 211, 252, 0.18);
  border-radius: 14px;
  background: rgba(9, 18, 31, 0.92);
  color: #eef7ff;
}

.games-hub-icon-button {
  padding: 0.75rem 1rem;
  font-weight: 600;
}

.games-hub-close {
  width: 44px;
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.games-hub-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
}

.games-sidebar {
  min-height: 0;
  overflow-y: auto;
  padding: 1.25rem;
  border-right: 1px solid rgba(120, 146, 172, 0.12);
  background: rgba(4, 13, 24, 0.72);
}

.games-sidebar__item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  margin-bottom: 0.9rem;
  text-align: left;
  border: 1px solid rgba(120, 146, 172, 0.16);
  border-radius: 18px;
  background: rgba(8, 19, 33, 0.84);
  color: #eef7ff;
  transition: transform 0.2s ease, border-color 0.2s ease, background-color 0.2s ease;
}

.games-sidebar__item:hover,
.games-sidebar__item.is-active {
  transform: translateY(-1px);
  border-color: rgba(125, 211, 252, 0.45);
  background: rgba(13, 30, 52, 0.92);
}

.games-sidebar__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.games-sidebar__item strong {
  font-size: 1rem;
}

.games-sidebar__item p {
  margin: 0;
  font-size: 0.92rem;
  line-height: 1.45;
  color: rgba(226, 238, 255, 0.78);
}

.games-sidebar__badge {
  padding: 0.28rem 0.65rem;
  border-radius: 999px;
  font-size: 0.74rem;
  font-weight: 700;
}

.games-sidebar__badge.is-live {
  background: rgba(34, 197, 94, 0.18);
  color: #86efac;
}

.games-sidebar__badge.is-casual {
  background: rgba(59, 130, 246, 0.18);
  color: #93c5fd;
}

.games-sidebar__badge.is-casino {
  background: rgba(244, 114, 182, 0.18);
  color: #f9a8d4;
}

.games-sidebar__badge.is-duel {
  background: rgba(250, 204, 21, 0.18);
  color: #fde68a;
}

.games-stage {
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 1.25rem 1.35rem 1.35rem;
  overflow: hidden;
}

.games-stage__meta {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1rem;
}

.games-stage__label {
  margin: 0 0 0.3rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: #7dd3fc;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.games-stage__meta h3 {
  margin: 0;
  font-size: 1.5rem;
}

.games-stage__description {
  max-width: 420px;
  margin: 0;
  text-align: right;
  color: rgba(226, 238, 255, 0.76);
}

.games-stage__surface {
  flex: 1;
  min-height: 0;
  border-radius: 22px;
  overflow: auto;
  background: rgba(2, 8, 15, 0.82);
  border: 1px solid rgba(120, 146, 172, 0.16);
}

.games-stage__frame {
  width: 100%;
  height: 100%;
  min-height: 900px;
  border: 0;
  background: #ffffff;
}

.games-hub-blocked {
  padding: 3rem 2rem;
  text-align: center;
}

.games-hub-blocked h3 {
  margin-bottom: 0.75rem;
}

.games-hub-blocked p {
  margin: 0;
  color: rgba(226, 238, 255, 0.76);
}

@media (max-width: 1024px) {
  .games-hub-overlay {
    padding: 1rem;
  }

  .games-hub-modal {
    height: min(920px, calc(100vh - 1.5rem));
  }

  .games-hub-body {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .games-sidebar {
    border-right: 0;
    border-bottom: 1px solid rgba(120, 146, 172, 0.12);
  }

  .games-stage__meta {
    flex-direction: column;
    align-items: flex-start;
  }

  .games-stage__description {
    max-width: none;
    text-align: left;
  }
}

@media (max-width: 640px) {
  .games-hub-header {
    padding: 1.2rem 1rem 1rem;
  }

  .games-hub-header h2 {
    font-size: 1.6rem;
  }

  .games-stage {
    padding: 1rem;
  }

  .games-stage__surface {
    border-radius: 16px;
  }
}
</style>
