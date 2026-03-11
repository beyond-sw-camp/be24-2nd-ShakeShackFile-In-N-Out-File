import { ref, watch } from "vue";

const VIEW_MODE_KEY = "file-view-mode";
const GRID_SIZE_KEY = "file-grid-size";
const DEFAULT_VIEW_MODE = "table";
const DEFAULT_GRID_SIZE = "medium";
const GRID_SIZE_SET = new Set(["small", "medium", "large"]);

const readStorageValue = (key, fallback) => {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.localStorage.getItem(key) || fallback;
};

const normalizeViewMode = (mode) => {
  return mode === "grid" ? "grid" : DEFAULT_VIEW_MODE;
};

const normalizeGridSize = (size) => {
  return GRID_SIZE_SET.has(size) ? size : DEFAULT_GRID_SIZE;
};

const viewMode = ref(normalizeViewMode(readStorageValue(VIEW_MODE_KEY, DEFAULT_VIEW_MODE)));
const gridSize = ref(normalizeGridSize(readStorageValue(GRID_SIZE_KEY, DEFAULT_GRID_SIZE)));

watch(viewMode, (value) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(VIEW_MODE_KEY, normalizeViewMode(value));
  }
});

watch(gridSize, (value) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(GRID_SIZE_KEY, normalizeGridSize(value));
  }
});

export function useViewStore() {
  const setViewMode = (mode) => {
    viewMode.value = normalizeViewMode(mode);
  };

  const toggleViewMode = () => {
    viewMode.value = viewMode.value === "table" ? "grid" : "table";
  };

  const setGridSize = (size) => {
    gridSize.value = normalizeGridSize(size);
  };

  return {
    viewMode,
    gridSize,
    setViewMode,
    toggleViewMode,
    setGridSize,
  };
}
