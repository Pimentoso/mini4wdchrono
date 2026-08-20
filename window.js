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

// Global nconf instance for settings
let globalConf = null;

// IPC handlers for system operations
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const fsp = fs.promises;
const nconf = require('nconf');

// Global electron-settings instance for race data
let raceStorage = null;
let currentRaceFile = null;

// Global hardware state
let board = null;
let sensors = { lane0: null, lane1: null, lane2: null };
let ledManager = null;
let buzzerPin = null;
let isHardwareReady = false;
let hardwareInitialization = null;
let serialPort = null;
const FirmataPixelStrip = require('./js/firmata_pixel_strip');

function markHardwareDisconnected(reason, disconnectedPort) {
    if (disconnectedPort && serialPort !== disconnectedPort) {
        return false;
    }

    if (!isHardwareReady) {
        if (disconnectedPort) {
            serialPort = null;
        }
        return false;
    }

    isHardwareReady = false;
    sensors = { lane0: null, lane1: null, lane2: null };
    ledManager = null;
    buzzerPin = null;
    board = null;
    serialPort = null;

    console.log(`[Hardware] Connection closed${reason ? `: ${reason}` : ''}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hardware-board-closed', reason);
    }
    return true;
}

// Configuration defaults
const CONFIG_DEFAULTS = {
    'ledAnimation': 0,
    'ledType': 0, // deprecated
    'sensorPin1': 6,
    'sensorPin2': 7,
    'sensorPin3': 8,
    'ledPin1': 3,
    'ledPin2': 0, // deprecated
    'ledPin3': 0, // deprecated
    'piezoPin': 2,
    'startButtonPin': 0,
    'reverse': 0,
    'title': 'MINI4WD CHRONO',
    'tab': 'setup'
};

function sleep(millis) {
    return new Promise((resolve) => setTimeout(resolve, millis));
}

function ensureLedManagerReady() {
    if (!ledManager) {
        throw new Error('LED manager not initialized');
    }
}

function buzz(duration) {
    if (!buzzerPin || !board || !isHardwareReady) {
        console.warn('[Hardware] Buzzer not initialized');
        return;
    }

    board.digitalWrite(buzzerPin, 1);
    setTimeout(() => {
        if (board && isHardwareReady) {
            board.digitalWrite(buzzerPin, 0);
        }
    }, duration || 100);
}

async function runLedAnimation(animation) {
    ensureLedManagerReady();

    const delay = animation.delay || 0;

    if (delay > 0) {
        await sleep(delay);
    }

    if (animation.type === 'greenLight') {
        ledManager.color(animation.color);
        ledManager.show();
        buzz(animation.buzzDuration);

        setTimeout(() => {
            if (ledManager) {
                ledManager.off();
            }
        }, animation.offDelay || 0);
        return;
    }

    if (animation.type === 'countdown') {
        const pixels = animation.reverse ? [8, 7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
        for (let i = 0; i < pixels.length; i++) {
            ledManager.pixel(pixels[i]).color(animation.color);
            ledManager.show();
            if (i % 3 === 0) {
                buzz(animation.buzzDuration);
            }
            if (i < pixels.length - 1) {
                await sleep(animation.stepDelay);
            }
        }
        return;
    }

    if (animation.type === 'kitt') {
        let direction = 0;
        let curr = 0;
        let prev = -1;
        const iterations = Math.floor(animation.duration / animation.stepDelay);

        for (let i = 0; i < iterations; i++) {
            ledManager.pixel(curr).color(animation.color);
            if (prev >= 0) {
                ledManager.pixel(prev).off();
            }
            ledManager.show();

            if (direction === 0) {
                curr++;
                prev++;
                if (curr > 8) {
                    direction = 1;
                    curr = 7;
                }
            }
            else {
                curr--;
                prev--;
                if (curr < 0) {
                    direction = 0;
                    curr = 1;
                }
            }

            await sleep(animation.stepDelay);
        }

        ledManager.off();
        return;
    }

    if (animation.type === 'tamiyaSlide') {
        const colors = [...animation.colors];
        for (let i = 0; i < colors.length; i++) {
            ledManager.pixel(i).color(colors[i]);
        }
        ledManager.show();

        const iterations = Math.floor(animation.duration / animation.stepDelay);
        for (let i = 0; i < iterations; i++) {
            await sleep(animation.stepDelay);
            colors.unshift(colors.pop());
            for (let pixelIndex = 0; pixelIndex < colors.length; pixelIndex++) {
                ledManager.pixel(pixelIndex).color(colors[pixelIndex]);
            }
            ledManager.show();
        }

        await sleep(animation.stepDelay);
        ledManager.off();
        return;
    }

    throw new Error(`Unknown LED animation type: ${animation.type}`);
}

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
    mainWindow.webContents.openDevTools();

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
    } catch (_error) {
        return false;
    }
});

/**
 * Initializes nconf with settings file
 * @returns {Promise<void>}
 */
ipcMain.handle('config-init', async (_event) => {
    try {
        const configDir = app.getPath('userData');
        const configPath = path.join(configDir, 'settings.json');
        await fsp.mkdir(configDir, { recursive: true });
        globalConf = nconf.file('global', { file: configPath });
        globalConf.defaults(CONFIG_DEFAULTS);
        console.log('[IPC] config-init initialized');
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
ipcMain.handle('config-get', async (_event, key) => {
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
ipcMain.handle('config-reset', async (_event) => {
    try {
        const configDir = app.getPath('userData');
        const configPath = path.join(configDir, 'settings.json');
        const backupPath = path.join(configDir, 'settings.json.bak');

        // Backup current settings if file exists
        try {
            await fsp.copyFile(configPath, backupPath);
        } catch (_error) {
            // File may not exist, that's ok
        }

        // Delete current and reinit
        try {
            await fsp.unlink(configPath);
        } catch (_error) {
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

        // Load race data (will throw if file doesn't exist)
        const content = await fsp.readFile(raceFilePath, 'utf8');
        const raceData = JSON.parse(content);
        currentRaceFile = raceFilePath;

        // Store in memory for fast access
        raceStorage = raceData;

        // Save current race file to config so it can be loaded on next startup
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

        // Save current race file to config
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
 * Gets all race storage data
 * @returns {Promise<object>} - Full race storage payload
 */
ipcMain.handle('storage-get-all', async () => {
    try {
        return raceStorage || {};
    } catch (error) {
        console.error('[IPC] storage-get-all error:', error);
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

/**
 * Initializes the Firmata board and hardware components
 * @param {object} options - Hardware configuration options
 * @returns {Promise<object>} - Success status and message
 */
ipcMain.handle('hardware-initialize', async (event, options) => {
    if (board && isHardwareReady) {
        console.log('[Hardware] Board already initialized');
        if (mainWindow) {
            mainWindow.webContents.send('hardware-board-ready');
        }
        return { success: true, message: 'Hardware already initialized' };
    }

    if (hardwareInitialization) {
        return hardwareInitialization;
    }

    try {
        // Lazy load dependencies
        const { SerialPort } = require('serialport');
        const Firmata = require('firmata').Board;

        // Auto-detect Arduino port
        const ports = await SerialPort.list();
        const arduinoPort = ports.find(port =>
            port.manufacturer && (
                port.manufacturer.includes('Arduino') ||
                port.manufacturer.includes('Silicon Labs') ||
                port.manufacturer.includes('FTDI') ||
                port.manufacturer.includes('QinHeng')
            )
        );

        if (!arduinoPort) {
            throw new Error('No Arduino found. Please connect your Arduino with Firmata firmware.');
        }

        console.log(`[Hardware] Found Arduino at ${arduinoPort.path}`);

        // Board initialization happens asynchronously
        hardwareInitialization = new Promise((resolve, reject) => {
            // Create SerialPort instance with v13 API
            const port = new SerialPort({
                path: arduinoPort.path,
                baudRate: 57600
            });
            serialPort = port;

            // Wait for serial port to open
            port.on('open', () => {
                console.log('[Hardware] Serial port opened');

                // Create Firmata Board instance with opened port
                const firmataBoard = new Firmata(port);

                // Wait for Firmata to be ready (queries board for capabilities)
                firmataBoard.once('ready', () => {
                    console.log('[Hardware] Firmata ready');

                    board = firmataBoard;
                    isHardwareReady = true;

                    // Notify renderer that the Firmata board is ready.
                    if (mainWindow) {
                        mainWindow.webContents.send('hardware-board-ready');
                    }

                    resolve({ success: true, message: 'Hardware initialized' });
                });

                // Handle Firmata errors
                firmataBoard.on('error', (error) => {
                    console.error('[Hardware] Firmata error:', error);
                    const disconnected = markHardwareDisconnected(error.message, port);
                    if (disconnected && mainWindow && !mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('hardware-board-error', error.message);
                    }
                    reject(error);
                });
            });

            // Handle serial port errors
            port.on('error', (error) => {
                console.error('[Hardware] Serial port error:', error);
                markHardwareDisconnected(error.message, port);
                reject(error);
            });

            port.on('close', (error) => {
                const reason = error ? error.message : 'Serial port closed';
                markHardwareDisconnected(reason, port);
            });
        });

        return await hardwareInitialization;
    } catch (error) {
        console.error('[IPC] hardware-initialize error:', error);
        throw error;
    } finally {
        hardwareInitialization = null;
    }
});

/**
 * Sets up sensors after board initialization
 * Uses Firmata digitalRead for maximum speed
 * @param {object} config - Sensor pin configuration
 * @returns {Promise<object>} - Success status
 */
ipcMain.handle('hardware-setup-sensors', async (event, config) => {
    try {
        if (!board || !isHardwareReady) {
            throw new Error('Board not ready');
        }

        const sensorPin1 = config.sensorPin1 || 6;
        const sensorPin2 = config.sensorPin2 || 7;
        const sensorPin3 = config.sensorPin3 || 8;

        // Store sensor state for tracking
        sensors.lane0 = { pin: sensorPin1, lastValue: 1 };
        sensors.lane1 = { pin: sensorPin2, lastValue: 1 };
        sensors.lane2 = { pin: sensorPin3, lastValue: 1 };

        // Request the fastest sampling interval supported by Firmata.
        board.setSamplingInterval(1);

        // Set pins to INPUT mode
        board.pinMode(sensorPin1, board.MODES.INPUT);
        board.pinMode(sensorPin2, board.MODES.INPUT);
        board.pinMode(sensorPin3, board.MODES.INPUT);

        // Raw digital read with callbacks
        board.digitalRead(sensorPin1, function(value) {
            sensors.lane0.lastValue = value;
            if (mainWindow) {
                mainWindow.webContents.send('hardware-sensor-change', {
                    lane: 0,
                    value: value,
                    timestamp: Date.now()
                });
            }
        });

        board.digitalRead(sensorPin2, function(value) {
            sensors.lane1.lastValue = value;
            if (mainWindow) {
                mainWindow.webContents.send('hardware-sensor-change', {
                    lane: 1,
                    value: value,
                    timestamp: Date.now()
                });
            }
        });

        board.digitalRead(sensorPin3, function(value) {
            sensors.lane2.lastValue = value;
            if (mainWindow) {
                mainWindow.webContents.send('hardware-sensor-change', {
                    lane: 2,
                    value: value,
                    timestamp: Date.now()
                });
            }
        });

        console.log('[Hardware] Sensors ready');
        return { success: true };
    } catch (error) {
        console.error('[IPC] hardware-setup-sensors error:', error);
        throw error;
    }
});

/**
 * Sets up start button after board initialization
 * @param {object} config - Button pin configuration
 * @returns {Promise<object>} - Success status
 */
ipcMain.handle('hardware-setup-button', async (event, config) => {
    try {
        if (!board || !isHardwareReady) {
            throw new Error('Board not ready');
        }

        const buttonPin = config.startButtonPin || 0;

        // If pin is 0, button is disabled
        if (buttonPin === 0) {
            console.log('[Hardware] Start button disabled');
            return { success: true, message: 'Button disabled' };
        }

        let previousValue = 1;
        let lastPressAt = 0;
        board.pinMode(buttonPin, board.MODES.PULLUP);
        board.digitalRead(buttonPin, (value) => {
            const now = Date.now();
            if (value === 0 && previousValue === 1 && now - lastPressAt >= 7 && mainWindow) {
                lastPressAt = now;
                mainWindow.webContents.send('hardware-button-press');
            }
            previousValue = value;
        });

        console.log(`[Hardware] Start button configured on pin ${buttonPin}`);
        return { success: true };
    } catch (error) {
        console.error('[IPC] hardware-setup-button error:', error);
        throw error;
    }
});

/**
 * Sets up LED manager after board initialization
 * @param {object} config - LED configuration
 * @returns {Promise<object>} - Success status
 */
ipcMain.handle('hardware-setup-leds', async (event, config) => {
    try {
        if (!board || !isHardwareReady) {
            throw new Error('Board not ready');
        }

        // Initialize the LED strip
        ledManager = new FirmataPixelStrip({
            firmata: board,
            pin: config.ledPin1 || 3,
            length: 9,
            gamma: 2.8
        });
        await ledManager.initialize();

        return { success: true, ready: true };
    } catch (error) {
        console.error('[IPC] hardware-setup-leds error:', error);
        throw error;
    }
});

/**
 * Sets up buzzer after board initialization
 * @param {object} config - Buzzer pin configuration
 * @returns {Promise<object>} - Success status
 */
ipcMain.handle('hardware-setup-buzzer', async (event, config) => {
    try {
        if (!board || !isHardwareReady) {
            throw new Error('Board not ready');
        }

        buzzerPin = config.piezoPin || 2;

        // Set pin to OUTPUT mode for buzzer control
        board.pinMode(buzzerPin, board.MODES.OUTPUT);

        console.log('[Hardware] Buzzer ready');
        return { success: true };
    } catch (error) {
        console.error('[IPC] hardware-setup-buzzer error:', error);
        throw error;
    }
});

/**
 * Reads current sensor values
 * @returns {Promise<object>} - Sensor values for all lanes
 */
ipcMain.handle('hardware-read-sensors', async () => {
    try {
        if (!board || !isHardwareReady || !sensors.lane0 || !sensors.lane1 || !sensors.lane2) {
            return { lane0: 0, lane1: 0, lane2: 0 };
        }

        return {
            lane0: sensors.lane0.lastValue || 0,
            lane1: sensors.lane1.lastValue || 0,
            lane2: sensors.lane2.lastValue || 0
        };
    } catch (error) {
        console.error('[IPC] hardware-read-sensors error:', error);
        throw error;
    }
});

/**
 * Updates LED strip colors
 * @param {object} laneData - LED data { lane, color } or { pixelIndex, color }
 * @returns {Promise<void>}
 */
ipcMain.handle('hardware-write-leds', async (event, laneData) => {
    try {
        if (!ledManager) {
            console.warn('[Hardware] LED manager not initialized');
            return;
        }

        // Support multiple formats
        if (laneData.pixelIndex !== undefined) {
            // Direct pixel control: { pixelIndex: 0-8, color: '#ff0000' or {r, g, b} }
            const pixel = ledManager.pixel(laneData.pixelIndex);
            if (pixel) {
                pixel.color(laneData.color);
            }
        } else if (laneData.lane !== undefined) {
            // Lane-based control: { lane: 0-2, color: '#ff0000' or {r, g, b} }
            const start = laneData.lane * 3;
            for (let i = start; i < start + 3; i++) {
                ledManager.pixel(i).color(laneData.color);
            }
        }

        // Auto-show after setting colors
        if (laneData.show !== false) {
            ledManager.show();
        }
    } catch (error) {
        console.error('[IPC] hardware-write-leds error:', error);
        throw error;
    }
});

/**
 * Runs a full LED animation on the main process
 * @param {object} animation - Animation definition
 * @returns {Promise<void>}
 */
ipcMain.handle('hardware-run-led-animation', async (_event, animation) => {
    try {
        await runLedAnimation(animation);
    } catch (error) {
        console.error('[IPC] hardware-run-led-animation error:', error);
        throw error;
    }
});

/**
 * Shows the LED strip (applies queued changes)
 * @returns {Promise<void>}
 */
ipcMain.handle('hardware-led-show', async () => {
    try {
        if (ledManager && ledManager.show) {
            ledManager.show();
        }
    } catch (error) {
        console.error('[IPC] hardware-led-show error:', error);
        throw error;
    }
});

/**
 * Turns off specific LED(s)
 * @param {object} data - { pixelIndex } or { lane } or empty for all
 * @returns {Promise<void>}
 */
ipcMain.handle('hardware-led-off', async (event, data = {}) => {
    try {
        if (!ledManager) {
            console.warn('[Hardware] LED manager not initialized');
            return;
        }

        if (data.pixelIndex !== undefined) {
            // Turn off specific pixel
            ledManager.pixel(data.pixelIndex).off();
        } else if (data.lane !== undefined) {
            // Turn off specific lane
            const start = data.lane * 3;
            for (let i = start; i < start + 3; i++) {
                ledManager.pixel(i).off();
            }
        } else {
            // Turn off all
            ledManager.off();
        }

        if (data.show !== false) {
            ledManager.show();
        }
    } catch (error) {
        console.error('[IPC] hardware-led-off error:', error);
        throw error;
    }
});

/**
 * Plays the buzzer
 * @param {number} duration - Duration in milliseconds
 * @returns {Promise<void>}
 */
ipcMain.handle('hardware-buzz', async (event, duration) => {
    try {
        buzz(duration);
    } catch (error) {
        console.error('[IPC] hardware-buzz error:', error);
        throw error;
    }
});

/**
 * Calls a method on the LED manager
 * @param {string} method - Method name to call
 * @param {Array} args - Arguments to pass
 * @returns {Promise<any>} - Method return value
 */
ipcMain.handle('hardware-led-method', async (event, method, ...args) => {
    try {
        if (!ledManager) {
            throw new Error('LED manager not initialized');
        }

        if (typeof ledManager[method] !== 'function') {
            throw new Error(`LED manager method '${method}' not found`);
        }

        return await ledManager[method](...args);
    } catch (error) {
        console.error('[IPC] hardware-led-method error:', error);
        throw error;
    }
});

/**
 * Lists available serial ports
 * @returns {Promise<Array>} - Array of port objects
 */
ipcMain.handle('hardware-list-ports', async () => {
    try {
        // In serialport v10+, list is exported separately
        const { SerialPort: PortList } = require('serialport');

        // Check if list is available as a static method
        if (typeof PortList.list === 'function') {
            const ports = await PortList.list();
            return ports;
        }

        // Fallback for older serialport versions or different exports
        throw new Error('SerialPort.list() is not available');
    } catch (error) {
        console.error('[IPC] hardware-list-ports error:', error);
        throw error;
    }
});

/**
 * Gets hardware readiness status
 * @returns {Promise<boolean>}
 */
ipcMain.handle('hardware-is-ready', async () => {
    return isHardwareReady;
});

/**
 * Closes hardware connections
 * @returns {Promise<void>}
 */
ipcMain.handle('hardware-close', async () => {
    try {
        const port = serialPort;
        markHardwareDisconnected('Closed by application', port);
        if (port && port.isOpen) {
            port.close();
        }
        console.log('[Hardware] Closed');
    } catch (error) {
        console.error('[IPC] hardware-close error:', error);
        throw error;
    }
});

ipcMain.handle('get-app-version', (_event) => {
    return app.getVersion();
});

ipcMain.handle('get-app-locale', (_event) => {
    return app.getLocale();
});

ipcMain.handle('get-app-path', (_event, name) => {
    return app.getPath(name);
});

ipcMain.on('show-message-box-sync', (event, options) => {
    event.returnValue = dialog.showMessageBoxSync(mainWindow, options);
});

// ipcMain.on('show-open-dialog-sync', (event, options) => {
//     event.returnValue = dialog.showOpenDialogSync(mainWindow, options);
// });

// ipcMain.on('show-save-dialog-sync', (event, options) => {
//     event.returnValue = dialog.showSaveDialogSync(mainWindow, options);
// });

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
