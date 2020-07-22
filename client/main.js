import { connectToChannel, disconnect, playUrl, togglePlay } from "./actions";

const Page = {
  ChannelSelect: "CHANNEL_SELECT",
  Player: "PLAYER",
};

const channelNameEl = document.getElementById("ChannelName");
const channelSelectEl = document.getElementById("ChannelSelect");
const connectionEl = document.getElementById("Connection");
const mediaEl = document.getElementById("Media");
const mediaTitleEl = document.getElementById("MediaTitle");
const playerEl = document.getElementById("Player");
const playPauseEl = document.getElementById("PlayPause");
const playUrlEl = document.getElementById("PlayUrl");

let connectDelay = 2000;
let page = null;

const noop = () => {};
let send = noop;

function connect(fail) {
  const socket = new WebSocket("ws://localhost:5000");

  send = function (object) {
    socket.send(JSON.stringify(object));
  };

  function viewChannelSelect(state) {
    Array.from(channelSelectEl.children)
      .filter((e) => e instanceof HTMLButtonElement)
      .forEach((e) => channelSelectEl.removeChild(e));

    state.channels.forEach((channel) => {
      const button = document.createElement("button");

      const icon = document.createElement("img");
      icon.setAttribute("src", channel.iconUrl);
      button.appendChild(icon);

      const name = document.createElement("span");
      name.textContent = `Join ${channel.name}`;
      button.appendChild(name);

      button.addEventListener("click", () => {
        hide(channelSelectEl);
        page = null;
        send(connectToChannel(channel.id));
      });
      channelSelectEl.appendChild(button);
    });

    if (page !== Page.ChannelSelect) {
      hide(playerEl);
      show(channelSelectEl);
      page = Page.ChannelSelect;
    }
  }

  function viewPlayer(state) {
    channelNameEl.textContent = state.connectedChannel;

    if (state.mediaTitle) {
      playPauseEl.textContent = state.playing ? "Pause" : "Play";
      mediaTitleEl.textContent = state.mediaTitle;
      show(mediaEl);
    } else {
      hide(mediaEl);
    }

    if (page !== Page.Player) {
      hide(channelSelectEl);
      show(playerEl);
      page = Page.Player;
    }
  }

  socket.addEventListener("error", () => {
    fail();
  });

  socket.addEventListener("open", () => {
    socket.addEventListener("close", () => {
      console.log("WS connection closed");
      connectDelay = 2000;
      startConnection();
    });

    socket.addEventListener("message", (event) => {
      const state = JSON.parse(event.data);
      console.log(state); // FIXME
      if (state.online) {
        if (state.connectedChannel) {
          viewPlayer(state);
        } else if (state.channels.length > 0) {
          viewChannelSelect(state);
        } else {
          console.error("No channels to connect to");
          hide(channelSelectEl);
          hide(playerEl);
        }
      }
    });
  });
}

function disconnectChannel() {
  page = null;
  send(disconnect());
}

function hide(element) {
  element.classList.add("-hidden");
}

function promptPlayUrl() {
  const url = window.prompt("Enter URL");
  if (url) {
    send(playUrl(url));
  }
}

function show(element) {
  element.classList.remove("-hidden");
}

function startConnection() {
  connect(() => {
    window.setTimeout(startConnection, connectDelay);
    connectDelay += 2000;
  });
}

function togglePlayPause() {
  send(togglePlay());
}

connectionEl.addEventListener("click", disconnectChannel);
playPauseEl.addEventListener("click", togglePlayPause);
playUrlEl.addEventListener("click", promptPlayUrl);

if (module.hot) {
  module.hot.dispose(() => {
    connectionEl.removeEventListener("click", disconnectChannel);
    playPauseEl.removeEventListener("click", togglePlayPause);
    playUrlEl.removeEventListener("click", promptPlayUrl);
  });
}

startConnection();
