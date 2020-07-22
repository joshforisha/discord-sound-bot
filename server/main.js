require("dotenv").config();

const Discord = require("discord.js");
const WS = require("ws");
const ytdl = require("ytdl-core");

const port = 5000;

const discordClient = new Discord.Client();
const noop = () => {};
const wss = new WS.Server({ port });

let conn;
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
    console.log("Connecting to", channelId);
    const voiceChannel = discordClient.channels.cache
      .array()
      .find((channel) => channel.id === channelId);

    try {
      conn = await voiceChannel.join();
    } catch (error) {
      sendError(error);
    }

    disconnect = () => {
      console.log("Disconnecting from voice channel");
      conn.disconnect();
      state.connectedChannel = null;
      send(state);
      disconnect = noop;
    };

    state.connectedChannel = `${voiceChannel.guild.name} – ${voiceChannel.name}`;
    send(state);
  }

  async function playUrl(url) {
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
      const title = info.videoDetails.title;

      try {
        conn.play(source, {
          // type: "opus",
        });
      } catch (error) {
        sendError(error);
      }

      state.mediaTitle = title;
      state.playing = true;
      send(state);
    });
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
      .map((c) => ({ id: c.id, name: `${c.guild.name} – ${c.name}` })),
  };
});

discordClient.login(process.env["BOT_TOKEN"]);

console.log(`Listening on :${port}`);
