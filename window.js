// Node.js/electron entry point file.

'use strict';

const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const url = require('url');

if (process.argv[2] === '--watch') {
    require('electron-reload')(__dirname, {
        electron: path.join(__dirname, 'node_modules', '.bin', 'electron')
    });
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
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
        mainWindow = null;
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
}

// IPC handlers for system operations
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const fsp = fs.promises;
const nconf = require('nconf');

// ===== PHASE 2: FILE SYSTEM OPERATIONS =====

/**
 * Ensures a directory exists, creating it recursively if needed
 * @param {string} dirPath - Absolute path to directory
 * @returns {Promise<string>} - The directory path
 */
ipcMain.handle('fs-ensure-dir', async (event, dirPath) => {
    try {
        await fsp.mkdir(dirPath, { recursive: true });
        return dirPath;
    } catch (error) {
        console.error('[IPC] fs-ensure-dir error:', error);
        throw error;
    }
});

/**
 * Writes data to a JSON file
 * @param {string} filePath - Absolute path to file
 * @param {object} data - Data to write
 * @returns {Promise<void>}
 */
ipcMain.handle('fs-write-file', async (event, filePath, data) => {
    try {
        // Ensure parent directory exists
        const dir = path.dirname(filePath);
        await fsp.mkdir(dir, { recursive: true });
        // Write file with formatted JSON
        await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('[IPC] fs-write-file error:', error);
        throw error;
    }
});

/**
 * Reads a JSON file
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<object>} - File contents
 */
ipcMain.handle('fs-read-file', async (event, filePath) => {
    try {
        const content = await fsp.readFile(filePath, 'utf8');
        return JSON.parse(content);
    } catch (error) {
        console.error('[IPC] fs-read-file error:', error);
        throw error;
    }
});

/**
 * Deletes a file
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<void>}
 */
ipcMain.handle('fs-delete-file', async (event, filePath) => {
    try {
        await fsp.unlink(filePath);
    } catch (error) {
        console.error('[IPC] fs-delete-file error:', error);
        throw error;
    }
});

/**
 * Lists files in a directory
 * @param {string} dirPath - Absolute path to directory
 * @param {string} extension - Optional extension filter (e.g., '.json')
 * @returns {Promise<Array>} - Array of filenames
 */
ipcMain.handle('fs-list-files', async (event, dirPath, extension) => {
    try {
        let files = await fsp.readdir(dirPath);
        if (extension) {
            files = files.filter(f => path.extname(f) === extension);
        }
        return files;
    } catch (error) {
        console.error('[IPC] fs-list-files error:', error);
        throw error;
    }
});

/**
 * Checks if a file exists
 * @param {string} filePath - Absolute path to file
 * @returns {Promise<boolean>}
 */
ipcMain.handle('fs-file-exists', async (event, filePath) => {
    try {
        await fsp.access(filePath);
        return true;
    } catch {
        return false;
    }
});

// ===== PHASE 2: CONFIGURATION OPERATIONS =====

// Global nconf instance for settings
let globalConf = null;

/**
 * Initializes nconf with settings file
 * @returns {Promise<void>}
 */
ipcMain.handle('config-init', async (event) => {
    try {
        const configDir = app.getPath('userData');
        const configPath = path.join(configDir, 'settings.json');
        
        // Ensure directory exists
        await fsp.mkdir(configDir, { recursive: true });
        
        globalConf = nconf.file('global', { file: configPath });
        
        globalConf.defaults({
            'ledAnimation': 0,
            'ledType': 0,
            'sensorPin1': 6,
            'sensorPin2': 7,
            'sensorPin3': 8,
            'ledPin1': 3,
            'ledPin2': 4,
            'ledPin3': 5,
            'piezoPin': 2,
            'startButtonPin': 0,
            'reverse': 0,
            'title': 'MINI4WD CHRONO',
            'tab': 'setup'
        });
    } catch (error) {
        console.error('[IPC] config-init error:', error);
        throw error;
    }
});

/**
 * Gets a configuration value
 * @param {string} key - Configuration key
 * @returns {Promise<any>} - Configuration value
 */
ipcMain.handle('config-get', async (event, key) => {
    try {
        if (!globalConf) {
            await ipcMain.emit('config-init');
        }
        globalConf.load();
        return globalConf.get(key);
    } catch (error) {
        console.error('[IPC] config-get error:', error);
        throw error;
    }
});

/**
 * Sets a configuration value
 * @param {string} key - Configuration key
 * @param {any} value - Configuration value
 * @returns {Promise<void>}
 */
ipcMain.handle('config-set', async (event, key, value) => {
    try {
        if (!globalConf) {
            await ipcMain.emit('config-init');
        }
        globalConf.set(key, value);
        globalConf.save();
    } catch (error) {
        console.error('[IPC] config-set error:', error);
        throw error;
    }
});

/**
 * Deletes a configuration value
 * @param {string} key - Configuration key
 * @returns {Promise<void>}
 */
ipcMain.handle('config-del', async (event, key) => {
    try {
        if (!globalConf) {
            await ipcMain.emit('config-init');
        }
        globalConf.clear(key);
        globalConf.save();
    } catch (error) {
        console.error('[IPC] config-del error:', error);
        throw error;
    }
});

/**
 * Resets configuration to defaults (with backup)
 * @returns {Promise<string>} - Path to backup file
 */
ipcMain.handle('config-reset', async (event) => {
    try {
        const configDir = app.getPath('userData');
        const configPath = path.join(configDir, 'settings.json');
        const backupPath = path.join(configDir, 'settings.json.bak');
        
        // Backup current settings
        if (await new Promise(resolve => {
            fsp.access(configPath).then(() => resolve(true)).catch(() => resolve(false));
        })) {
            await fsp.copyFile(configPath, backupPath);
        }
        
        // Delete current and reinit
        try {
            await fsp.unlink(configPath);
        } catch {
            // File may not exist, that's ok
        }
        
        globalConf = null; // Reset global instance
        await ipcMain.emit('config-init');
        
        return backupPath;
    } catch (error) {
        console.error('[IPC] config-reset error:', error);
        throw error;
    }
});

// ===== PHASE 2: STORAGE OPERATIONS (Race Data) =====

// Global electron-settings instance for race data
let raceStorage = null;
let currentRaceFile = null;

/**
 * Loads a race file into storage
 * @param {string} filename - Race filename (e.g., '1234567890.json')
 * @returns {Promise<void>}
 */
ipcMain.handle('storage-load-race', async (event, filename) => {
    try {
        const userdir = app.getPath('userData');
        const raceDir = path.join(userdir, 'races');
        
        // Ensure races directory exists
        await fsp.mkdir(raceDir, { recursive: true });
        
        const raceFilePath = path.join(raceDir, filename);
        
        // Check if file exists
        const exists = await new Promise(resolve => {
            fsp.access(raceFilePath).then(() => resolve(true)).catch(() => resolve(false));
        });
        
        if (!exists) {
            throw new Error(`Race file not found: ${filename}`);
        }
        
        // Load race data
        const content = await fsp.readFile(raceFilePath, 'utf8');
        const raceData = JSON.parse(content);
        currentRaceFile = raceFilePath;
        
        // Store in memory for fast access (matches original electron-settings behavior)
        raceStorage = raceData;
        
        // Update config with current race file
        if (globalConf) {
            globalConf.set('raceFile', filename);
            globalConf.save();
        }
    } catch (error) {
        console.error('[IPC] storage-load-race error:', error);
        throw error;
    }
});

/**
 * Creates a new race
 * @param {string} raceName - Name of the race
 * @returns {Promise<string>} - Filename of created race
 */
ipcMain.handle('storage-new-race', async (event, raceName) => {
    try {
        const userdir = app.getPath('userData');
        const raceDir = path.join(userdir, 'races');
        
        // Ensure races directory exists
        await fsp.mkdir(raceDir, { recursive: true });
        
        const timestamp = parseInt(new Date().getTime() / 1000);
        const filename = `${timestamp}.json`;
        const filePath = path.join(raceDir, filename);
        
        // Create initial race data
        const raceData = {
            name: raceName,
            created: timestamp,
            currManche: 0,
            currRound: 0,
            raceMode: 0,
            timeThreshold: 40,
            speedThreshold: 5,
            startDelay: 3,
            roundLaps: 3
        };
        
        // Write race file
        await fsp.writeFile(filePath, JSON.stringify(raceData, null, 2), 'utf8');
        
        // Load into storage
        raceStorage = raceData;
        currentRaceFile = filePath;
        
        // Update config
        if (globalConf) {
            globalConf.set('raceFile', filename);
            globalConf.save();
        }
        
        return filename;
    } catch (error) {
        console.error('[IPC] storage-new-race error:', error);
        throw error;
    }
});

/**
 * Sets a storage value
 * @param {string} key - Key path (e.g., 'race.m0.r0')
 * @param {any} value - Value to set
 * @returns {Promise<void>}
 */
ipcMain.handle('storage-set', async (event, key, value) => {
    try {
        if (!raceStorage) {
            raceStorage = {};
        }
        
        // Handle nested keys like 'race.m0.r0'
        const keys = key.split('.');
        let current = raceStorage;
        
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        current[keys[keys.length - 1]] = value;
        
        // Persist to disk
        if (currentRaceFile) {
            await fsp.writeFile(currentRaceFile, JSON.stringify(raceStorage, null, 2), 'utf8');
        }
    } catch (error) {
        console.error('[IPC] storage-set error:', error);
        throw error;
    }
});

/**
 * Gets a storage value
 * @param {string} key - Key path (e.g., 'race.m0.r0')
 * @returns {Promise<any>} - Value or null if not found
 */
ipcMain.handle('storage-get', async (event, key) => {
    try {
        if (!raceStorage) {
            return null;
        }
        
        // Handle nested keys
        const keys = key.split('.');
        let current = raceStorage;
        
        for (let i = 0; i < keys.length; i++) {
            current = current[keys[i]];
            if (current === undefined || current === null) {
                return null;
            }
        }
        
        return current;
    } catch (error) {
        console.error('[IPC] storage-get error:', error);
        throw error;
    }
});

/**
 * Removes a storage value
 * @param {string} key - Key path
 * @returns {Promise<void>}
 */
ipcMain.handle('storage-remove', async (event, key) => {
    try {
        if (!raceStorage) {
            return;
        }
        
        const keys = key.split('.');
        let current = raceStorage;
        
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
            if (!current) return;
        }
        
        delete current[keys[keys.length - 1]];
        
        // Persist to disk
        if (currentRaceFile) {
            await fsp.writeFile(currentRaceFile, JSON.stringify(raceStorage, null, 2), 'utf8');
        }
    } catch (error) {
        console.error('[IPC] storage-remove error:', error);
        throw error;
    }
});

/**
 * Lists recent race files
 * @param {number} num - Number of recent files to return
 * @returns {Promise<Array>} - Array of race metadata objects
 */
ipcMain.handle('storage-list-races', async (event, num) => {
    try {
        num = num || 10;
        const userdir = app.getPath('userData');
        const raceDir = path.join(userdir, 'races');
        
        // Ensure directory exists
        await fsp.mkdir(raceDir, { recursive: true });
        
        let files = await fsp.readdir(raceDir);
        files = files.filter(f => path.extname(f) === '.json');
        
        const recent = [];
        
        for (const filename of files) {
            try {
                const filePath = path.join(raceDir, filename);
                const content = await fsp.readFile(filePath, 'utf8');
                const data = JSON.parse(content);
                if (data) {
                    recent.push({
                        filename: filename,
                        name: data.name,
                        created: data.created
                    });
                }
            } catch (err) {
                console.warn(`[IPC] Could not read race file ${filename}:`, err);
            }
        }
        
        // Sort by created date descending
        recent.sort((a, b) => b.created - a.created);
        
        return recent.slice(0, num);
    } catch (error) {
        console.error('[IPC] storage-list-races error:', error);
        throw error;
    }
});

/**
 * Deletes a race file
 * @param {string} filename - Filename to delete
 * @returns {Promise<void>}
 */
ipcMain.handle('storage-delete-race', async (event, filename) => {
    try {
        const userdir = app.getPath('userData');
        const filePath = path.join(userdir, 'races', filename);
        
        await fsp.unlink(filePath);
        
        // Clear storage if this was the current race
        if (currentRaceFile === filePath) {
            raceStorage = null;
            currentRaceFile = null;
            if (globalConf) {
                globalConf.del('raceFile');
                globalConf.save();
            }
        }
    } catch (error) {
        console.error('[IPC] storage-delete-race error:', error);
        throw error;
    }
});

// ===== EXISTING HANDLERS (from Phase 1) =====

ipcMain.handle('get-app-version', (event) => {
    return app.getVersion();
});

ipcMain.handle('get-app-locale', (event) => {
    return app.getLocale();
});

ipcMain.handle('get-app-path', (event, name) => {
    return app.getPath(name);
});

ipcMain.handle('show-message-box', (event, options) => {
    return dialog.showMessageBox(mainWindow, options);
});

ipcMain.handle('show-open-dialog', (event, options) => {
    return dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('show-save-dialog', (event, options) => {
    return dialog.showSaveDialog(mainWindow, options);
});

// Window controls
ipcMain.handle('window-maximize', () => {
    if (mainWindow) mainWindow.maximize();
});

ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
});

// Shell operations
ipcMain.handle('open-path-in-explorer', async (event, filePath) => {
    const { shell } = require('electron');
    return await shell.openPath(filePath);
});

ipcMain.handle('open-external', async (event, url) => {
    const { shell } = require('electron');
    return await shell.openExternal(url);
});

// Clipboard operations
ipcMain.handle('clipboard-write', (event, text) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
});

ipcMain.handle('clipboard-read', () => {
    const { clipboard } = require('electron');
    return clipboard.readText();
});

// Prevent multiple instances of this app to run.
const gotTheLock = app.requestSingleInstanceLock();

app.on('second-instance', () => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
    }
});

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
