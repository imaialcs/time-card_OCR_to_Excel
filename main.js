// main.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// APIキーを安全に取得するためのIPCハンドラ
ipcMain.handle('get-api-key', () => {
  return process.env.API_KEY;
});

// メニューテンプレートを定義
const template = [
  {
    label: 'ファイル',
    submenu: [
      {
        label: '終了',
        role: 'quit'
      }
    ]
  },
  {
    label: '編集',
    submenu: [
      {
        label: '元に戻す',
        role: 'undo'
      },
      {
        label: 'やり直す',
        role: 'redo'
      },
      { type: 'separator' },
      {
        label: '切り取り',
        role: 'cut'
      },
      {
        label: 'コピー',
        role: 'copy'
      },
      {
        label: '貼り付け',
        role: 'paste'
      },
      {
        label: 'すべて選択',
        role: 'selectAll'
      }
    ]
  },
  {
    label: '表示',
    submenu: [
      {
        label: '拡大',
        role: 'zoomIn'
      },
      {
        label: '縮小',
        role: 'zoomOut'
      },
      {
        label: '拡大率のリセット',
        role: 'resetZoom'
      },
      { type: 'separator' },
      {
        label: '全画面表示',
        role: 'togglefullscreen'
      }
    ]
  },
  {
    label: 'ヘルプ',
    submenu: [
      {
        label: 'バージョン情報',
        click: async () => {
          const { dialog } = require('electron');
          await dialog.showMessageBox({
            title: 'バージョン情報',
            message: '文書OCR',
            detail: `バージョン: ${app.getVersion()}\n© 2025 ALCS`
          });
        }
      }
    ]
  }
];

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // メニューを設定
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  mainWindow.loadFile('dist/index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// 自動更新の設定
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';
log.info('App starting...');

app.on('ready', function() {
  autoUpdater.checkForUpdatesAndNotify();
});
