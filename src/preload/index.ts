import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '../shared/api'

const call = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const api: Api = {
  getProfiles: call('profiles:get') as Api['getProfiles'],
  saveProfile: call('profiles:save') as Api['saveProfile'],
  deleteProfile: call('profiles:delete') as Api['deleteProfile'],
  pickM3UFile: call('dialog:m3u') as Api['pickM3UFile'],
  getPlaylistText: call('playlist:text') as Api['getPlaylistText'],
  loadXtream: call('xtream:load') as Api['loadXtream'],
  xtreamDetail: call('xtream:detail') as Api['xtreamDetail'],
  resolveUrl: call('stream:resolve') as Api['resolveUrl'],
  loadEpg: call('epg:load') as Api['loadEpg'],
  epgNowNext: call('epg:now') as Api['epgNowNext'],
  getSettings: call('settings:get') as Api['getSettings'],
  setSettings: call('settings:set') as Api['setSettings'],
  getFavorites: call('fav:get') as Api['getFavorites'],
  toggleFavorite: call('fav:toggle') as Api['toggleFavorite'],
  getHistory: call('history:get') as Api['getHistory'],
  saveHistory: call('history:save') as Api['saveHistory'],
  removeHistory: call('history:remove') as Api['removeHistory'],
  clearCache: call('cache:clear') as Api['clearCache'],
  setMini: call('window:mini') as Api['setMini'],
  openExternal: call('player:external') as Api['openExternal'],
  relaunch: call('app:relaunch') as Api['relaunch'],
  startRecording: call('record:start') as Api['startRecording'],
  startDownload: call('download:start') as Api['startDownload'],
  stopRecording: call('record:stop') as Api['stopRecording'],
  listRecordings: call('record:list') as Api['listRecordings'],
  openRecording: call('record:open') as Api['openRecording'],
  showRecordingFolder: call('record:folder') as Api['showRecordingFolder'],
  deleteRecording: call('record:delete') as Api['deleteRecording'],
  pickFolder: call('dialog:folder') as Api['pickFolder']
}

contextBridge.exposeInMainWorld('api', api)
