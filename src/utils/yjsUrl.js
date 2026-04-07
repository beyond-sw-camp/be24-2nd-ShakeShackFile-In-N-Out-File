const trimTrailingSlash = (value) => String(value || '').replace(/\/+$/, '')

const normalizeBaseUrl = (value) => {
  const trimmed = trimTrailingSlash(String(value || '').trim())

  if (!trimmed) {
    return '/wss'
  }

  if (/^wss?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export const getYjsWebsocketUrl = () => {
  const configured = normalizeBaseUrl(
    import.meta.env.VITE_YJS_WS_URL || import.meta.env.VITE_YJS_URL || '/wss',
  )

  if (/^wss?:\/\//i.test(configured)) {
    return configured
  }

  if (typeof window === 'undefined') {
    return configured
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}${configured}`
}
