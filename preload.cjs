const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  backup: {
    save: (key, data) => ipcRenderer.invoke('save-backup', { key, data }),
    load: (key) => ipcRenderer.invoke('load-backup', { key })
  }
});
