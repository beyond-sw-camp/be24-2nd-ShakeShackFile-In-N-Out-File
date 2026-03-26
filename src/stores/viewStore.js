import { computed, ref, watch } from "vue";

const VIEW_MODE_KEY = "file-view-mode";
const GRID_SIZE_KEY = "file-grid-size";
const GRID_CUSTOM_COLUMNS_KEY = "file-grid-custom-columns";
const LAYOUT_PRESET_KEY = "file-layout-preset";
const LAYOUT_COLUMNS_KEY = "file-layout-columns";
const LAYOUT_ROWS_KEY = "file-layout-rows";

const DEFAULT_VIEW_MODE = "table";
const DEFAULT_LAYOUT_PRESET = "10";
const DEFAULT_LAYOUT_COLUMNS = 5;
const DEFAULT_LAYOUT_ROWS = 2;

const VIEW_MODE_SET = new Set(["table", "grid", "icon"]);
const LAYOUT_PRESET_SET = new Set(["10", "20", "30"]);
const LAYOUT_PRESETS = {
  "10": { columns: 5, rows: 2 },
  "20": { columns: 5, rows: 4 },
  "30": { columns: 5, rows: 6 },
};

const LEGACY_LAYOUT_PRESET_MAP = {
  xsmall: "10",
  small: "20",
  medium: "30",
  large: "30",
  custom: "30",
  "5": "10",
  "10": "20",
  "15": "30",
  "5x10": "30",
  "10x10": "30",
  "15x15": "30",
};

const readStorageValue = (key, fallback) => {
  if (typeof window === "undefined") {
    return fallback;
  }

  return window.localStorage.getItem(key) || fallback;
};

const normalizeViewMode = (mode) => {
  return VIEW_MODE_SET.has(mode) ? mode : DEFAULT_VIEW_MODE;
};

const normalizeLayoutPreset = (value) => {
  const normalized = String(value ?? "").trim();

  if (LAYOUT_PRESET_SET.has(normalized)) {
    return normalized;
  }

  if (LEGACY_LAYOUT_PRESET_MAP[normalized]) {
    return LEGACY_LAYOUT_PRESET_MAP[normalized];
  }

  return DEFAULT_LAYOUT_PRESET;
};

const normalizeLayoutCount = (value, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(20, Math.max(5, Math.round(parsed)));
};

const viewMode = ref(normalizeViewMode(readStorageValue(VIEW_MODE_KEY, DEFAULT_VIEW_MODE)));
const layoutPreset = ref(
  normalizeLayoutPreset(
    readStorageValue(
      LAYOUT_PRESET_KEY,
      readStorageValue(GRID_SIZE_KEY, DEFAULT_LAYOUT_PRESET),
    ),
  ),
);
const customLayoutColumns = ref(
  normalizeLayoutCount(
    readStorageValue(
      LAYOUT_COLUMNS_KEY,
      readStorageValue(GRID_CUSTOM_COLUMNS_KEY, DEFAULT_LAYOUT_COLUMNS),
    ),
    DEFAULT_LAYOUT_COLUMNS,
  ),
);
const customLayoutRows = ref(
  normalizeLayoutCount(
    readStorageValue(LAYOUT_ROWS_KEY, DEFAULT_LAYOUT_ROWS),
    DEFAULT_LAYOUT_ROWS,
  ),
);

const resolvedLayout = computed(() => {
  return LAYOUT_PRESETS[layoutPreset.value] || LAYOUT_PRESETS[DEFAULT_LAYOUT_PRESET];
});

const resolvedLayoutColumns = computed(() => resolvedLayout.value.columns);
const resolvedLayoutRows = computed(() => resolvedLayout.value.rows);
const resolvedPageSize = computed(() => resolvedLayoutColumns.value * resolvedLayoutRows.value);

const gridSize = computed(() => String(resolvedPageSize.value));
const customGridColumns = computed(() => customLayoutColumns.value);
const resolvedGridColumns = computed(() => resolvedLayoutColumns.value);

watch(viewMode, (value) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(VIEW_MODE_KEY, normalizeViewMode(value));
  }
});

watch(layoutPreset, (value) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LAYOUT_PRESET_KEY, normalizeLayoutPreset(value));
    window.localStorage.setItem(GRID_SIZE_KEY, normalizeLayoutPreset(value));
  }
});

watch(customLayoutColumns, (value) => {
  if (typeof window !== "undefined") {
    const normalized = normalizeLayoutCount(value, DEFAULT_LAYOUT_COLUMNS);
    window.localStorage.setItem(LAYOUT_COLUMNS_KEY, String(normalized));
    window.localStorage.setItem(GRID_CUSTOM_COLUMNS_KEY, String(normalized));
  }
});

watch(customLayoutRows, (value) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      LAYOUT_ROWS_KEY,
      String(normalizeLayoutCount(value, DEFAULT_LAYOUT_ROWS)),
    );
  }
});

export function useViewStore() {
  const setViewMode = (mode) => {
    viewMode.value = normalizeViewMode(mode);
  };

  const toggleViewMode = () => {
    viewMode.value = viewMode.value === "table" ? "grid" : "table";
  };

  const setLayoutPreset = (preset) => {
    layoutPreset.value = normalizeLayoutPreset(preset);
  };

  const setCustomLayoutColumns = (value) => {
    customLayoutColumns.value = normalizeLayoutCount(value, DEFAULT_LAYOUT_COLUMNS);
    layoutPreset.value = "custom";
  };

  const setCustomLayoutRows = (value) => {
    customLayoutRows.value = normalizeLayoutCount(value, DEFAULT_LAYOUT_ROWS);
    layoutPreset.value = "custom";
  };

  const setGridSize = (size) => {
    layoutPreset.value = normalizeLayoutPreset(size);
  };

  const setCustomGridColumns = (value) => {
    setCustomLayoutColumns(value);
  };

  return {
    viewMode,
    layoutPreset,
    customLayoutColumns,
    customLayoutRows,
    resolvedLayoutColumns,
    resolvedLayoutRows,
    resolvedPageSize,
    gridSize,
    customGridColumns,
    resolvedGridColumns,
    setViewMode,
    toggleViewMode,
    setLayoutPreset,
    setCustomLayoutColumns,
    setCustomLayoutRows,
    setGridSize,
    setCustomGridColumns,
  };
}
