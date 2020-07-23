require("dotenv").config();

const Discord = require("discord.js");
const WS = require("ws");
const ytdl = require("ytdl-core");

const port = 5000;

const discordClient = new Discord.Client();
const noop = () => {};
const wss = new WS.Server({ port });

let conn;
let dispatcher;
let disconnect = noop;
let send = noop;

let state = {
  channels: [],
  connectedChannel: null,
  mediaTitle: null,
  online: false,
  playing: false,
};

process.on("SIGINT", () => {
  state.online = false;
  send(state);
  discordClient.destroy();
  console.log("Disconnected");
  process.exit(0);
});

wss.on("connection", (ws) => {
  async function connectToVoiceChannel(channelId) {
    const voiceChannel = discordClient.channels.cache
      .array()
      .find((channel) => channel.id === channelId);

    try {
      conn = await voiceChannel.join();
    } catch (error) {
      sendError(error);
    }

    discordClient.user.setActivity("commands", { type: "LISTENING" });

    disconnect = () => {
      console.log("Disconnecting from voice channel");
      conn.disconnect();
      state.connectedChannel = null;
      send(state);
      disconnect = noop;
    };

    state.connectedChannel = {
      iconUrl: voiceChannel.guild.iconURL(),
      id: voiceChannel.id,
      name: `${voiceChannel.guild.name} – ${voiceChannel.name}`,
    };
    send(state);
  }

  async function playUrl(url, update = true) {
    let source;
    try {
      source = ytdl(url, {
        liveBuffer: 5000,
        quality: "highestaudio",
      });
    } catch (error) {
      sendError(error);
    }

    source.on("info", (info) => {
      dispatcher = conn
        .play(source, { volume: 0.25 })
        .on("finish", () => playUrl(url, false));

      if (update) {
        state.mediaTitle = info.videoDetails.title;
        state.playing = true;
        send(state);
        discordClient.user.setActivity(state.mediaTitle, { type: "PLAYING" });
      }
    });
  }

  function togglePlay() {
    if (state.playing) {
      state.playing = false;
      if (dispatcher) dispatcher.pause();
    } else {
      state.playing = true;
      if (dispatcher) dispatcher.resume();
    }
    send(state);
  }

  send = function (object) {
    ws.send(JSON.stringify(object));
  };

  function sendError(error) {
    console.error(error);
    send({ error });
  }

  send(state);

  ws.on("close", () => {
    console.log("WS Disconnected");
    send = noop;
  });

  ws.on("message", (message) => {
    const action = JSON.parse(message);

    switch (action.type) {
      case "CONNECT_TO_CHANNEL":
        connectToVoiceChannel(action.channelId);
        break;

      case "DISCONNECT":
        disconnect();
        break;

      case "PLAY_URL":
        playUrl(action.url);
        break;

      case "TOGGLE_PLAY":
        togglePlay();
        break;

      default:
        console.log("WS action received:", action);
    }
  });
});

discordClient.on("ready", () => {
  state = {
    ...state,
    online: true,
    channels: discordClient.channels.cache
      .array()
      .filter((c) => c.type === "voice")
      .map((c) => ({
        iconUrl: c.guild.iconURL(),
        id: c.id,
        name: `${c.guild.name} – ${c.name}`,
      }))
      .sort((a, b) => (a.name < b.name ? -1 : 1)),
  };
});

discordClient.login(process.env["BOT_TOKEN"]);

console.log(`Listening on :${port}`);
