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

const debugMode = true;
const j5 = require('johnny-five');
const client = require('./js/client');
client.init();

const board = new j5.Board({
	repl: false // does not work with browser console
});
let connected = false;
let led1, led2, led3, sensor1, sensor2, sensor3, piezo;

board.on('ready', () => {
	connected = true;
	client.boardConnected();

	// ==== hardware init
	sensor1 = new j5.Sensor.Digital(8);
	sensor2 = new j5.Sensor.Digital(9);
	sensor3 = new j5.Sensor.Digital(10);
	led1 = new j5.Led(13);
	led2 = new j5.Led(14);
	led3 = new j5.Led(15);
	piezo = new j5.Piezo(3);

	// ==== emit events to client
	sensor1.on('change', (e) => {
		client.sensorRead1(e);
	});
	sensor2.on('change', (e) => {
		client.sensorRead2(e);
	});
	sensor3.on('change', (e) => {
		client.sensorRead3(e);
	});
});

// TODO does not work
board.on("exit", () => {
	connected = false;
	client.boardDisonnected();

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

$('#button-start').on('click', (e) => {
	if (!connected && !debugMode) {
		console.log('Error: board not connected');
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

// ==========================================================================
// ==== send commands to hardware

const playStart = () => {
	$('#button-start').text('music');
	piezo.play({
		song: 'A - A - A - A - A',
    // song: "C D F D A - A A A A G G G G - - C D F D G - G G G G F F F F - -",
    beats: 1 / 4,
    tempo: 300
  });

	temporal.queue([
		{
			delay: 2500,
			task: () => {
				$('#button-start').text('1');
				piezo.frequency(400, 750);
				led1.on();
			}
		},
		{
			delay: 1000,
			task: () => {
				$('#button-start').text('2');
				piezo.frequency(400, 750);
				led2.on();
			}
		},
		{
			delay: 1000,
			task: () => {
				$('#button-start').text('3');
				piezo.frequency(400, 750);
				led3.on();
			}
		},
		{
			delay: 2500,
			task: () => {
				$('#button-start').text('START');
				$('#button-start').removeAttr('disabled');
				piezo.frequency(400, 2000);
				led1.off();
				led2.off();
				led3.off();
				client.startRound();
			}
		}
	]);
};

