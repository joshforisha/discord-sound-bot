import Dotenv from 'dotenv'
import Store from 'electron-store'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'
import { BrowserWindow, Menu, app, dialog, ipcMain } from 'electron'
import { ChannelType, Client, GatewayIntentBits } from 'discord.js'
import {
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel
} from '@discordjs/voice'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

Dotenv.config({
  path: app.isPackaged
    ? path.join(process.resourcesPath, '.env')
    : path.resolve(process.cwd(), '.env')
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

const store = new Store()
if (!store.get('sourcePath')) {
  store.set('sourcePath', path.resolve('./'))
}

let channelConnection
let player
let disconnect = noop
let resource
let volume = 0.125
let window = null

function createWindow() {
  window = new BrowserWindow({
    height: 600,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, './preload.js')
    },
    width: 900
  })
  // window.webContents.openDevTools()

  window.loadURL(
    url.format({
      pathname: path.join(__dirname, './index.html'),
      protocol: 'file:',
      slashes: true
    })
  )

  window.on('closed', () => {
    window = null
  })
}

function getSounds() {
  return fs
    .readdirSync(store.get('sourcePath'))
    .filter((filename) => !filename.startsWith('.'))
    .reduce((xs, filename) => {
      const name = path.basename(filename, path.extname(filename))
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

      store.set('sourcePath', selection.filePaths.at(0))
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
    const stream = fs.createReadStream(
      `${store.get('sourcePath')}/${soundFile}`
    )
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
