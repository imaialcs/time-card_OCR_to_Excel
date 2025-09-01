// preload.js
const { contextBridge, ipcRenderer } = require('electron');

// レンダラープロセス（UI側）の `window` オブジェクトに、安全なAPIを公開します。
contextBridge.exposeInMainWorld('electronAPI', {
  // `getApiKey`という関数を公開し、メインプロセスに 'get-api-key' というメッセージを送信して結果を受け取ります。
  getApiKey: () => ipcRenderer.invoke('get-api-key'),

  // --- Auto-update API ---
  onUpdateStatus: (callback) => {
    // We wrap the callback to ensure we are only passing the expected arguments.
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('update-status', listener);
    // Return a cleanup function to be used in React's useEffect.
    return () => ipcRenderer.removeListener('update-status', listener);
  },
  restartApp: () => ipcRenderer.send('restart-app'),
});