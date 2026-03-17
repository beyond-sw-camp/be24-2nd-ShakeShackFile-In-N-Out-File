import { reactive } from "vue";

export const FILE_SEARCH_ROUTE_NAMES = new Set([
  "home",
  "drive",
  "shareFile",
  "recentFile",
  "trash",
]);

export const FILE_SIZE_OPTIONS = [
  { label: "전체", value: "all" },
  { label: "10MB 이하", value: "lte10" },
  { label: "100MB 이하", value: "lte100" },
  { label: "1000MB 이하", value: "lte1000" },
  { label: "100000MB 이하", value: "lte100000" },
  { label: "100001MB 이상", value: "gte100001" },
  { label: "사용자 설정", value: "custom" },
];

export const FILE_STATUS_OPTIONS = [
  { label: "전체 상태", value: "all" },
  { label: "공유된 파일만", value: "shared" },
  { label: "내가 공유한 파일", value: "shared-owned" },
  { label: "공유받은 파일", value: "shared-with-me" },
  { label: "잠긴 파일만", value: "locked" },
  { label: "잠기지 않은 파일", value: "unlocked" },
];

const createDefaultSearchState = () => ({
  searchQuery: "",
  extensionFilter: "all",
  sizeFilter: "all",
  customMinSize: "",
  customMaxSize: "",
  statusFilter: "all",
  availableExtensions: [],
});

const searchStates = reactive({});

const normalizeScope = (scope) => String(scope || "files");

const normalizeExtensions = (extensions = []) => {
  return [...new Set(
    extensions
      .map((extension) => String(extension || "").trim().toLowerCase())
      .filter(Boolean),
  )].sort((left, right) => left.localeCompare(right));
};

const ensureScopeState = (scope) => {
  const normalizedScope = normalizeScope(scope);

  if (!searchStates[normalizedScope]) {
    searchStates[normalizedScope] = createDefaultSearchState();
  }

  return searchStates[normalizedScope];
};

export const isFileSearchRoute = (routeName) => {
  return FILE_SEARCH_ROUTE_NAMES.has(String(routeName || ""));
};

export const getFileSearchScope = (routeName) => {
  return isFileSearchRoute(routeName) ? String(routeName) : null;
};

export function useHeaderSearchStore() {
  const getScopeState = (scope) => ensureScopeState(scope);

  const setAvailableExtensions = (scope, extensions) => {
    const state = ensureScopeState(scope);
    state.availableExtensions = normalizeExtensions(extensions);

    if (
      state.extensionFilter !== "all" &&
      !state.availableExtensions.includes(state.extensionFilter)
    ) {
      state.extensionFilter = "all";
    }
  };

  const resetScope = (scope) => {
    const state = ensureScopeState(scope);
    const availableExtensions = [...state.availableExtensions];

    Object.assign(state, createDefaultSearchState(), {
      availableExtensions,
    });
  };

  return {
    getScopeState,
    setAvailableExtensions,
    resetScope,
  };
}