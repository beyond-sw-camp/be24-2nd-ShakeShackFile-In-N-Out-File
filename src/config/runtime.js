const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const FRONTEND_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_FRONTEND_BASE_URL || "http://localhost:5173",
);

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080",
);

export const SOCKET_BASE_URL = `${API_BASE_URL}/ws-stomp`;
