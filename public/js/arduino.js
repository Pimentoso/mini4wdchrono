(function() {

  'use strict';

  const j5 = require('johnny-five');
  var connected = false;
  var led1, led2, led3, sensor1, sensor2, sensor3, piezo;
  var pingTimer;

  module.exports = (socket) => {
    const board = new j5.Board();

    board.on('ready', () => {

      // ==== ping board_ready event every 3 sec
      pingTimer = setInterval(function() { 
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
      clearInterval(pingTimer);
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