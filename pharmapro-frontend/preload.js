const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  isElectron: true,
  onShowDBSetup: (cb) => ipcRenderer.on('show-db-setup', cb),
  removeShowDBSetup: () => ipcRenderer.removeAllListeners('show-db-setup'),
});
