// Johnny-Five uses stdin, which causes Electron to crash
// this reroutes stdin, so it can be used
var Readable = require("stream").Readable;  
var util = require("util");  
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

(function() {

  'use strict';

  const j5 = require('johnny-five');
  var connected = false;
  var led1, led2, led3, sensor1, sensor2, sensor3, piezo;
  var pingTask;

  module.exports = (socket) => {
    const board = new j5.Board({
			repl: false // does not work with browser console
		});

    board.on('ready', () => {

      // ==== ping board_ready event every 3 sec
      pingTask = setInterval(function() { 
        if (connected) {
          console.log('ping');
          socket.emit('board_ready', true);
        }
      }, 3000);

      // ==== hardware init
      sensor1 = new j5.Sensor.Digital(8);
      sensor2 = new j5.Sensor.Digital(9);
      sensor3 = new j5.Sensor.Digital(10);
      led1 = new j5.Led(13);
      led2 = new j5.Led(14);
      led3 = new j5.Led(15);
      piezo = new five.Piezo(3);

      // ==== emit events to client
      sensor1.on('change', (e) => {
        socket.emit('s1', e);
      });
      sensor2.on('change', (e) => {
        socket.emit('s2', e);
      });
      sensor3.on('change', (e) => {
        socket.emit('s3', e);
      });
    });

    board.on("exit", () => {
      socket.emit('board_exit', true);
      led1.stop().off();
      led2.stop().off();
      led3.stop().off();
      piezo.noTone();
      clearInterval(pingTask);
    });

    socket.sockets.on('connection', (socket) => {
      console.log('socket connected');
      connected = true;

      // ==== listen to client events
      socket.on('down', () => led1.on());
      socket.on('up', () => led1.stop().off());
      socket.on('hold', () => led1.blink(200));
    });
  };

})();
