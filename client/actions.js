export const Action = {
  ConnectToChannel: "CONNECT_TO_CHANNEL",
  Disconnect: "DISCONNECT",
  Pause: "PAUSE",
  Play: "PLAY",
  PlayUrl: "PLAY_URL",
};

export function connectToChannel(channelId) {
  return { channelId, type: Action.ConnectToChannel };
}

export function disconnect() {
  return { type: Action.Disconnect };
}

export function pause() {
  return { type: Action.Pause };
}

export function play() {
  return { type: Action.Play };
}

export function playUrl(url) {
  return { type: Action.PlayUrl, url };
}
