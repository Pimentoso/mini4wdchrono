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

const electron = require('electron');

const log = require('electron-log');
log.info(`Launched Mini4wdChrono at ${new Date()}`);
log.catchErrors();

const { dialog, shell, app } = electron.remote;
const j5 = require('johnny-five');
const xls = require('./js/export');
const configuration = require('./js/configuration');
const client = require('./js/client');
const utils = require('./js/utils');
const i18n = new (require('./i18n/i18n'));

// Show version in about tab
$('#js-about-version').text('Version ' + app.getVersion());

// open links externally by default
$(document).on('click', 'a[href^="http"]', function (event) {
	event.preventDefault();
	shell.openExternal(this.href);
});

// Johnny-Five initialize
const board = new j5.Board({
	port: configuration.readSettings('usbPort'),
	timeout: 1e5,
	repl: false // does not work with browser console
});
let connected = false;
let sensorPin1, sensorPin2, sensorPin3, buzzerPin;
let led1, led2, led3;
let tag1, tag2, tag3;

board.on('ready', function () {
	connected = true;
	log.info(`Board READY at ${new Date()}`);

	$('#tag-board-status').addClass('is-success');
	$('#tag-board-status').text(i18n.__('tag-connected'));

	tag1 = $('#sensor-reading-1');
	tag2 = $('#sensor-reading-2');
	tag3 = $('#sensor-reading-3');

	// ==== hardware init
	led1 = new j5.Led(configuration.readSettings('ledPin1'));
	led2 = new j5.Led(configuration.readSettings('ledPin2'));
	led3 = new j5.Led(configuration.readSettings('ledPin3'));

	// raw reading from digital pins because it's faster
	sensorPin1 = configuration.readSettings('sensorPin1');
	sensorPin2 = configuration.readSettings('sensorPin2');
	sensorPin3 = configuration.readSettings('sensorPin3');
	buzzerPin = configuration.readSettings('piezoPin')

	this.samplingInterval(1);
	this.pinMode(sensorPin1, j5.Pin.INPUT);
	this.pinMode(sensorPin2, j5.Pin.INPUT);
	this.pinMode(sensorPin3, j5.Pin.INPUT);
	this.pinMode(buzzerPin, j5.Pin.OUTPUT);

	this.digitalRead(sensorPin1, function (val) {
		tag1.text(val);
		if (val == 0) {
			client.sensorRead(1);
			flashLed(led1);
		}
	});

	this.digitalRead(sensorPin2, function (val) {
		tag2.text(val);
		if (val == 0) {
			client.sensorRead(2);
			flashLed(led2);
		}
	});

	this.digitalRead(sensorPin3, function (val) {
		tag3.text(val);
		if (val == 0) {
			client.sensorRead(3);
			flashLed(led3);
		}
	});

	playConnect();
});

board.on("fail", function (event) {
	connected = false;
	log.error(`Board ERROR at ${new Date()} - ${event.message}`);

	$('#tag-board-status').addClass('is-danger');
	$('#tag-board-status').text(i18n.__('tag-disconnected'));
	if (!debugMode) {
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-connection-error'), detail: event.message });
	}
});

board.on("error", function (event) {
	connected = false;
	log.error(`Board EXIT at ${new Date()} - ${event.message}`);

	$('#tag-board-status').addClass('is-danger');
	$('#tag-board-status').text(i18n.__('tag-disconnected'));
	if (!debugMode) {
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-connection-error'), detail: event.message });
	}
});

board.on("close", function (event) {
	connected = false;
	log.error(`Board CLOSE at ${new Date()} - ${event.message}`);

	$('#tag-board-status').removeClass('is-success');
	$('#tag-board-status').addClass('is-danger');
	$('#tag-board-status').text(i18n.__('tag-disconnected'));

	led1.stop().off();
	led2.stop().off();
	led3.stop().off();
	board.digitalWrite(buzzerPin, 0);
});

board.on("info", function (event) {
	log.info(`Board INFO at ${new Date()} - ${event.message}`);
});

board.on("warn", function (event) {
	log.warn(`Board WARN at ${new Date()} - ${event.message}`);
});

// TODO does not work
board.on("exit", function (event) {
	connected = false;
	log.error(`Board EXIT at ${new Date()} - ${event.message}`);

	$('#tag-board-status').removeClass('is-success');
	$('#tag-board-status').addClass('is-danger');
	$('#tag-board-status').text(i18n.__('tag-disconnected'));

	led1.stop().off();
	led2.stop().off();
	led3.stop().off();
	board.digitalWrite(buzzerPin, 0);
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
	$('div[data-tab=' + tab + ']').show();

	$('#button-manches-save').attr('disabled', true);
	$('#button-manches-cancel').attr('disabled', true);
});

document.onkeydown = (e) => {
	if (!debugMode) {
		return;
	}
	client.keydown(e.keyCode);
};

$('#js-load-track').on('click', (e) => {
	client.loadTrack();
});

$('#js-track-save-manual').on('click', (e) => {
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
	client.loadTournament();
});

$('#button-reset').on('click', (e) => {
	if (dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-new-race'), buttons: ['Ok', 'Cancel'] }) == 0) {
		client.reset();
	}
});

$('#button-start').on('click', (e) => {
	if (!connected && !debugMode) {
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-disconnected') });
		return;
	}
	if (configuration.readSettings('track') == null) {
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-track-not-loaded') });
		return;
	}

	if (debugMode) {
		// debug mode
		client.raceStarted();
		client.initRound();
		client.startRound();
	}
	else {
		// production mode
		if (!client.isFreeRound() && configuration.readSettings('tournament') && configuration.loadRound()) {
			// TODO MODAL SPAREGGIO

			if (dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-replay-round'), buttons: ['Ok', 'Cancel'] }) == 1) {
				return;
			}
		}
		client.raceStarted();
		playStart();
	}
});

$('#button-stop').on('click', (e) => {
	client.stopRound();
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

$('#button-save-settings').on('click', (e) => {
	configuration.saveSettings('timeThreshold', parseFloat($('#js-settings-time-threshold').val().replace(',', '.')));
	configuration.saveSettings('speedThreshold', parseFloat($('#js-settings-speed-threshold').val().replace(',', '.')));
	configuration.saveSettings('startDelay', parseFloat($('#js-settings-start-delay').val().replace(',', '.')));
	client.showThresholds();
	e.preventDefault();
});

$('#button-save-config').on('click', (e) => {
	configuration.saveSettings('sensorPin1', $('#js-config-sensor-pin-1').val());
	configuration.saveSettings('sensorPin2', $('#js-config-sensor-pin-2').val());
	configuration.saveSettings('sensorPin3', $('#js-config-sensor-pin-3').val());
	configuration.saveSettings('ledPin1', parseInt($('#js-config-led-pin-1').val()));
	configuration.saveSettings('ledPin2', parseInt($('#js-config-led-pin-2').val()));
	configuration.saveSettings('ledPin3', parseInt($('#js-config-led-pin-3').val()));
	configuration.saveSettings('piezoPin', parseInt($('#js-config-piezo-pin').val()));
	configuration.saveSettings('title', $('#js-config-title').val());
	configuration.saveSettings('usbPort', $('#js-config-usb-port').val());
	dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-restart') });
	e.preventDefault();
});

$(document).on('keyup', '.js-time-form', (e) => {
	$('#button-manches-save').removeAttr('disabled');
	$('#button-manches-cancel').removeAttr('disabled');
});

$('#button-manches-cancel').on('click', (e) => {
	client.showMancheList();
	$('#button-manches-save').attr('disabled', true);
	$('#button-manches-cancel').attr('disabled', true);
});

$('#button-manches-save').on('click', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	client.overrideTimes();
	$('#button-manches-save').attr('disabled', true);
	$('#button-manches-cancel').attr('disabled', true);
});

$('.js-race-mode').on('click', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	$('.js-race-mode').removeClass('is-primary');
	$this.addClass('is-primary');
	let mode = $this.data('race-mode');
	configuration.saveSettings('raceMode', mode);
	switch (mode) {
		case 0:
			$('#js-race-mode-description').text(i18n.__('button-race-mode-time-attack-description'));
			break;
		case 1:
			$('#js-race-mode-description').text(i18n.__('button-race-mode-final-description'));
			break;
		case 2:
			$('#js-race-mode-description').text(i18n.__('button-race-mode-endurance-description'));
			break;
	}
});

$('.js-invalidate').on('click', (e) => {
	let $this = $(e.currentTarget);
	if ($this.attr('disabled')) return;
	if (dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-disqualify'), buttons: ['Ok', 'Cancel'] }) == 0) {
		client.disqualify(null, null, parseInt($this.data('lane')));
	}
});

// ==========================================================================
// ==== send commands to hardware

const flashLed = (led) => {
	led.on();
	utils.delay(() => { led.off(); }, 1000);
};

const playBuzzer = (millis) => {
	board.digitalWrite(buzzerPin, 1);
	utils.delay(() => { board.digitalWrite(buzzerPin, 0); }, millis);
};

const playStart = () => {
	client.initRound();
	led1.on(); led2.on(); led3.on(); playBuzzer(1500);
	utils
		.delay(() => { led1.off(); led2.off(); led3.off(); }, 1500)
		.delay(() => { led1.on(); playBuzzer(500); }, 1000)
		.delay(() => { led1.off(); led2.on(); playBuzzer(500); }, 1000)
		.delay(() => { led2.off(); led3.on(); playBuzzer(500); }, 1000)
		.delay(() => { led3.off(); }, 1000)
		.delay(() => { led1.on(); led2.on(); led3.on(); playBuzzer(1000); client.startRound(); }, 1500)
		.delay(() => { led1.off(); led2.off(); led3.off(); }, 2500);
};

const playConnect = () => {
	led1.blink(125); led2.blink(125); led3.blink(125);
	utils.delay(() => { led1.stop().off(); led2.stop().off(); led3.stop().off(); }, 3000);
};

// ==========================================================================
// ==== init client

client.init();
