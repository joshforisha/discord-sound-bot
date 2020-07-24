require("dotenv").config();

const Discord = require("discord.js");
const fs = require("fs");
const path = require("path");
const WS = require("ws");
const ytdl = require("ytdl-core-discord");

const port = 5000;

const discordClient = new Discord.Client();
const noop = () => {};

let conn;
let dispatcher;
let disconnect = noop;
let send = noop;
let sounds = [];

let state = {
  channels: [],
  currentChannel: null,
  currentMedia: null,
  online: false,
  playing: false,
  sounds: [],
  volume: 0.5,
};

process.on("SIGINT", () => {
  state.online = false;
  send(state);
  discordClient.destroy();
  console.log("Disconnected");
  process.exit(0);
});

discordClient.on("ready", () => {
  const wss = new WS.Server({ port });

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

      sounds = fs
        .readdirSync("sounds")
        .filter((filename) => !filename.startsWith("."))
        .reduce((xs, filename) => {
          const name = path.basename(filename, path.extname(filename));
          xs[name] = filename;
          return xs;
        }, {});
      state.sounds = Object.keys(sounds);

      disconnect = () => {
        console.log("Disconnecting from voice channel");
        discordClient.user.setActivity(null);
        conn.disconnect();
        state.currentChannel = null;
        state.currentMedia = null;
        state.playing = false;
        state.sounds = [];
        send(state);
        disconnect = noop;
      };

      state.currentChannel = {
        iconUrl: voiceChannel.guild.iconURL(),
        id: voiceChannel.id,
        name: `${voiceChannel.guild.name} – ${voiceChannel.name}`,
      };
      send(state);
    }

    function playSound(soundName, update = false) {
      const filename = `./sounds/${sounds[soundName]}`;
      const stream = fs.createReadStream(filename);

      dispatcher = conn
        .play(stream, {
          bitrate: "auto",
          type: filename.endsWith(".ogg") ? "ogg/opus" : "unknown",
          volume: state.volume,
        })
        .on("finish", () => playSound(soundName));

      if (update) {
        state.currentMedia = soundName;
        state.playing = true;
        send(state);
        discordClient.user.setActivity(state.currentMedia, { type: "PLAYING" });
      }
    }

    async function playUrl(url, update = false) {
      let title;
      if (update) {
        try {
          const info = await ytdl.getBasicInfo(url);
          title = info.title;
        } catch (error) {
          sendError(error);
        }
      }

      let source;
      try {
        source = await ytdl(url, {
          quality: "highestaudio",
        });
      } catch (error) {
        sendError(error);
      }

      dispatcher = conn
        .play(source, { seek: 0, type: "opus", volume: state.volume })
        .on("finish", () => playUrl(url));

      if (update) {
        state.currentMedia = title;
        state.playing = true;
        send(state);
        discordClient.user.setActivity(state.currentMedia, { type: "PLAYING" });
      }
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

        case "PLAY_SOUND":
          playSound(action.sound, true);
          break;

        case "PLAY_URL":
          playUrl(action.url, true);
          break;

        case "SET_VOLUME":
          state.volume = action.volume;
          if (dispatcher) dispatcher.setVolume(action.volume);
          break;

        case "TOGGLE_PLAY":
          togglePlay();
          break;

        default:
          console.log("WS action received:", action);
      }
    });
  });

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

  console.log(`Listening on :${port}`);
});

discordClient.login(process.env["BOT_TOKEN"]);
