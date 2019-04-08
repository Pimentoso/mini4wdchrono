'use strict';

// Johnny-Five uses stdin, which causes Electron to crash
// this reroutes stdin, so it can be used
const Readable = require('stream').Readable;
const util = require('util');
util.inherits(MyStream, Readable);
function MyStream(opt) {
  Readable.call(this, opt);
}
MyStream.prototype._read = function() {};
// hook in our stream
process.__defineGetter__("stdin", function() {
  if (process.__stdin) return process.__stdin;
  process.__stdin = new MyStream();
  return process.__stdin;
});

//open links externally by default
const shell = require('electron').shell;
$(document).on('click', 'a[href^="http"]', function(event) {
		event.preventDefault();
		shell.openExternal(this.href);
});

const debugMode = false;
const { dialog } = require('electron').remote;
const temporal = require('temporal');
const configuration = require('./js/configuration');
const j5 = require('johnny-five');
const client = require('./js/client');
client.init();

const board = new j5.Board({
	repl: false // does not work with browser console
});
let connected = false;
let sensorThreshold = configuration.readSettings('sensorThreshold');
let led1, led2, led3, sensor1, sensor2, sensor3, piezo;

board.on('ready', () => {
	connected = true;
	$('#tag-board-status').removeClass('is-danger');
	$('#tag-board-status').addClass('is-success');
	$('#tag-board-status').text('CONNECTED');

	// ==== hardware init
	sensor1 = new j5.Sensor({ pin: configuration.readSettings('sensorPin1'), freq: 1, threshold: 5 });
	sensor2 = new j5.Sensor({ pin: configuration.readSettings('sensorPin2'), freq: 1, threshold: 5 });
	sensor3 = new j5.Sensor({ pin: configuration.readSettings('sensorPin3'), freq: 1, threshold: 5 });
	led1 = new j5.Led(configuration.readSettings('ledPin1'));
	led2 = new j5.Led(configuration.readSettings('ledPin2'));
	led3 = new j5.Led(configuration.readSettings('ledPin3'));
	piezo = new j5.Piezo(configuration.readSettings('piezoPin'));

	// ==== emit events to client
	sensor1.on('change', () => {
		let ok = sensor1.scaleTo(0, 100) <= sensorThreshold;
		if (ok) {
			client.sensorRead1();
			flashLed(led1);
		}
	});
	sensor2.on('change', () => {
		let ok = sensor2.scaleTo(0, 100) <= sensorThreshold;
		if (ok) {
			client.sensorRead2();
			flashLed(led2);
		}
	});
	sensor3.on('change', () => {
		let ok = sensor3.scaleTo(0, 100) <= sensorThreshold;
		if (ok) {
			client.sensorRead3();
			flashLed(led3);
		}
	});

	playConnect();
});

// TODO does not work
board.on("exit", () => {
	connected = false;
	$('#tag-board-status').removeClass('is-success');
	$('#tag-board-status').addClass('is-danger');
	$('#tag-board-status').text('NOT CONNECTED');

	led1.stop().off();
	led2.stop().off();
	led3.stop().off();
	piezo.noTone();
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

	$('#button-manches-cancel').attr('disabled', true);
	$('#button-manches-save').attr('disabled', true);
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

$('#js-load-tournament').on('click', (e) => {
	client.loadTournament();
});

$('#button-reset').on('click', (e) => {
	if (dialog.showMessageBox({ type: 'warning', message: "Start new race? All the current data will be lost.", buttons: ['Ok', 'Cancel']}) == 0) {
		client.reset();
	}
});

$('#button-start').on('click', (e) => {
	if (!connected && !debugMode) {
		dialog.showMessageBox({ type: 'error', title: 'Error', message: "Lap timer not connected. Check USB cable."});
		return;
	}
	if (debugMode) {
		client.startRound();
	}
	else {
		$('#button-start').attr('disabled', true);
		playStart();
	}
});

$('#button-prev').on('click', (e) => {
	client.prevRound();
});

$('#button-next').on('click', (e) => {
	client.nextRound();
});

$('#button-xls').on('click', (e) => {
	client.saveXls();
	$('#button-xls').attr('disabled', true);
});

$('#button-save-settings').on('click', (e) => {
	configuration.saveSettings('timeThreshold', parseInt($('#js-settings-time-threshold').val()));
	configuration.saveSettings('speedThreshold', parseInt($('#js-settings-speed-threshold').val()));
	e.preventDefault();
});

$('.js-time-form').on('keyup', (e) => {
	$('#button-manches-cancel').removeAttr('disabled');
	$('#button-manches-save').removeAttr('disabled');
});

$('#button-manches-cancel').on('click', (e) => {
	client.showMancheList();
});

$('#button-manches-save').on('click', (e) => {
	// TODO
});

// ==========================================================================
// ==== send commands to hardware

const playStart = () => {
	$('#button-start').text('READY');
	piezo.frequency(3900, 1000);

	temporal.queue([
		{
			delay: 2500,
			task: () => {
				$('#button-start').text('3');
				piezo.frequency(3900, 500);
				led1.on();
			}
		},
		{
			delay: 1000,
			task: () => {
				$('#button-start').text('2');
				piezo.frequency(3900, 500);
				led2.on();
			}
		},
		{
			delay: 1000,
			task: () => {
				$('#button-start').text('1');
				piezo.frequency(3900, 500);
				led3.on();
			}
		},
		{
			delay: 2500,
			task: () => {
				$('#button-start').text('START');
				$('#button-start').removeAttr('disabled');
				piezo.frequency(3900, 750);
				led1.off();
				led2.off();
				led3.off();
				client.startRound();
			}
		}
	]);
};

const playConnect = () => {
	temporal.queue([
		{ delay: 0, task: () => { led1.on(); }},
		{ delay: 250, task: () => { led1.off(); led2.on(); }},
		{ delay: 250, task: () => { led2.off(); led3.on(); }},
		{ delay: 250, task: () => { led3.off(); led1.on(); }},
		{ delay: 250, task: () => { led1.off(); led2.on(); }},
		{ delay: 250, task: () => { led2.off(); led3.on(); }},
		{ delay: 250, task: () => { led3.off(); led1.on(); }},
		{ delay: 250, task: () => { led1.off(); led2.on(); }},
		{ delay: 250, task: () => { led2.off(); led3.on(); }},
		{ delay: 250, task: () => { led3.off(); led1.on(); }},
		{ delay: 250, task: () => { led1.off(); led2.on(); }},
		{ delay: 250, task: () => { led2.off(); led3.on(); }},
		{ delay: 250, task: () => { led3.off(); led1.on(); }},
		{ delay: 250, task: () => { led1.off(); led2.on(); }},
		{ delay: 250, task: () => { led2.off(); led3.on(); }},
		{ delay: 250, task: () => { led3.off(); }},
	]);
};

const flashLed = (time) => {
	temporal.queue([
		{ delay: 0, task: () => { led.on(); }},
		{ delay: time || 500, task: () => { led.off(); }}
	]);
};

const playPiezo = (time) => {
	temporal.queue([
		{ delay: 0, task: () => { piezo.frequency(3900, time || 500); }},
		{ delay: time || 500, task: () => { piezo.noTone(); }}
	]);
};