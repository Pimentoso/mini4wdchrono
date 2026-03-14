// Preload script - with contextIsolation: false, we can directly modify window
'use strict';

const { ipcRenderer } = require('electron');

// With contextIsolation: false, we can directly set window properties
// No need for contextBridge - just set window properties directly
window.nodeRequire = require;

// Safe API exposed to renderer process
window.electronAPI = {
    // Window controls
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),

    // Dialogs
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),

    // File System Operations
    ensureDir: (dirPath) => ipcRenderer.invoke('fs-ensure-dir', dirPath),
    writeFile: (filePath, data) => ipcRenderer.invoke('fs-write-file', filePath, data),
    readFile: (filePath) => ipcRenderer.invoke('fs-read-file', filePath),
    deleteFile: (filePath) => ipcRenderer.invoke('fs-delete-file', filePath),
    listFiles: (dirPath, extension) => ipcRenderer.invoke('fs-list-files', dirPath, extension),
    fileExists: (filePath) => ipcRenderer.invoke('fs-file-exists', filePath),

    // Configuration Operations
    configInit: () => ipcRenderer.invoke('config-init'),
    configGet: (key) => ipcRenderer.invoke('config-get', key),
    configSet: (key, value) => ipcRenderer.invoke('config-set', key, value),
    configDel: (key) => ipcRenderer.invoke('config-del', key),
    configReset: () => ipcRenderer.invoke('config-reset'),

    // Storage Operations (Race Data)
    storageNewRace: (raceName) => ipcRenderer.invoke('storage-new-race', raceName),
    storageLoadRace: (filename) => ipcRenderer.invoke('storage-load-race', filename),
    storageDeleteRace: (filename) => ipcRenderer.invoke('storage-delete-race', filename),
    storageListRaces: (num) => ipcRenderer.invoke('storage-list-races', num),
    storageSet: (key, value) => ipcRenderer.invoke('storage-set', key, value),
    storageGet: (key) => ipcRenderer.invoke('storage-get', key),
    storageGetAll: () => ipcRenderer.invoke('storage-get-all'),
    storageRemove: (key) => ipcRenderer.invoke('storage-remove', key),

    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getAppLocale: () => ipcRenderer.invoke('get-app-locale'),
    getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),

    // Shell
    openPath: (filePath) => ipcRenderer.invoke('open-path-in-explorer', filePath),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),

    // Clipboard
    clipboardWrite: (text) => ipcRenderer.invoke('clipboard-write', text),
    clipboardRead: () => ipcRenderer.invoke('clipboard-read'),

    // Hardware
    hardwareInitialize: () => ipcRenderer.invoke('hardware-initialize'),
    hardwareSetupSensors: (config) => ipcRenderer.invoke('hardware-setup-sensors', config),
    hardwareSetupButton: (config) => ipcRenderer.invoke('hardware-setup-button', config),
    hardwareSetupLeds: (config) => ipcRenderer.invoke('hardware-setup-leds', config),
    hardwareSetupBuzzer: (config) => ipcRenderer.invoke('hardware-setup-buzzer', config),
    hardwareReadSensors: () => ipcRenderer.invoke('hardware-read-sensors'),
    hardwareWriteLeds: (laneData) => ipcRenderer.invoke('hardware-write-leds', laneData),
    hardwareLedShow: () => ipcRenderer.invoke('hardware-led-show'),
    hardwareLedOff: (data) => ipcRenderer.invoke('hardware-led-off', data),
    hardwareBuzz: (duration) => ipcRenderer.invoke('hardware-buzz', duration),
    hardwareSimpleLed: (config) => ipcRenderer.invoke('hardware-simple-led', config),
    hardwareLedMethod: (method, ...args) => ipcRenderer.invoke('hardware-led-method', method, ...args),
    hardwareListPorts: () => ipcRenderer.invoke('hardware-list-ports'),
    hardwareIsReady: () => ipcRenderer.invoke('hardware-is-ready'),
    hardwareClose: () => ipcRenderer.invoke('hardware-close'),

    // Hardware status listeners (events)
    onBoardReady: (callback) => ipcRenderer.on('hardware-board-ready', callback),
    onBoardError: (callback) => ipcRenderer.on('hardware-board-error', callback),
    onBoardClosed: (callback) => ipcRenderer.on('hardware-board-closed', callback),
    onSensorChange: (callback) => ipcRenderer.on('hardware-sensor-change', callback),
    onButtonPress: (callback) => ipcRenderer.on('hardware-button-press', callback),

    // Export
    writeExcel: (filePath, workbook) => ipcRenderer.invoke('fs-write-excel', filePath, workbook),
};

// Expose a logging function
window.logger = {
    info: (message) => ipcRenderer.send('log-info', message),
    warn: (message) => ipcRenderer.send('log-warn', message),
    error: (message) => ipcRenderer.send('log-error', message),
};
