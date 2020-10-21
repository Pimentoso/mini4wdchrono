'use strict';

// Johnny-Five uses stdin, which causes Electron to crash
// this reroutes stdin, so it can be used
const Readable = require('stream').Readable;
const util = require('util');
util.inherits(MyStream, Readable);
function MyStream(opt) {
	Readable.call(this, opt);
}
MyStream.prototype._read = function () { };
// hook in our stream
process.__defineGetter__("stdin", function () {
	if (process.__stdin) return process.__stdin;
	process.__stdin = new MyStream();
	return process.__stdin;
});

////////////////////////
const debugMode = false;
////////////////////////

const { dialog, shell, app, webContents } = require('electron').remote;

const log = require('electron-log');
log.info(`Launched Mini4wdChrono at ${new Date()}`);
log.catchErrors();

const j5 = require('johnny-five');
const configuration = require('./js/configuration');
const i18n = new (require('./i18n/i18n'));

// load conf
try {
	configuration.init();
}
catch (e) {
	// JSON parse error
	log.error("Error loading configuration.");
	log.error(e.message);
	let backup_filepath = configuration.reset();
	dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-configuration-error'), detail: `${i18n.__('dialog-configuration-error-detail')} ${backup_filepath}` });
}

const storage = require('./js/storage');
const client = require('./js/client');
const ui = require('./js/ui');
const xls = require('./js/export');

// load race from file
storage.loadRace();

// Show version in about tab
$('#js-about-version').text(`Version ${app.getVersion()}`);

// open links externally by default
$(document).on('click', 'a[href^="http"]', function (event) {
	event.preventDefault();
	shell.openExternal(this.href);
});

// Johnny-Five initialize
const board = new j5.Board({
	port: configuration.get('usbPort'),
	timeout: 1e5,
	repl: false // does not work with browser console
});
var connected = false;
var ledManager;
var button1;
var sensorPin1, sensorPin2, sensorPin3;
var tag1, tag2, tag3;
var val1 = 0, val2 = 0, val3 = 0;

// led manager instance
if (debugMode) {
	const LedManagerMock = require('./js/led_managers/led_manager_mock');
	ledManager = LedManagerMock.getInstance(board, configuration.get('piezoPin'));
}
else if (configuration.get('ledType') == 0) {
	const LedManagerLilypad = require('./js/led_managers/led_manager_lilypad');
	ledManager = LedManagerLilypad.getInstance(board, [
			configuration.get('ledPin1'),
			configuration.get('ledPin2'),
			configuration.get('ledPin3')
		],
		configuration.get('piezoPin')
	);
}
else if (configuration.get('ledType') == 1) {
	var LedManagerRgbStrip = require('./js/led_managers/led_manager_rgb_strip');
	ledManager = LedManagerRgbStrip.getInstance(
		board,
		configuration.get('ledPin1'),
		configuration.get('piezoPin')
	);
}

// translate ui
$('.tn').each(function () {
	$(this).text(i18n.__($(this).data('tn')));
});
$('#main').show();

// init client
client.init();

// Start race function. Handles all hardware checks.
const startRace = () => {
	log.info(`Starting race at ${new Date()}`);
	if (!connected && !debugMode) {
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-disconnected') });
		return;
	}
	client.startRace(debugMode);
}

// board events
board.on('ready', function () {
	connected = true;
	log.info(`Board READY at ${new Date()}`);

	tag1 = $('#sensor-reading-1');
	tag2 = $('#sensor-reading-2');
	tag3 = $('#sensor-reading-3');

	// init start button if present
	button1 = new j5.Button(configuration.get('startButtonPin'));
	button1.on("release", startRace);

	// raw reading from digital pins because it's faster
	sensorPin1 = configuration.get('sensorPin1');
	sensorPin2 = configuration.get('sensorPin2');
	sensorPin3 = configuration.get('sensorPin3');

	this.samplingInterval(1);
	this.pinMode(sensorPin1, j5.Pin.INPUT);
	this.pinMode(sensorPin2, j5.Pin.INPUT);
	this.pinMode(sensorPin3, j5.Pin.INPUT);

	this.digitalRead(sensorPin1, function (val) {
		tag1.text(val);
		if (val == 0 && val1 == 1) {
			client.sensorRead(1);
			ledManager.lap(0);
		}
		val1 = val;
	});

	this.digitalRead(sensorPin2, function (val) {
		tag2.text(val);
		if (val == 0 && val2 == 1) {
			client.sensorRead(2);
			ledManager.lap(1);
		}
		val2 = val;
	});

	this.digitalRead(sensorPin3, function (val) {
		tag3.text(val);
		if (val == 0 && val3 == 1) {
			client.sensorRead(3);
			ledManager.lap(2);
		}
		val3 = val;
	});

	ledManager.connected();
	ui.boardConnected();
});

board.on("info", function (event) {
	log.info(`Board INFO at ${new Date()} - ${event.message}`);
});

board.on("warn", function (event) {
	log.warn(`Board WARN at ${new Date()} - ${event.message}`);
});

board.on("fail", function (event) {
	connected = false;
	log.error(`Board FAIL at ${new Date()} - ${event.message}`);

	ledManager.disconnected();
	ui.boardDisonnected();

	if (!debugMode) {
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-connection-error'), detail: event.message, buttons: ['Ok'] });
	}
});

board.on("error", function (event) {
	connected = false;
	log.error(`Board ERROR at ${new Date()} - ${event.message}`);

	ledManager.disconnected();
	ui.boardDisonnected();

	if (!debugMode) {
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-connection-error'), detail: event.message });
	}
});

board.on("info", function (event) {
	log.info(`Board INFO at ${new Date()} - ${event.message}`);
});

board.on("warn", function (event) {
	log.warn(`Board WARN at ${new Date()} - ${event.message}`);
});

// TODO does not work
board.on("close", function (event) {
	connected = false;
	log.error(`Board CLOSE at ${new Date()} - ${event.message}`);
	ui.boardDisonnected();
	ledManager.disconnected();
});

board.on("exit", function (event) {
	connected = false;
	log.error(`Board EXIT at ${new Date()} - ${event.message}`);
	ui.boardDisonnected();
	ledManager.disconnected();
});

// ==========================================================================
// ==== listen to interface events and propagate to client

// tabs
$('.tabs a').on('click', (e) => {
	let $this = $(e.currentTarget);
	$('.tabs li').removeClass('is-active');
	$this.closest('li').addClass('is-active');
	let tab = $this.closest('li').data('tab');
	$('div[data-tab]').hide();
	$(`div[data-tab=${tab}]`).show();
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
	let $this = $(e.currentTarget);
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
$(document).on('click', '.js-load-race', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	let filename = $this.data('filename');
	storage.loadRace(filename);
	client.init();
	closeAllModals();
});

$(document).on('click', '.js-delete-race', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	if (dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-delete-race'), buttons: ['Ok', 'Cancel'] }) == 0) {
		let filename = $this.data('filename');
		storage.deleteRace(filename);
		closeAllModals();
	}
});

$('#js-load-track').on('click', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	let code = $('#js-input-track-code').val().slice(-6);
	client.loadTrack(code);
});

$('#js-track-save-manual').on('click', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	if (dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-save-track'), buttons: ['Ok', 'Cancel'] }) == 0) {
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
		let length = parseFloat($('#js-track-length-manual').val().replace(',', '.'));
		let order = _.map($('#js-track-order-manual').val().split('-'), (i) => { return parseInt(i); });
		client.setTrackManual(length, order);
	}
});

$('#js-load-tournament').on('click', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	let code = $('#js-input-tournament-code').val().slice(-6);
	client.loadTournament(code);
});

$('#button-new-race').on('click', (e) => {
	let name = $('#modal-new-name').val().trim();
	if (name == '') return false;
	client.reset(name);
	closeAllModals();
});

$('#button-start').on('click', startRace);

$('#button-stop').on('click', (e) => {
	client.stopRace();
});

$('#button-prev').on('click', (e) => {
	client.prevRound();
});

$('#button-next').on('click', (e) => {
	client.nextRound();
});

$('#button-toggle-free-round').on('click', (e) => {
	client.toggleFreeRound();
});

$('#button-print').on('click', (e) => {
	webContents.getFocusedWebContents().print();
});

$('#button-xls').on('click', (e) => {
	client.saveXls();
	$('#button-xls').attr('disabled', true);
});

$('#button-xls-folder').on('click', (e) => {
	let dir = xls.createDir();
	shell.openItem(dir);
});

$('#button-log-file').on('click', (e) => {
	shell.openItem(log.transports.file.findLogPath());
});

$('#js-settings-speed-threshold').on('keyup', (e) => {
	let timeThreshold = parseFloat($('#js-settings-time-threshold').val().replace(',', '.'));
	let speedThreshold = parseFloat($('#js-settings-speed-threshold').val().replace(',', '.'));
	if (isNaN(timeThreshold) || isNaN(speedThreshold)) return;
	ui.showThresholds(timeThreshold, speedThreshold);
});

$('#js-settings-time-threshold').on('keyup', (e) => {
	let timeThreshold = parseFloat($('#js-settings-time-threshold').val().replace(',', '.'));
	let speedThreshold = parseFloat($('#js-settings-speed-threshold').val().replace(',', '.'));
	if (isNaN(timeThreshold) || isNaN(speedThreshold)) return;
	ui.showThresholds(timeThreshold, speedThreshold);
});

$('#button-save-settings').on('click', (e) => {
	let timeThreshold = parseFloat($('#js-settings-time-threshold').val().replace(',', '.'));
	let speedThreshold = parseFloat($('#js-settings-speed-threshold').val().replace(',', '.'));
	let startDelay = parseFloat($('#js-settings-start-delay').val().replace(',', '.'));
	storage.set('timeThreshold', timeThreshold);
	storage.set('speedThreshold', speedThreshold);
	storage.set('startDelay', startDelay);
	ui.showThresholds();
	e.preventDefault();
});

$('#button-save-config').on('click', (e) => {
	configuration.set('sensorPin1', parseInt($('#js-config-sensor-pin-1').val()));
	configuration.set('sensorPin2', parseInt($('#js-config-sensor-pin-2').val()));
	configuration.set('sensorPin3', parseInt($('#js-config-sensor-pin-3').val()));
	configuration.set('ledPin1', parseInt($('#js-config-led-pin-1').val()));
	configuration.set('ledPin2', parseInt($('#js-config-led-pin-2').val()));
	configuration.set('ledPin3', parseInt($('#js-config-led-pin-3').val()));
	configuration.set('piezoPin', parseInt($('#js-config-piezo-pin').val()));
	configuration.set('startButtonPin', parseInt($('#js-config-start-button-pin').val()));
	configuration.set('title', $('#js-config-title').val());
	configuration.set('usbPort', $('#js-config-usb-port').val());
	dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-restart') });
	e.preventDefault();
});

$('#button-manches-save').on('click', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	client.overrideTimes();
	dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-saved') });
});

$('.js-led-type').on('click', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	$('.js-led-type').removeClass('is-primary');
	$this.addClass('is-primary');
	let type = $this.data('led-type');
	configuration.set('ledType', type);
});

$('.js-race-mode').on('click', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	$('.js-race-mode').removeClass('is-primary');
	$this.addClass('is-primary');
	let mode = $this.data('race-mode');
	storage.set('raceMode', mode);
	ui.showRaceModeDetails();
});

$('.js-invalidate').on('click', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	if (dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-disqualify'), buttons: ['Ok', 'Cancel'] }) == 0) {
		client.disqualify(null, null, parseInt($this.data('lane')));
	}
});
