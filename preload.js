// Preload script for context isolation
// This script bridges the gap between the isolated renderer process and main process via IPC

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// Safe API exposed to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
    minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
    closeWindow: () => ipcRenderer.invoke('window-close'),
    
    // Dialogs
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
    
    // File operations (storage)
    ensureDir: (dirPath) => ipcRenderer.invoke('fs-ensure-dir', dirPath),
    writeFile: (filePath, data) => ipcRenderer.invoke('fs-write-file', filePath, data),
    readFile: (filePath) => ipcRenderer.invoke('fs-read-file', filePath),
    deleteFile: (filePath) => ipcRenderer.invoke('fs-delete-file', filePath),
    listRaces: () => ipcRenderer.invoke('fs-list-races'),
    
    // Configuration
    configLoad: () => ipcRenderer.invoke('config-load'),
    configSave: (data) => ipcRenderer.invoke('config-save', data),
    configReset: () => ipcRenderer.invoke('config-reset'),
    configGet: (key) => ipcRenderer.invoke('config-get', key),
    configSet: (key, value) => ipcRenderer.invoke('config-set', key, value),
    
    // App info
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    getAppPath: (name) => ipcRenderer.invoke('get-app-path', name),
    
    // Shell
    openPath: (filePath) => ipcRenderer.invoke('open-path-in-explorer', filePath),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    
    // Clipboard
    clipboardWrite: (text) => ipcRenderer.invoke('clipboard-write', text),
    clipboardRead: () => ipcRenderer.invoke('clipboard-read'),
    
    // Hardware (placeholder for phase 3)
    hardwareInitialize: () => ipcRenderer.invoke('hardware-initialize'),
    hardwareReadSensors: () => ipcRenderer.invoke('hardware-read-sensors'),
    hardwareWriteLeds: (laneData) => ipcRenderer.invoke('hardware-write-leds', laneData),
    hardwareBuzz: (duration) => ipcRenderer.invoke('hardware-buzz', duration),
    
    // Hardware status listeners (events)
    onBoardReady: (callback) => ipcRenderer.on('hardware-board-ready', callback),
    onBoardError: (callback) => ipcRenderer.on('hardware-board-error', callback),
    onSensorChange: (callback) => ipcRenderer.on('hardware-sensor-change', callback),
    
    // Export
    writeExcel: (filePath, workbook) => ipcRenderer.invoke('fs-write-excel', filePath, workbook),
});

// Expose a logging function
contextBridge.exposeInMainWorld('logger', {
    info: (message) => ipcRenderer.send('log-info', message),
    warn: (message) => ipcRenderer.send('log-warn', message),
    error: (message) => ipcRenderer.send('log-error', message),
});
