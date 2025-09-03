const fs = require('fs');
const path = require('path');

// main.js の内容を修正してモジュールの読み込み方を変更
const mainPath = path.join(__dirname, 'main.js');
let mainContent = fs.readFileSync(mainPath, 'utf8');

// electron-log の require を相対パスに変更
mainContent = mainContent.replace(
  `require('electron-log')`,
  `require('./node_modules/electron-log')`
);

// electron-updater の require を相対パスに変更
mainContent = mainContent.replace(
  `require('electron-updater')`,
  `require('./node_modules/electron-updater')`
);

// 変更を保存
fs.writeFileSync(mainPath, mainContent);