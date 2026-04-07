const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '')

export const API_BASE_URL = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || '/api')

export const apiPath = (path = '') => {
  if (!path) {
    return API_BASE_URL
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${API_BASE_URL}${normalizedPath}`
}
