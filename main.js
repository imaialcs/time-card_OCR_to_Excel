// main.js
const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');

// --- Configure Logging ---
autoUpdater.logger = log;
log.transports.file.level = 'info';
log.info('App starting...');

// --- Auto Updater Setup ---
// Keep a reference to the main window to send messages to it.
let mainWindow;

const sendStatusToWindow = (status) => {
  log.info(status);
  if (mainWindow) {
    mainWindow.webContents.send('update-status', status);
  }
};

autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow({ message: 'アップデートを確認中...' });
});
autoUpdater.on('update-available', (info) => {
  sendStatusToWindow({ message: 'アップデートがあります。ダウンロードを開始します...' });
});
autoUpdater.on('update-not-available', (info) => {
  // We don't want to bother the user if they are up to date.
  // You could uncomment this for debugging purposes.
  // sendStatusToWindow({ message: '最新のバージョンです。' });
});
autoUpdater.on('error', (err) => {
  sendStatusToWindow({ message: 'アップデートエラー: ' + err.toString() });
});
autoUpdater.on('download-progress', (progressObj) => {
  const percent = Math.round(progressObj.percent);
  sendStatusToWindow({ message: `ダウンロード中... ${percent}%` });
});
autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow({ message: 'アップデートの準備ができました。アプリを再起動してインストールします。', ready: true });
});

// Listen for the renderer to signal a restart
ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

// セキュリティ向上のため、APIキーを環境変数から読み込みます。
const API_KEY = process.env.API_KEY;

// レンダラープロセスからのAPIキー取得リクエストを処理します。
ipcMain.handle('get-api-key', () => {
  if (!API_KEY) {
    console.error("API_KEY environment variable is not set in the main process.");
    return null;
  }
  return API_KEY;
});

// --- アプリケーションメニューの定義 ---
const isMac = process.platform === 'darwin';

const template = [
  // { role: 'appMenu' } (macOSのみ)
  ...(isMac ? [{
    label: app.name,
    submenu: [
      { role: 'about', label: `${app.name}について` },
      { type: 'separator' },
      { role: 'services', label: 'サービス' },
      { type: 'separator' },
      { role: 'hide', label: `${app.name}を隠す` },
      { role: 'hideOthers', label: 'ほかを隠す' },
      { role: 'unhide', label: 'すべてを表示' },
      { type: 'separator' },
      { role: 'quit', label: `${app.name}を終了` }
    ]
  }] : []),
  // { role: 'fileMenu' }
  {
    label: 'ファイル',
    submenu: [
      isMac ? { role: 'close', label: 'ウィンドウを閉じる' } : { role: 'quit', label: '終了' }
    ]
  },
  // { role: 'editMenu' }
  {
    label: '編集',
    submenu: [
      { role: 'undo', label: '元に戻す' },
      { role: 'redo', label: 'やり直す' },
      { type: 'separator' },
      { role: 'cut', label: '切り取り' },
      { role: 'copy', label: 'コピー' },
      { role: 'paste', label: '貼り付け' },
      ...(isMac ? [
        { role: 'pasteAndMatchStyle', label: 'ペーストしてスタイルを合わせる' },
        { role: 'delete', label: '削除' },
        { role: 'selectAll', label: 'すべて選択' },
      ] : [
        { role: 'delete', label: '削除' },
        { type: 'separator' },
        { role: 'selectAll', label: 'すべて選択' }
      ])
    ]
  },
  // { role: 'viewMenu' }
  {
    label: '表示',
    submenu: [
      { role: 'reload', label: 'リロード' },
      { role: 'forceReload', label: '強制的にリロード' },
      { role: 'toggleDevTools', label: '開発者ツールを表示' },
      { type: 'separator' },
      { role: 'resetZoom', label: '実際のサイズ' },
      { role: 'zoomIn', label: '拡大' },
      { role: 'zoomOut', label: '縮小' },
      { type: 'separator' },
      { role: 'togglefullscreen', label: 'フルスクリーン' }
    ]
  },
  // { role: 'windowMenu' }
  {
    label: 'ウィンドウ',
    submenu: [
      { role: 'minimize', label: '最小化' },
      ...(isMac ? [
        { type: 'separator' },
        { role: 'front', label: '手前に移動' },
      ] : [
        { role: 'close', label: '閉じる' }
      ])
    ]
  }
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // 注意: nodeIntegrationとcontextIsolationのデフォルト値 (false, true) はセキュリティ上重要です。
      // これらを変更しないでください。
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  // Viteビルドによって生成された `dist/index.html` を読み込みます。
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // デバッグが必要な場合は、以下の行のコメントを解除して開発者ツールを開きます。
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  // Check for updates when the app is ready and the window is created.
  autoUpdater.checkForUpdates();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});