export const Action = {
  ConnectToChannel: "CONNECT_TO_CHANNEL",
  Disconnect: "DISCONNECT",
  PlayUrl: "PLAY_URL",
  TogglePlay: "TOGGLE_PLAY",
};

export function connectToChannel(channelId) {
  return { channelId, type: Action.ConnectToChannel };
}

export function disconnect() {
  return { type: Action.Disconnect };
}

export function playUrl(url) {
  return { type: Action.PlayUrl, url };
}

export function togglePlay() {
  return { type: Action.TogglePlay };
}
