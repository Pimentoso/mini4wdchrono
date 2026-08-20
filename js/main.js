'use strict';

////////////////////////
const debugMode = false;
////////////////////////

// With nodeIntegration:true, we can use require directly
// jQuery and Underscore loaded via HTML script tag

const log = require('electron-log');
// Use IPC to get app version
window.electronAPI.getAppVersion().then(version => {
    log.info(`Launched Mini4wdChrono v${version} at ${new Date()}`);
});
log.catchErrors();

const configuration = require('./js/configuration');
const i18n = new (require('./i18n/i18n'));

const storage = require('./js/storage');
const client = require('./js/client');
const ui = require('./js/ui');
const utils = require('./js/utils');

// Handles loading configuration and storage via IPC
(async () => {
    try {
        // Initialize locale for utils
        await utils.initLocale();

        // Initialize configuration and storage caches via IPC
        await configuration.initAsync();
        await storage.initAsync();
        log.info('Configuration and storage initialized successfully');
    } catch (e) {
        // Configuration/storage error
        log.error('Error during initialization');
        log.error(e.message);
        try {
            await configuration.reset();
        } catch (resetErr) {
            log.error('Error resetting configuration:', resetErr.message);
        }
        window.electronAPI.showMessageBoxSync({
            type: 'error',
            title: 'Error',
            message: i18n.__('dialog-configuration-error'),
            detail: i18n.__('dialog-configuration-error-detail'),
            buttons: ['Ok']
        });
        return; // Exit if initialization failed
    }

    // Continue with application initialization
    initializeApplication();
})();

/**
 * Main application initialization (called after async setup)
 */
async function initializeApplication() {
    // Hardware state variables
    let connected = false;
    let reverse;
    let tag1, tag2, tag3;
    let val1 = 0, val2 = 0, val3 = 0;
    let reconnectTimer = null;
    let reconnectInProgress = false;
    let disconnectNotified = false;

    // Initialize LED manager
    const LedManager = require('./js/led_manager');
    const ledManager = LedManager.getInstance(
        configuration.get('ledPin1'),
        configuration.get('piezoPin'),
        configuration.get('reverse') > 0
    );

    // init client
    client.init({ led_manager: ledManager });

    // Close hardware connections before page unload/reload
    // window.onbeforeunload = () => {
    //     console.log('[Main] Page unloading, closing hardware...');
    //     try {
    //         // Notify main process to close hardware synchronously
    //         window.electronAPI.invoke('hardware-close');
    //     } catch (err) {
    //         console.error('[Main] Error closing hardware:', err);
    //     }
    // };

    // Start race handler - validates hardware state before starting
    const startRace = () => {
        log.info(`Starting race at ${new Date()}`);
        if (!debugMode) {
            if (!connected) {
                window.electronAPI.showMessageBoxSync({
                    type: 'error',
                    title: 'Error',
                    message: i18n.__('dialog-disconnected'),
                    buttons: ['Ok']
                });
                return;
            }
            else if (tag1.text() !== '1') {
                window.electronAPI.showMessageBoxSync({
                    type: 'error',
                    title: 'Error',
                    message: `${i18n.__('dialog-sensor-error')} 1`,
                    buttons: ['Ok']
                });
                return;
            }
            else if (tag2.text() !== '1') {
                window.electronAPI.showMessageBoxSync({
                    type: 'error',
                    title: 'Error',
                    message: `${i18n.__('dialog-sensor-error')} 2`,
                    buttons: ['Ok']
                });
                return;
            }
            else if (tag3.text() !== '1') {
                window.electronAPI.showMessageBoxSync({
                    type: 'error',
                    title: 'Error',
                    message: `${i18n.__('dialog-sensor-error')} 3`,
                    buttons: ['Ok']
                });
                return;
            }
        }
        client.startRace(debugMode);
    };

    // Hardware button press handler
    const buttonPressed = () => {
        client.isStarted() ? client.stopRace() : startRace();
    };

    // Set up all UI event handlers
    ui.setupEventHandlers({
        client,
        storage,
        configuration,
        ledManager,
        startRaceCallback: startRace
    });

    // Show version in about tab (async)
    window.electronAPI.getAppVersion().then(version => {
        $('#js-about-version').text(`Version ${version}`);
    });

    // Open links externally by default
    $(document).on('click', 'a[href^="http"]', function (event) {
        event.preventDefault();
        window.electronAPI.openExternal(this.href);
    });

    // Set up hardware button press listener
    window.electronAPI.onButtonPress(() => {
        buttonPressed();
    });

    // Sets up hardware components after board is ready
    const setupHardwareComponents = async () => {
        try {
            tag1 = $('#sensor-reading-1');
            tag2 = $('#sensor-reading-2');
            tag3 = $('#sensor-reading-3');

            reverse = configuration.get('reverse') > 0;

            // Set up sensors in main process
            await window.electronAPI.hardwareSetupSensors({
                sensorPin1: configuration.get('sensorPin1'),
                sensorPin2: configuration.get('sensorPin2'),
                sensorPin3: configuration.get('sensorPin3')
            });

            // Set up start button in main process
            await window.electronAPI.hardwareSetupButton({
                startButtonPin: configuration.get('startButtonPin')
            });
            log.info('Start button configured');

            // Set up LEDs in main process
            await window.electronAPI.hardwareSetupLeds({
                ledPin1: configuration.get('ledPin1'),
                ledPin2: configuration.get('ledPin2'),
                ledPin3: configuration.get('ledPin3'),
                reverse: configuration.get('reverse') > 0
            });

            // Set up buzzer in main process
            await window.electronAPI.hardwareSetupBuzzer({
                piezoPin: configuration.get('piezoPin')
            });

            log.info('Hardware components configured');

            ledManager.connected();
            ui.boardConnected();
        } catch (error) {
            log.error('Error during hardware setup:', error);
        }
    };

    const scheduleHardwareReconnect = () => {
        if (connected || reconnectInProgress || reconnectTimer) {
            return;
        }

        reconnectTimer = setTimeout(async () => {
            reconnectTimer = null;
            reconnectInProgress = true;

            try {
                await window.electronAPI.hardwareInitialize();
                log.info('Hardware reconnection initialized');
            } catch (error) {
                log.info(`Hardware reconnection pending: ${error.message}`);
            } finally {
                reconnectInProgress = false;
                scheduleHardwareReconnect();
            }
        }, 2000);
    };

    // Listen for board ready event from main process
    window.electronAPI.onBoardReady(async () => {
        connected = true;
        disconnectNotified = false;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        log.info(`Board READY at ${new Date()}`);
        await setupHardwareComponents();
    });

    // Listen for board errors from main process
    window.electronAPI.onBoardError((event, errorMessage) => {
        connected = false;
        ledManager.disconnected();
        ui.boardDisconnected();

        log.error(`Board ERROR at ${new Date()} - ${errorMessage}`);
        if (!debugMode && !disconnectNotified) {
            disconnectNotified = true;
            window.electronAPI.showMessageBoxSync({
                type: 'error',
                title: 'Error',
                message: i18n.__('dialog-connection-error'),
                detail: errorMessage,
                buttons: ['Ok']
            });
        }
    });

    // Listen for board closed event from main process
    window.electronAPI.onBoardClosed((event, errorMessage) => {
        connected = false;
        ledManager.disconnected();
        ui.boardDisconnected();

        log.error(`Board closed at ${new Date()}`);
        if (!debugMode && !disconnectNotified) {
            disconnectNotified = true;
            window.electronAPI.showMessageBoxSync({
                type: 'error',
                title: 'Error',
                message: i18n.__('dialog-disconnected'),
                detail: errorMessage || i18n.__('dialog-connection-error'),
                buttons: ['Ok']
            });
        }
        scheduleHardwareReconnect();
    });

    // Listen for sensor changes from main process
    window.electronAPI.onSensorChange((event, data) => {
        const { lane, value, timestamp } = data;

        if (lane === 0) {
            tag1.text(value);
            if (value === 0 && val1 === 1) {
                reverse ? client.addLap(2, timestamp) : client.addLap(0, timestamp);
                reverse ? ledManager.lap(2) : ledManager.lap(0);
            }
            val1 = value;
        } else if (lane === 1) {
            tag2.text(value);
            if (value === 0 && val2 === 1) {
                client.addLap(1, timestamp);
                ledManager.lap(1);
            }
            val2 = value;
        } else if (lane === 2) {
            tag3.text(value);
            if (value === 0 && val3 === 1) {
                reverse ? client.addLap(0, timestamp) : client.addLap(2, timestamp);
                reverse ? ledManager.lap(0) : ledManager.lap(2);
            }
            val3 = value;
        }
    });

    // keydown handler for debug mode
    document.onkeydown = (e) => {
        if (!debugMode) {
            return;
        }
        client.keydown(e.keyCode);
    };

    // Initialize hardware (after all event listeners are set up)
    try {
        await window.electronAPI.hardwareInitialize();
        log.info('Hardware initialization started');
    } catch (error) {
        log.error('Failed to initialize hardware:', error);
        if (!debugMode) {
            window.electronAPI.showMessageBoxSync({
                type: 'error',
                title: 'Error',
                message: i18n.__('dialog-connection-error'),
                detail: error.message,
                buttons: ['Ok']
            });
        }
        scheduleHardwareReconnect();
    }
}
