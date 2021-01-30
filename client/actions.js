export const Action = {
  ConnectToChannel: 'CONNECT_TO_CHANNEL',
  Disconnect: 'DISCONNECT',
  PlaySound: 'PLAY_SOUND',
  PlayUrl: 'PLAY_URL',
  SetVolume: 'SET_VOLUME',
  TogglePlay: 'TOGGLE_PLAY'
}

export function connectToChannel (channelId) {
  return { channelId, type: Action.ConnectToChannel }
}

export function disconnect () {
  return { type: Action.Disconnect }
}

export function playSound (sound) {
  return { sound, type: Action.PlaySound }
}

export function playUrl (url) {
  return { type: Action.PlayUrl, url }
}

export function setVolume (volume) {
  return { type: Action.SetVolume, volume }
}

export function togglePlay () {
  return { type: Action.TogglePlay }
}
