'use strict';

// Johnny-Five uses stdin, which causes Electron to crash
// this reroutes stdin, so it can be used
var Readable = require('stream').Readable;  
var util = require('util');  
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

var j5 = require('johnny-five');
var client = require('./js/client');
var chrono = require('./js/chrono');
client.init(chrono);
chrono.init(client);
let led1, led2, led3, sensor1, sensor2, sensor3, piezo;

const board = new j5.Board({
	repl: false // does not work with browser console
});

board.on('ready', () => {
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
	client.boardDisonnected();

	led1.stop().off();
	led2.stop().off();
	led3.stop().off();
	piezo.noTone();
});
