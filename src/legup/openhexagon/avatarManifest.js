export const OPEN_HEXAGON_AVATARS = Array.from({ length: 13 }, (_, index) => {
  const fileNumber = String(index + 1).padStart(2, '0')
  return `/legup/openhexagon/avatars/avatar-${fileNumber}.png`
})

export const OPEN_HEXAGON_COLORS = [
  '#59d6ff',
  '#ff9261',
  '#ff4f88',
  '#7dffb2',
  '#ffd166',
  '#8f9dff',
  '#7cffe6',
  '#ffa5d8',
  '#95ff73',
  '#f8a3ff',
  '#8ce9ff',
  '#ffb86c',
  '#b7ff7a',
]

export const getOpenHexagonAvatarSrc = (avatarIndex = 0) => {
  const normalizedIndex =
    ((Number(avatarIndex) || 0) % OPEN_HEXAGON_AVATARS.length + OPEN_HEXAGON_AVATARS.length) %
    OPEN_HEXAGON_AVATARS.length

  return OPEN_HEXAGON_AVATARS[normalizedIndex]
}

export const pickOpenHexagonProfile = (seed = 0) => {
  const normalizedSeed = Math.abs(Math.trunc(Number(seed) || 0))
  const avatarIndex = normalizedSeed % OPEN_HEXAGON_AVATARS.length
  const accentColor = OPEN_HEXAGON_COLORS[normalizedSeed % OPEN_HEXAGON_COLORS.length]

  return {
    avatarIndex,
    accentColor,
    avatarSrc: getOpenHexagonAvatarSrc(avatarIndex),
  }
}
