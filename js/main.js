'use strict';

const debugMode = window.electronAPI.isDebugMode;

const log = require('electron-log/renderer');

// Use IPC to get app version
window.electronAPI.getAppVersion().then(version => {
    log.info(' ');
    log.info(`Launched Mini4wdChrono v${version} at ${new Date()}`);
});
log.catchErrors();

const configuration = require('./js/configuration');
const i18n = new (require('./i18n/i18n'));
const storage = require('./js/storage');
const client = require('./js/client');
const ui = require('./js/ui');
const utils = require('./js/utils');

// Loads cached renderer state before initializing the application.
(async () => {
    try {
        try {
            utils.setLocale(await window.electronAPI.getAppLocale());
        } catch (err) {
            log.warn('[Locale] Could not get app locale; using default:', err);
            utils.setLocale('en-US');
        }

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

// Initializes renderer UI, hardware listeners, and reconnection handling.
async function initializeApplication() {
    // Hardware state variables
    let connected = false;
    let reverse;
    let tag1, tag2, tag3;
    let val1 = 0, val2 = 0, val3 = 0;
    let reconnectTimer = null;
    let reconnectInProgress = false;
    let initialHardwareConnection = true;

    // Initialize LED manager
    const LedManager = require('./js/led_manager');
    const ledManager = LedManager.getInstance(
        configuration.get('ledPin1'),
        configuration.get('piezoPin'),
        configuration.get('reverse') > 0
    );

    // init client
    client.init({ led_manager: ledManager });

    // Validates hardware state before starting a race.
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

    // Toggles the race from the physical start button.
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

    // Configures sensors, LEDs, and buzzer after the board is ready.
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

            log.info('[Hardware] All components configured');

            ledManager.connected();
            ui.boardConnected();
        } catch (error) {
            log.error('Error during hardware setup:', error);
        }
    };

    // Schedules one hardware reconnection attempt after a disconnect.
    const scheduleHardwareReconnect = () => {
        if (debugMode) {
            return;
        }

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
        }, 1000);
    };

    // Listen for board ready event from main process
    window.electronAPI.onBoardReady(async () => {
        connected = true;
        initialHardwareConnection = false;
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
        }
        log.info(`Board READY at ${new Date()}`);
        await setupHardwareComponents();
    });

    // Listen for board errors from main process
    window.electronAPI.onBoardError((event, errorMessage) => {
        void event;
        connected = false;
        ledManager.disconnected();
        ui.boardDisconnected();

        log.error(`Board ERROR at ${new Date()} - ${errorMessage}`);
        if (initialHardwareConnection) {
            ui.showBootPortSelection(errorMessage);
        }
    });

    // Listen for board closed event from main process
    window.electronAPI.onBoardClosed((event, errorMessage) => {
        void event;
        connected = false;
        ledManager.disconnected();
        ui.boardDisconnected();

        log.error(`Board closed at ${new Date()} - ${errorMessage || 'Unknown reason'}`);
        if (initialHardwareConnection) {
            ui.showBootPortSelection(errorMessage);
            return;
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

    // Simulates a sensor trigger with a main-process timestamp in debug mode.
    document.onkeydown = async (e) => {
        if (!debugMode) {
            return;
        }

        if (e.repeat) {
            return;
        }

        if (![49, 50, 51, 97, 98, 99].includes(e.keyCode)) {
            return;
        }

        try {
            const { timestamp } = await window.electronAPI.hardwareCreateSensorTimestamp();
            client.keydown(e.keyCode, timestamp);
        } catch (error) {
            log.error('[Hardware] Failed to simulate sensor trigger:', error);
        }
    };

    // Initialize hardware (after all event listeners are set up)
    if (debugMode) {
        ui.debugModeEnabled();
        log.info('[Hardware] Debug mode enabled; hardware initialization skipped');
        return;
    }

    try {
        await window.electronAPI.hardwareInitialize();
        log.info('Hardware initialization started');
    } catch (error) {
        log.error('Failed to initialize hardware:', error);
        ui.showBootPortSelection(error.message);
    }
}
