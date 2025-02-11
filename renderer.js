const changeSourceButton = document.getElementById('ChangeSource')
const channelsPage = document.querySelector('[data-page="channels"]')
const currentChannelButton = document.getElementById('CurrentChannel')
const librarySection = document.getElementById('Library')
const playerPage = document.querySelector('[data-page="player"]')
const volumeInput = document.getElementById('Volume')

const currentChannelIcon = currentChannelButton.querySelector('.icon')
const currentChannelName = currentChannelButton.querySelector('.name')

async function connectToChannel(channelId) {
  await fadeOut(channelsPage)

  const { channel, sounds, volume } = await discord.connectToChannel(channelId)

  currentChannelIcon.setAttribute('src', channel.iconUrl)
  currentChannelName.textContent = channel.name

  updateSoundsLibrary(sounds)

  await fadeIn(playerPage)
}

function fadeIn(element) {
  return new Promise((resolve) => {
    element.removeAttribute('hidden')
    setTimeout(resolve, 250)
  })
}

function fadeOut(element) {
  return new Promise((resolve) => {
    element.setAttribute('hidden', '')
    setTimeout(resolve, 250)
  })
}

function hide(...elements) {
  elements.forEach((element) => {
    element.setAttribute('hidden', '')
  })
}

async function refreshChannels() {
  const channels = await discord.getServerChannels()
  updateChannelsList(channels)
  await fadeIn(channelsPage)
}

function show(...elements) {
  elements.forEach((element) => {
    element.removeAttribute('hidden')
  })
}

function updateChannelsList(channels) {
  channelsPage.innerHTML = ''

  channels.forEach((channel) => {
    const button = document.createElement('button')
    button.classList.add('success')

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
      connectToChannel(channel.id)
    })
    channelsPage.appendChild(button)
  })
}

function updateSoundsLibrary(sounds = {}) {
  librarySection.innerHTML = ''
  if (Object.entries(sounds).length < 1) {
    const emptyMessage = document.createElement('p')
    emptyMessage.classList.add('empty')
    emptyMessage.textContent = 'No sounds available.'
    librarySection.appendChild(emptyMessage)
    return
  }

  Object.entries(sounds).forEach(([name, file]) => {
    const button = document.createElement('button')
    button.classList.add('sound')

    const nameSpan = document.createElement('span')
    nameSpan.textContent = name
    button.appendChild(nameSpan)

    button.addEventListener('click', async () => {
      let status = button.getAttribute('data-status')
      if (status) status = await discord.togglePlay()
      else {
        const activeButton = document.querySelector('button[data-status]')
        if (activeButton) activeButton.removeAttribute('data-status')
        discord.playSound(file)
        status = 'playing'
      }
      button.setAttribute('data-status', status)
    })

    librarySection.appendChild(button)
  })
}

currentChannelButton.addEventListener('click', async () => {
  await fadeOut(playerPage)
  discord.disconnect()
  refreshChannels()
})

changeSourceButton.addEventListener('click', () => {
  discord
    .changeSource()
    .then((sounds) => {
      updateSoundsLibrary(sounds)
    })
    .catch((error) => {
      console.warn(error)
    })
})

volumeInput.addEventListener('change', (event) => {
  discord.setVolume(Number(event.target.value))
})

refreshChannels()
