const url = require('node:url')
const { BrowserWindow, Menu, app, dialog, ipcMain } = require('electron')
const { ChannelType, Client, GatewayIntentBits } = require('discord.js')
const { basename, extname, join, resolve } = require('node:path')
const { contextBridge } = require('electron/renderer')
const { createReadStream, readdirSync } = require('node:fs')
const {
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel
} = require('@discordjs/voice')

require('dotenv').config({
  path: app.isPackaged
    ? join(process.resourcesPath, '.env')
    : resolve(process.cwd(), '.env')
})

const discordClient = new Client({
  intents: [GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.Guilds]
})

const connectedToDiscord = new Promise((resolve) => {
  discordClient.on('ready', () => {
    resolve()
  })
})

const noop = () => {}

const opusOptions = {
  inlineVolume: true,
  inputType: StreamType.OggOpus
}

let channelConnection
let player
let disconnect = noop
let resource
let sourcePath = resolve('./sounds')
let volume = 0.125
let window = null

function createWindow() {
  window = new BrowserWindow({
    height: 600,
    webPreferences: {
      contextIsolation: true,
      preload: join(__dirname, './preload.js')
    },
    width: 1200
  })
  window.webContents.openDevTools()

  window.loadURL(
    url.format({
      pathname: join(__dirname, './index.html'),
      protocol: 'file:',
      slashes: true
    })
  )

  window.on('closed', () => {
    window = null
  })
}

function getSounds() {
  return readdirSync(sourcePath)
    .filter((filename) => !filename.startsWith('.'))
    .reduce((xs, filename) => {
      const name = basename(filename, extname(filename))
      xs[name] = filename
      return xs
    }, {})
}

app.on('activate', () => {
  if (window === null) {
    createWindow()
  }
})

app.on('ready', () => {
  ipcMain.handle('changeSource', async () => {
    return new Promise(async (resolve, reject) => {
      const selection = await dialog.showOpenDialog({
        properties: ['openDirectory']
      })
      if (selection === undefined) return reject('Undefined directory')
      if (selection.canceled === true) return reject('Canceled')
      if (selection.filePaths?.length !== 1)
        return reject('Weird directory selection')

      sourcePath = selection.filePaths.at(0)
      resolve(getSounds())
    })
  })

  ipcMain.handle('connectToChannel', async (_, channelId) => {
    await connectedToDiscord
    const channel = discordClient.channels.cache.find((c) => c.id === channelId)

    return new Promise((resolve, reject) => {
      channelConnection = joinVoiceChannel({
        adapterCreator: channel.guild.voiceAdapterCreator,
        channelId,
        guildId: channel.guildId
      })

      channelConnection.once('error', (error) => {
        console.warn(error)
        reject(error)
      })

      channelConnection.on(VoiceConnectionStatus.Ready, () => {
        player = createAudioPlayer()
        const subscription = channelConnection.subscribe(player)

        player.on('error', (error) => {
          console.warn(error)
        })

        disconnect = () => {
          // discordClient.user.setActivity(null)
          subscription.unsubscribe()
          channelConnection.destroy()
          disconnect = noop
        }

        resolve({
          channel: {
            iconUrl: channel.guild.iconURL(),
            id: channel.id,
            name: `${channel.guild.name} – ${channel.name}`
          },
          sounds: getSounds(),
          volume
        })
      })
    })
  })

  ipcMain.handle('disconnect', () => {
    disconnect()
    return Promise.resolve()
  })

  ipcMain.handle('getServerChannels', async () => {
    await connectedToDiscord
    return discordClient.channels.cache
      .filter((c) => c.type === ChannelType.GuildVoice)
      .map((c) => ({
        iconUrl: c.guild.iconURL(),
        id: c.id,
        name: `${c.guild.name} – ${c.name}`
      }))
      .sort((a, b) => (a.name < b.name ? -1 : 1))
  })

  ipcMain.handle('playSound', async (_, soundFile, update = false) => {
    await connectedToDiscord
    const stream = createReadStream(`${sourcePath}/${soundFile}`)
    resource = createAudioResource(stream, opusOptions)

    player.once(AudioPlayerStatus.Idle, () => {
      playSound(soundFile)
    })

    resource.volume.setVolume(volume)
    player.play(resource)

    if (update) {
      return new Promise((resolve) => {
        player.once(AudioPlayerStatus.Playing, () => {
          // discordClient.user.setActivity(state.currentMedia, { type: 'LISTENING' })
          resolve()
        })
      })
    }
  })

  ipcMain.handle('setVolume', (_, newVolume) => {
    volume = newVolume
    if (resource) resource.volume.setVolume(newVolume)
    return Promise.resolve()
  })

  ipcMain.handle('togglePlay', () => {
    if (player) {
      if (player.state.status === AudioPlayerStatus.Playing) {
        player.pause()
      } else if (player.state.status === AudioPlayerStatus.Paused) {
        player.unpause()
      }
    }
    return Promise.resolve(player?.state.status)
  })

  createWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

discordClient.login(process.env.BOT_TOKEN)
