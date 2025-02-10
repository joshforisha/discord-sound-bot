const { Client, Intents } = require('discord.js')
const { basename, extname } = require('node:path')
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

const discordClient = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES]
})

const noop = () => {}

const opusOptions = {
  inlineVolume: true,
  inputType: StreamType.OggOpus
}

let channelConnection
let player
let playing // TODO: Replace this
let disconnect = noop
let resource
let volume = 0.125

const connectedToDiscord = new Promise((resolve) => {
  discordClient.on('ready', () => {
    resolve()
  })
})

contextBridge.exposeInMainWorld('discord', {
  connectToChannel: async (channelId) => {
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

        const sounds = readdirSync('sounds')
          .filter((filename) => !filename.startsWith('.'))
          .reduce((xs, filename) => {
            const name = basename(filename, extname(filename))
            xs[name] = filename
            return xs
          }, {})

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
          sounds,
          volume
        })
      })
    })
  },
  disconnect: () => {
    disconnect()
    return Promise.resolve()
  },
  getServerChannels: async () => {
    await connectedToDiscord
    return discordClient.channels.cache
      .filter((c) => c.type === 'GUILD_VOICE')
      .map((c) => ({
        iconUrl: c.guild.iconURL(),
        id: c.id,
        name: `${c.guild.name} – ${c.name}`
      }))
      .sort((a, b) => (a.name < b.name ? -1 : 1))
  },
  playSound: async (soundFile, update = false) => {
    await connectedToDiscord
    const stream = createReadStream(`./sounds/${soundFile}`)
    resource = createAudioResource(stream, opusOptions)

    player.once(AudioPlayerStatus.Idle, () => {
      playSound(soundFile)
    })

    resource.volume.setVolume(state.volume)
    player.play(resource)

    if (update) {
      return new Promise((resolve) => {
        player.once(AudioPlayerStatus.Playing, () => {
          // discordClient.user.setActivity(state.currentMedia, { type: 'LISTENING' })
          resolve()
        })
      })
    }
  },
  setVolume: (newVolume) => {
    volume = newVolume
    if (resource) resource.volume.setVolume(newVolume)
  },
  togglePlay: () => {
    if (playing) {
      player.pause()
      playing = false
    } else {
      player.unpause()
      playing = true
    }
    return Promise.resolve(playing)
  }
})

discordClient.login(process.env.BOT_TOKEN)
