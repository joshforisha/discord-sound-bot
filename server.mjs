import Discord from 'discord.js'
import dotenv from 'dotenv'
import path from 'path'
import { WebSocketServer } from 'ws'
import { createReadStream, readdirSync } from 'fs'
import {
  AudioPlayerStatus,
  StreamType,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel
} from '@discordjs/voice'

dotenv.config()

const noop = () => {}
const port = 5000

const opusOptions = {
  inlineVolume: true,
  inputType: StreamType.OggOpus
}

const discordClient = new Discord.Client({
  intents: [
    Discord.Intents.FLAGS.GUILDS,
    Discord.Intents.FLAGS.GUILD_VOICE_STATES
  ]
})

let connection
let player
let disconnect = noop
let resource
let send = noop
let sounds = []

let state = {
  channels: [],
  currentChannel: null,
  currentMedia: null,
  online: false,
  playing: false,
  sounds: [],
  volume: 0.25
}

process.on('SIGINT', () => {
  state.online = false
  send(state)
  discordClient.destroy()
  console.log('Disconnected')
  process.exit(0)
})

discordClient.on('ready', () => {
  const wss = new WebSocketServer({ port })

  wss.on('connection', (ws) => {
    function connectToVoiceChannel (channelId) {
      const channel = discordClient.channels.cache
        .find(c => c.id === channelId)

      connection = joinVoiceChannel({
        adapterCreator: channel.guild.voiceAdapterCreator,
        channelId,
        guildId: channel.guildId
      })

      connection.on('error', error => {
        sendError(error)
      })

      connection.on(VoiceConnectionStatus.Ready, () => {
        player = createAudioPlayer()
        const subscription = connection.subscribe(player)

        player.on('error', error => {
          console.error(error)
        })

        sounds = readdirSync('sounds')
          .filter((filename) => !filename.startsWith('.'))
          .reduce((xs, filename) => {
            const name = path.basename(filename, path.extname(filename))
            xs[name] = filename
            return xs
          }, {})
        state.sounds = Object.keys(sounds)

        disconnect = () => {
          console.log('Disconnecting from voice channel')
          // discordClient.user.setActivity(null)
          subscription.unsubscribe()
          connection.destroy()
          state.currentChannel = null
          state.currentMedia = null
          state.playing = false
          state.sounds = []
          send(state)
          disconnect = noop
        }

        state.currentChannel = {
          iconUrl: channel.guild.iconURL(),
          id: channel.id,
          name: `${channel.guild.name} – ${channel.name}`
        }

        send(state)
      })
    }

    function playSound (soundName, update = false) {
      const stream = createReadStream(`./sounds/${sounds[soundName]}`)
      resource = createAudioResource(stream, opusOptions)

      player.once(AudioPlayerStatus.Idle, () => {
        playSound(soundName)
      })

      if (update) {
        player.once(AudioPlayerStatus.Playing, () => {
          state.currentMedia = soundName
          state.playing = true
          send(state)
          // discordClient.user.setActivity(state.currentMedia, { type: 'LISTENING' })
        })
      }

      resource.volume.setVolume(state.volume)
      player.play(resource)
    }

    function togglePlay () {
      if (state.playing) {
        player.pause()
        state.playing = false
      } else {
        player.unpause()
        state.playing = true
      }
      send(state)
    }

    send = function (object) {
      ws.send(JSON.stringify(object))
    }

    function sendError (error) {
      console.error(error)
      send({ error })
    }

    send(state)

    ws.on('close', () => {
      console.log('WS Disconnected')
      send = noop
    })

    ws.on('message', (message) => {
      const action = JSON.parse(message)

      switch (action.type) {
        case 'CONNECT_TO_CHANNEL':
          connectToVoiceChannel(action.channelId)
          break

        case 'DISCONNECT':
          disconnect()
          break

        case 'PLAY_SOUND':
          playSound(action.sound, true)
          break

        case 'SET_VOLUME':
          state.volume = action.volume
          if (resource) resource.volume.setVolume(action.volume)
          break

        case 'TOGGLE_PLAY':
          togglePlay()
          break

        default:
          console.log('WS action received:', action)
      }
    })
  })

  state = {
    ...state,
    online: true,
    channels: discordClient.channels.cache
      .filter((c) => c.type === 'GUILD_VOICE')
      .map((c) => ({
        iconUrl: c.guild.iconURL(),
        id: c.id,
        name: `${c.guild.name} – ${c.name}`
      }))
      .sort((a, b) => (a.name < b.name ? -1 : 1))
  }

  console.log(`Listening on :${port}`)
})

discordClient.login(process.env.BOT_TOKEN)
