const { contextBridge, ipcRenderer, webUtils } = require('electron');

const on = (channel, fn) => {
  const h = (_e, ...args) => fn(...args);
  ipcRenderer.on(channel, h);
  return () => ipcRenderer.removeListener(channel, h);
};

contextBridge.exposeInMainWorld('shortpp', {
  platform: process.platform,
  store: {
    get: (key) => ipcRenderer.invoke('store:get', key),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
  },
  file: {
    open: () => ipcRenderer.invoke('file:open'),
    read: (path) => ipcRenderer.invoke('file:read', path),
    save: (opts) => ipcRenderer.invoke('file:save', opts),
    rename: (path, name) => ipcRenderer.invoke('file:rename', path, name),
    trash: (path) => ipcRenderer.invoke('file:trash', path),
    reveal: (path) => ipcRenderer.send('file:reveal', path),
    exists: (paths) => ipcRenderer.invoke('file:exists', paths),
    pathFor: (file) => { try { return webUtils.getPathForFile(file); } catch { return ''; } },
  },
  win: {
    minimize: () => ipcRenderer.send('win:minimize'),
    toggleMaximize: () => ipcRenderer.send('win:toggle-maximize'),
    close: () => ipcRenderer.send('win:close'),
    setDirty: (v) => ipcRenderer.send('win:dirty', v),
    onState: (fn) => on('win:state', fn),
  },
  run: {
    toolchain: (force) => ipcRenderer.invoke('run:toolchain', force),
    code: (opts) => ipcRenderer.invoke('run:code', opts),
    stop: () => ipcRenderer.send('run:stop'),
  },
  ask: (opts) => ipcRenderer.invoke('dialog:ask', opts),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  devtools: () => ipcRenderer.send('app:devtools'),
  onMenu: (fn) => on('menu', fn),
});
