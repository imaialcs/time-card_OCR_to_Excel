// main.js
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');

// APIキーを安全に取得するためのIPCハンドラ
ipcMain.handle('get-api-key', () => {
  return process.env.API_KEY;
});

// ファイル保存ダイアログを表示してファイルを保存するためのIPCハンドラ
ipcMain.handle('save-file', async (event, options, data) => {
  const { defaultPath } = options;
  const focusedWindow = BrowserWindow.fromWebContents(event.sender);

  if (!focusedWindow) {
    return { success: false, error: 'Could not find the browser window.' };
  }

  try {
    const { canceled, filePath } = await dialog.showSaveDialog(focusedWindow, {
      defaultPath: defaultPath,
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    fs.writeFileSync(filePath, data);
    return { success: true, path: filePath };
  } catch (error) {
    console.error('Failed to save file:', error);
    return { success: false, error: error.message };
  }
});

// Handle settings export
ipcMain.handle('export-settings', async (event, settingsJson) => {
  const focusedWindow = BrowserWindow.fromWebContents(event.sender);
  if (!focusedWindow) return { success: false, error: 'Window not found' };

  const { canceled, filePath } = await dialog.showSaveDialog(focusedWindow, {
    title: '設定をエクスポート',
    defaultPath: 'ocr-settings.json',
    filters: [{ name: 'JSON Files', extensions: ['json'] }]
  });

  if (canceled || !filePath) {
    return { success: false, canceled: true };
  }

  try {
    fs.writeFileSync(filePath, settingsJson);
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle settings import
ipcMain.handle('import-settings', async (event) => {
  const focusedWindow = BrowserWindow.fromWebContents(event.sender);
  if (!focusedWindow) return { success: false, error: 'Window not found' };

  const { canceled, filePaths } = await dialog.showOpenDialog(focusedWindow, {
    title: '設定をインポート',
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) {
    return { success: false, canceled: true };
  }

  try {
    const data = fs.readFileSync(filePaths[0], 'utf-8');
    return { success: true, data: data };
  } catch (error) {
    return { success: false, error: error.message };
  }
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
    label: '設定',
    submenu: [
      {
        label: '勤務パターンの設定...',
        click: () => {
          const focusedWindow = BrowserWindow.getFocusedWindow();
          if (focusedWindow) {
            focusedWindow.webContents.send('open-settings-dialog', 'work-pattern');
          }
        }
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
