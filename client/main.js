import {
  connectToChannel,
  disconnect,
  playSound,
  playUrl,
  setVolume,
  togglePlay
} from './actions.js'

const Page = {
  ChannelSelect: 'CHANNEL_SELECT',
  Player: 'PLAYER'
}

const channelSelectDiv = document.getElementById('ChannelSelect')
const playerDiv = document.getElementById('Player')
const currentChannelButton = document.getElementById('CurrentChannel')
const librarySection = document.getElementById('Library')
const playYoutubeButton = document.getElementById('PlayYoutube')
const volumeInput = document.getElementById('Volume')

const currentChannelIcon = currentChannelButton.querySelector('.icon')
const currentChannelName = currentChannelButton.querySelector('.name')

let connectDelay = 2000
let page = null

const noop = () => {}
let send = noop

function connect(fail) {
  const socket = new window.WebSocket('ws://localhost:5005')

  send = function (object) {
    socket.send(JSON.stringify(object))
  }

  function viewChannelSelect(state) {
    if (page !== Page.ChannelSelect) {
      hide(playerDiv)
      show(channelSelectDiv)
      page = Page.ChannelSelect
    }

    Array.from(channelSelectDiv.children)
      .filter((e) => e instanceof window.HTMLButtonElement)
      .forEach((e) => channelSelectDiv.removeChild(e))

    state.channels.forEach((channel) => {
      const button = document.createElement('button')
      button.classList.add('-success')

      const icon = document.createElement('img')
      icon.setAttribute('src', channel.iconUrl)
      button.appendChild(icon)

      const name = document.createElement('span')
      name.textContent = channel.name
      button.appendChild(name)

      const action = document.createElement('span')
      action.classList.add('action')
      action.textContent = 'Join ⟩'
      button.appendChild(action)

      button.addEventListener('click', () => {
        hide(channelSelectDiv)
        page = null
        send(connectToChannel(channel.id))
      })
      channelSelectDiv.appendChild(button)
    })
  }

  function viewPlayer(state) {
    if (page !== Page.Player) {
      Array.from(librarySection.querySelectorAll('button.-sound')).forEach(
        (button) => librarySection.removeChild(button)
      )

      state.sounds.forEach((name) => {
        const button = document.createElement('button')
        button.classList.add('-sound')
        button.setAttribute('data-name', name)

        const nameSpan = document.createElement('span')
        nameSpan.textContent = name
        button.appendChild(nameSpan)

        button.addEventListener('click', () => {
          const status = button.getAttribute('data-status')
          if (status === 'paused' || status === 'playing') {
            send(togglePlay())
          } else {
            send(playSound(name))
          }
        })

        librarySection.appendChild(button)
      })

      hide(channelSelectDiv)
      show(playerDiv)
      page = Page.Player
    }

    currentChannelIcon.setAttribute('src', state.currentChannel.iconUrl)
    currentChannelName.textContent = state.currentChannel.name

    if ('currentMedia' in state) {
      Array.from(librarySection.querySelectorAll('button')).forEach(
        (button) => {
          if (button.getAttribute('data-name') === state.currentMedia) {
            if (state.playing) button.setAttribute('data-status', 'playing')
            else button.setAttribute('data-status', 'paused')
          } else button.removeAttribute('data-status')
        }
      )
    }
  }

  socket.addEventListener('error', () => {
    fail()
  })

  socket.addEventListener('open', () => {
    socket.addEventListener('close', () => {
      console.log('WS connection closed')
      page = null
      hide(channelSelectDiv)
      hide(playerDiv)
      connectDelay = 2000
      startConnection()
    })

    socket.addEventListener('message', (event) => {
      const state = JSON.parse(event.data)

      if (state.online) {
        if (state.currentChannel) {
          viewPlayer(state)
        } else if (state.channels.length > 0) {
          viewChannelSelect(state)
        } else {
          console.error('No channels to connect to')
          hide(channelSelectDiv)
          hide(playerDiv)
        }
      }

      if ('volume' in state) {
        volumeInput.value = state.volume
      }
    })
  })
}

function disconnectChannel() {
  page = null
  hide(channelSelectDiv)
  hide(playerDiv)
  send(disconnect())
}

function hide(element) {
  element.setAttribute('hidden', '')
}

function promptPlayUrl() {
  const url = window.prompt('Enter URL')
  if (url) {
    send(playUrl(url))
  }
}

function show(element) {
  element.removeAttribute('hidden')
}

function startConnection() {
  connect(() => {
    window.setTimeout(startConnection, connectDelay)
    connectDelay += 2000
  })
}

function updateVolume(event) {
  send(setVolume(event.target.value))
}

currentChannelButton.addEventListener('click', disconnectChannel)
playYoutubeButton.addEventListener('click', promptPlayUrl)
volumeInput.addEventListener('change', updateVolume)

startConnection()
