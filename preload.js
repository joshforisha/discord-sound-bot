const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('discord', {
  changeSource: () => ipcRenderer.invoke('changeSource'),
  connectToChannel: (channelId) =>
    ipcRenderer.invoke('connectToChannel', channelId),
  disconnect: () => ipcRenderer.invoke('disconnect'),
  getServerChannels: () => ipcRenderer.invoke('getServerChannels'),
  playSound: (soundFile) => ipcRenderer.invoke('playSound', soundFile),
  setVolume: (volume) => ipcRenderer.invoke('setVolume', volume),
  togglePlay: () => ipcRenderer.invoke('togglePlay')
})
