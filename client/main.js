import { connectToChannel, disconnect, playUrl, togglePlay } from "./actions";

const Page = {
  ChannelSelect: "CHANNEL_SELECT",
  Player: "PLAYER",
};

const channelSelectDiv = document.getElementById("ChannelSelect");
const playerDiv = document.getElementById("Player");
const connectedChannelButton = document.getElementById("ConnectedChannel");
const mediaButton = document.getElementById("Media");
const playUrlButton = document.getElementById("PlayUrl");

const connectedChannelIcon = connectedChannelButton.querySelector(".icon");
const connectedChannelName = connectedChannelButton.querySelector(".name");
const mediaAction = mediaButton.querySelector(".action");
const mediaTitle = mediaButton.querySelector(".title");

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
    Array.from(channelSelectDiv.children)
      .filter((e) => e instanceof HTMLButtonElement)
      .forEach((e) => channelSelectDiv.removeChild(e));

    state.channels.forEach((channel) => {
      const button = document.createElement("button");

      const icon = document.createElement("img");
      icon.setAttribute("src", channel.iconUrl);
      button.appendChild(icon);

      const name = document.createElement("span");
      name.textContent = channel.name;
      button.appendChild(name);

      const action = document.createElement("span");
      action.classList.add("action");
      action.textContent = "Join";
      button.appendChild(action);

      button.addEventListener("click", () => {
        hide(channelSelectDiv);
        page = null;
        send(connectToChannel(channel.id));
      });
      channelSelectDiv.appendChild(button);
    });

    if (page !== Page.ChannelSelect) {
      hide(playerDiv);
      show(channelSelectDiv);
      page = Page.ChannelSelect;
    }
  }

  function viewPlayer(state) {
    connectedChannelIcon.setAttribute("src", state.connectedChannel.iconUrl);
    connectedChannelName.textContent = state.connectedChannel.name;

    if (state.mediaTitle) {
      mediaTitle.textContent = state.mediaTitle;
      mediaAction.textContent = state.playing ? "Pause" : "Play";
      show(mediaButton);
    } else {
      hide(mediaButton);
    }

    if (page !== Page.Player) {
      hide(channelSelectDiv);
      show(playerDiv);
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
          hide(channelSelectDiv);
          hide(playerDiv);
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

connectedChannelButton.addEventListener("click", disconnectChannel);
mediaButton.addEventListener("click", togglePlayPause);
playUrlButton.addEventListener("click", promptPlayUrl);

if (module.hot) {
  module.hot.dispose(() => {
    connectedChannelButton.removeEventListener("click", disconnectChannel);
    mediaButton.removeEventListener("click", togglePlayPause);
    playUrlButton.removeEventListener("click", promptPlayUrl);
  });
}

startConnection();
