// Node.js/electron entry point file.

'use strict';

const {app, ipcMain, BrowserWindow, Menu} = require('electron');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');
const isMac = process.platform === 'darwin';

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
	// Create the browser window.
	mainWindow = new BrowserWindow({
		width: 1280,
		height: 800,
		webPreferences: {
			nodeIntegration: true
		}
	});

	// and load the index.html of the app.
	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}));

	// Maximize.
	mainWindow.maximize();
	mainWindow.setResizable(false);

	// Open the DevTools.
	// mainWindow.webContents.openDevTools();

	// Emitted when the window is closed.
	mainWindow.on('closed', function () {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		mainWindow = null
	});

	const selectionMenu = Menu.buildFromTemplate([
		{ role: 'copy' },
		{ type: 'separator' },
		{ role: 'selectall' },
	]);

	const inputMenu = Menu.buildFromTemplate([
		{ role: 'undo' },
		{ role: 'redo' },
		{ type: 'separator' },
		{ role: 'cut' },
		{ role: 'copy' },
		{ role: 'paste' },
		{ type: 'separator' },
		{ role: 'selectall' },
	]);

	// Show context menus on right click.
	mainWindow.webContents.on('context-menu', (e, props) => {
		const { selectionText, isEditable } = props;
		if (isEditable) {
			inputMenu.popup(mainWindow);
		} else if (selectionText && selectionText.trim() !== '') {
			selectionMenu.popup(mainWindow);
		}
	});

	// Check for auto updates.
	autoUpdater.checkForUpdatesAndNotify();
}

// Prevent multiple instances of this app to run.
const gotTheLock = app.requestSingleInstanceLock();

app.on('second-instance', (_cl, _wd) => {
  // Someone tried to run a second instance, we should focus our window.
  if (myWindow) {
    if (myWindow.isMinimized()) myWindow.restore();
    myWindow.focus();
  }
})

if (!gotTheLock) {
  return app.quit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	if (process.platform !== 'darwin') {
		app.quit();
	}
});

app.on('activate', function () {
	// On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	if (mainWindow === null) {
		createWindow();
	}
});

// Autoupdater stuff
autoUpdater.on('checking-for-update', () => {
  log.info('Autoupdater: checking for update...');
})
autoUpdater.on('update-available', (info) => {
  log.info('Autoupdater: update available.');
})
autoUpdater.on('update-not-available', (info) => {
  log.info('Autoupdater: update not available.');
})
autoUpdater.on('error', (err) => {
  log.info('Autoupdater: error. ' + err);
})
autoUpdater.on('update-downloaded', (info) => {
  log.info('Autoupdater: update downloaded.');
  mainWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});
