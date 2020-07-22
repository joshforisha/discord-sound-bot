import { connectToChannel, disconnect, playUrl } from "./actions";

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
const playFileEl = document.getElementById("PlayFile");
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
      button.textContent = channel.name;
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
    console.log(state);

    if (state.playing) {
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
  element.style.display = "none";
}

function promptPlayUrl() {
  const url = window.prompt("Enter URL");
  if (url) {
    send(playUrl(url));
  }
}

function show(element) {
  element.style.display = "block";
}

function startConnection() {
  connect(() => {
    window.setTimeout(startConnection, connectDelay);
    connectDelay += 2000;
  });
}

connectionEl.addEventListener("click", disconnectChannel);
playUrlEl.addEventListener("click", promptPlayUrl);

if (module.hot) {
  module.hot.dispose(() => {
    connectionEl.removeEventListener("click", disconnectChannel);
    playUrlEl.removeEventListener("click", promptPlayUrl);
  });
}

startConnection();
