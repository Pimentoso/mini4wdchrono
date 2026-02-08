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
const xls = require('./js/export');
const utils = require('./js/utils');

// Handles loading configuration and storage via IPC
(async () => {
    try {
        // Initialize locale for utils
        await utils.initLocale();
        
        // Initialize configuration and storage via IPC
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
        await window.electronAPI.showMessageBox({
            type: 'error',
            title: 'Error',
            message: i18n.__('dialog-configuration-error'),
            detail: `${i18n.__('dialog-configuration-error-detail')} Check logs for details`,
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
    // Show version in about tab (async)
    window.electronAPI.getAppVersion().then(version => {
        $('#js-about-version').text(`Version ${version}`);
    });

    // open links externally by default
    $(document).on('click', 'a[href^="http"]', function (event) {
        event.preventDefault();
        window.electronAPI.openExternal(this.href);
    });

    let connected = false;
    let reverse;
    let ledManager;
    let sensorPin1, sensorPin2, sensorPin3;
    let tag1, tag2, tag3;
    let val1 = 0, val2 = 0, val3 = 0;

    // LED manager instance - temporarily keep in renderer
    // TODO: Will be refactored in Step 4
    if (debugMode) {
        const LedManagerMock = require('./js/led_managers/led_manager_mock');
        ledManager = LedManagerMock.getInstance(await configuration.get('piezoPin'));
    }
    else {
        const LedManagerRgbStrip = require('./js/led_managers/led_manager_rgb_strip');
        ledManager = LedManagerRgbStrip.getInstance(
            null,
            await configuration.get('ledPin1'),
            await configuration.get('piezoPin'),
            (await configuration.get('reverse')) > 0
        );
    }

    // translate ui
    ui.translate();

    // init client
    await client.init({ led_manager: ledManager });

    // show interface
    $('#main').show();
    
    // Start race function. Handles all hardware checks.
    const startRace = async () => {
        log.info(`Starting race at ${new Date()}`);
        if (!debugMode) {
            if (!connected) {
                await window.electronAPI.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-disconnected'), buttons: ['Ok'] });
                return;
            }
            else if (tag1.text() !== '1') {
                await window.electronAPI.showMessageBox({ type: 'error', title: 'Error', message: `${i18n.__('dialog-sensor-error')} 1`, buttons: ['Ok'] });
                return;
            }
            else if (tag2.text() !== '1') {
                await window.electronAPI.showMessageBox({ type: 'error', title: 'Error', message: `${i18n.__('dialog-sensor-error')} 2`, buttons: ['Ok'] });
                return;
            }
            else if (tag3.text() !== '1') {
                await window.electronAPI.showMessageBox({ type: 'error', title: 'Error', message: `${i18n.__('dialog-sensor-error')} 3`, buttons: ['Ok'] });
                return;
            }
        }
        client.startRace(debugMode);
    };
    
    const buttonPressed = () => {
        client.isStarted() ? client.stopRace() : startRace();
    };
    
    // Set up button press listener
    window.electronAPI.onButtonPress(() => {
        buttonPressed();
    });
    
    try {
        // Initialize board in main process
        await window.electronAPI.hardwareInitialize();
        log.info('Hardware initialization started');
    } catch (error) {
        log.error('Failed to initialize hardware:', error);
        if (!debugMode) {
            await window.electronAPI.showMessageBox({ 
                type: 'error', 
                title: 'Error', 
                message: i18n.__('dialog-connection-error'), 
                detail: error.message, 
                buttons: ['Ok'] 
            });
        }
    }
    
    // Listen for board ready event from main process
    window.electronAPI.onBoardReady(async () => {
        try {
            connected = true;
            log.info(`Board READY at ${new Date()}`);
        
            tag1 = $('#sensor-reading-1');
            tag2 = $('#sensor-reading-2');
            tag3 = $('#sensor-reading-3');
        
            // Get sensor pin configuration
            sensorPin1 = await configuration.get('sensorPin1');
            sensorPin2 = await configuration.get('sensorPin2');
            sensorPin3 = await configuration.get('sensorPin3');
        
            reverse = (await configuration.get('reverse')) > 0;
            
            // Set up sensors in main process
            await window.electronAPI.hardwareSetupSensors({
                sensorPin1: sensorPin1,
                sensorPin2: sensorPin2,
                sensorPin3: sensorPin3
            });
            
            // Set up start button in main process
            await window.electronAPI.hardwareSetupButton({
                startButtonPin: await configuration.get('startButtonPin')
            });
            log.info('Start button configured');
            
            // Set up LEDs in main process
            await window.electronAPI.hardwareSetupLeds({
                ledPin1: await configuration.get('ledPin1'),
                ledPin2: await configuration.get('ledPin2'),
                ledPin3: await configuration.get('ledPin3'),
                reverse: (await configuration.get('reverse')) > 0
            });
            
            // Set up buzzer in main process
            await window.electronAPI.hardwareSetupBuzzer({
                piezoPin: await configuration.get('piezoPin')
            });
            
            log.info('Hardware components configured');
        
            ledManager.connected();
            ui.boardConnected();
        } catch (error) {
            log.error('Error during board ready setup:', error);
        }
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
    
    // Listen for board errors from main process
    window.electronAPI.onBoardError(async (event, errorMessage) => {
        connected = false;
        ledManager.disconnected();
        ui.boardDisconnected();
    
        log.error(`Board ERROR at ${new Date()} - ${errorMessage}`);
        if (!debugMode) {
            await window.electronAPI.showMessageBox({ 
                type: 'error', 
                title: 'Error', 
                message: i18n.__('dialog-connection-error'), 
                detail: errorMessage, 
                buttons: ['Ok'] 
            });
        }
    });
    
    // ==========================================================================
    // ==== listen to interface events and propagate to client
    
    // tabs
    $('.tabs a').on('click', (e) => {
        const $this = $(e.currentTarget);
        const tab = $this.closest('li').data('tab');
        ui.gotoTab(tab);
    });
    
    // modals
    const openModal = (modal) => {
        $(`#${modal}`).addClass('is-active');
        $(document.documentElement).addClass('is-clipped');
    };
    
    const closeAllModals = () => {
        $('.modal').removeClass('is-active');
        $(document.documentElement).removeClass('is-clipped');
    };
    
    $('.open-modal').on('click', (e) => {
        const $this = $(e.currentTarget);
        openModal($this.data('modal'));
        ui.initModal($this.data('modal'));
    });
    
    $('.close-modal').on('click', closeAllModals);
    
    // keydown
    document.onkeydown = (e) => {
        if (!debugMode) {
            return;
        }
        client.keydown(e.keyCode);
    };
    
    // ui observers
    $(document).on('click', '.js-load-race', async (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const filename = $this.data('filename');
        storage.loadRace(filename);
        await client.init({ led_manager: ledManager });
        closeAllModals();
    });
    
    $(document).on('click', '.js-delete-race', async (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const result = await window.electronAPI.showMessageBox({ type: 'warning', message: i18n.__('dialog-delete-race'), buttons: ['Ok', 'Cancel'] });
        if (result.response === 0) {
            const filename = $this.data('filename');
            storage.deleteRace(filename);
            closeAllModals();
        }
    });
    
    $('#js-load-track').on('click', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const code = $('#js-input-track-code').val().slice(-6);
        client.loadTrack(code);
    });
    
    $('#js-track-save-manual').on('click', async (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const result = await window.electronAPI.showMessageBox({ type: 'warning', message: i18n.__('dialog-save-track'), buttons: ['Ok', 'Cancel'] });
        if (result.response === 0) {
            $('#js-track-length-manual').removeClass('is-danger');
            $('#js-track-order-manual').removeClass('is-danger');
            if (!$('#js-track-length-manual').val()) {
                $('#js-track-length-manual').addClass('is-danger');
                return;
            }
            if (!$('#js-track-order-manual').val()) {
                $('#js-track-order-manual').addClass('is-danger');
                return;
            }
            const length = parseFloat($('#js-track-length-manual').val().replace(',', '.'));
            const order = _.map($('#js-track-order-manual').val().split('-'), (i) => { return parseInt(i); });
            client.setTrackManual(length, order);
        }
    });
    
    $('#js-load-tournament').on('click', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const code = $('#js-input-tournament-code').val().slice(-6);
        client.loadTournament(code);
    });
    
    $('#button-new-race').on('click', () => {
        const name = $('#modal-new-name').val().trim();
        if (name === '') return false;
        client.reset(name);
        closeAllModals();
    });
    
    $('#button-start').on('click', startRace);
    
    $('#button-stop').on('click', () => {
        client.stopRace();
    });
    
    $('#button-prev').on('click', () => {
        client.prevRound();
    });
    
    $('#button-next').on('click', () => {
        client.nextRound();
    });
    
    $('#button-toggle-free-round').on('click', () => {
        client.toggleFreeRound();
    });
    
    $('#button-print').on('click', () => {
        // TODO webContents.getFocusedWebContents().print();
    });
    
    $('#button-xls').on('click', () => {
        client.saveXls();
        $('#button-xls').attr('disabled', true);
    });
    
    $('#button-xls-folder').on('click', () => {
        const dir = xls.createDir();
        window.electronAPI.openPath(dir);
    });
    
    $('#button-log-file').on('click', () => {
        window.electronAPI.openPath(log.transports.file.findLogPath());
    });
    
    const updateThresholds = () => {
        const timeThreshold = parseFloat($('#js-settings-time-threshold').val().replace(',', '.'));
        const speedThreshold = parseFloat($('#js-settings-speed-threshold').val().replace(',', '.'));
        const roundLaps = parseInt($('#js-settings-round-laps').val());
        if (isNaN(timeThreshold) || isNaN(speedThreshold)) return;
        ui.showThresholds(timeThreshold, speedThreshold, roundLaps);
    };
    
    $('#js-settings-speed-threshold').on('keyup', updateThresholds);
    
    $('#js-settings-time-threshold').on('keyup', updateThresholds);
    
    $('#js-settings-round-laps').on('change', updateThresholds);
    
    $('#button-save-settings').on('click', (e) => {
        const timeThreshold = parseFloat($('#js-settings-time-threshold').val().replace(',', '.'));
        const speedThreshold = parseFloat($('#js-settings-speed-threshold').val().replace(',', '.'));
        const startDelay = parseFloat($('#js-settings-start-delay').val().replace(',', '.'));
        const roundLaps = parseInt($('#js-settings-round-laps').val());
        storage.set('timeThreshold', timeThreshold);
        storage.set('speedThreshold', speedThreshold);
        storage.set('startDelay', startDelay);
        storage.set('roundLaps', roundLaps);
        ui.showThresholds();
        e.preventDefault();
    });
    
    $('#button-save-config').on('click', async (e) => {
        configuration.set('reverse', $('#js-config-reverse').is(':checked') ? 1 : 0);
        configuration.set('sensorPin1', parseInt($('#js-config-sensor-pin-1').val()));
        configuration.set('sensorPin2', parseInt($('#js-config-sensor-pin-2').val()));
        configuration.set('sensorPin3', parseInt($('#js-config-sensor-pin-3').val()));
        configuration.set('ledPin1', parseInt($('#js-config-led-pin-1').val()));
        configuration.set('ledPin2', parseInt($('#js-config-led-pin-2').val()));
        configuration.set('ledPin3', parseInt($('#js-config-led-pin-3').val()));
        configuration.set('piezoPin', parseInt($('#js-config-piezo-pin').val()));
        configuration.set('startButtonPin', parseInt($('#js-config-start-button-pin').val()));
        configuration.set('title', $('#js-config-title').val());
        configuration.set('tab', $('#js-config-starting-tab').val());
        configuration.set('usbPort', $('#js-config-usb-port').val());
        await window.electronAPI.showMessageBox({ type: 'warning', message: i18n.__('dialog-restart'), buttons: ['Ok'] });
        location.reload();
        e.preventDefault();
    });
    
    $('#button-manches-save').on('click', async (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        client.overrideTimes();
        await window.electronAPI.showMessageBox({ type: 'warning', message: i18n.__('dialog-saved'), buttons: ['Ok'] });
    });
    
    $(document).on('click', '.js-goto-round', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const mindex = $this.data('manche');
        const rindex = $this.data('round');
        client.gotoRound(mindex, rindex);
    });
    
    $('.js-led-animation').on('click', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        $('.js-led-animation').removeClass('is-primary');
        $this.addClass('is-primary');
        const type = $this.data('led-animation');
        configuration.set('ledAnimation', type);
    });
    
    $('.js-race-mode').on('click', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        $('.js-race-mode').removeClass('is-primary');
        $this.addClass('is-primary');
        const mode = $this.data('race-mode');
        storage.set('raceMode', mode);
        ui.showRaceModeDetails();
    });
    
    $('.js-invalidate').on('click', async (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const result = await window.electronAPI.showMessageBox({ type: 'warning', message: i18n.__('dialog-disqualify'), buttons: ['Ok', 'Cancel'] });
        if (result.response === 0) {
            client.disqualify(null, null, parseInt($this.data('lane')));
        }
    });
    
} // End of initializeApplication function
